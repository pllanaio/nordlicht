import { assertConnection, assertUploadUrl, boundedFetch, getTikTokCreator, providerJson, PublishingError, signedMediaUrl } from '../../src/lib/publishing/core.mjs';

function rejected(message) { const error = new PublishingError(message); error.safeToRetry = true; return error; }
const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(done, ms);
  function done() { signal?.removeEventListener('abort', aborted); resolve(); }
  function aborted() { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(signal.reason); }
  signal?.addEventListener('abort', aborted, { once: true });
});

// Every state callback must commit before the next external side effect. A lost
// worker lease aborts; providers are never blindly restarted after a timeout.
export async function publishVideo(job, connection, content, { persist, fetchImpl = fetch, sleep = wait, env = process.env, signal } = {}) {
  signal?.throwIfAborted();
  const transport = (url, init) => {
    signal?.throwIfAborted();
    return fetchImpl(url, { ...init, signal: signal ? AbortSignal.any([init.signal, signal].filter(Boolean)) : init.signal });
  };
  assertConnection(connection, job.provider);
  if (connection.accountId !== job.provider_account_id) throw new PublishingError('Der verbundene Kanal hat sich geändert. Bitte den Auftrag erneut bestätigen.');
  if (!Buffer.isBuffer(content) || !content.length || content.length > 250 * 1024 * 1024) throw new PublishingError('Das Video fehlt oder ist zu groß.');
  const auth = { Authorization: `Bearer ${connection.accessToken}` };
  const jsonHeaders = { ...auth, 'Content-Type': 'application/json' };
  const json = (url, body) => providerJson(url, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) }, transport);
  const input = job.input;
  let mutationStarted = false;
  const mark = async state => { signal?.throwIfAborted(); await persist(state); signal?.throwIfAborted(); };
  try {
    if (job.provider === 'instagram') {
      const version = env.META_GRAPH_VERSION || 'v23.0';
      if (!/^v[0-9]{1,2}\.[0-9]$/.test(version)) throw new PublishingError('Ungültige Instagram API-Version.');
      const instagramRoot = `https://graph.instagram.com/${version}`;
      const mediaUrl = signedMediaUrl(job.id, env);
      await mark({ stage: 'creating_container' }); mutationStarted = true;
      const created = await json(`${instagramRoot}/${encodeURIComponent(connection.accountId)}/media`, {
        media_type: 'REELS', video_url: mediaUrl, caption: input.caption, share_to_feed: true,
      });
      if (!created.id) throw new PublishingError('Instagram hat keine Container-ID bestätigt.', true);
      const containerId = String(created.id);
      await mark({ stage: 'container_processing', externalId: containerId, state: { containerId } });
      let ready = false;
      for (let i = 0; i < 36; i++) {
        const data = await providerJson(`${instagramRoot}/${encodeURIComponent(containerId)}?fields=status_code`, { headers: auth }, transport);
        if (data.status_code === 'FINISHED') { ready = true; break; }
        if (['ERROR', 'EXPIRED'].includes(data.status_code)) throw rejected('Instagram konnte das Video nicht verarbeiten.');
        await sleep(5_000, signal);
      }
      if (!ready) throw new PublishingError('Instagram verarbeitet das Video noch. Bitte den Status prüfen, bevor du erneut veröffentlichst.', true);
      await mark({ stage: 'publishing', externalId: containerId });
      const published = await json(`${instagramRoot}/${encodeURIComponent(connection.accountId)}/media_publish`, { creation_id: containerId });
      if (!published.id) throw new PublishingError('Instagram hat die Veröffentlichung noch nicht bestätigt.', true);
      await mark({ stage: 'complete', status: 'published', externalId: String(published.id), state: null });
      return;
    }
    if (job.provider === 'tiktok') {
      const creator = await getTikTokCreator(connection, transport);
      if (!creator.privacyLevelOptions.includes(input.privacy)) throw new PublishingError('Die gewählte TikTok-Sichtbarkeit ist nicht mehr verfügbar. Bitte neu auswählen.');
      if (job.durationSeconds > creator.maxVideoPostDurationSec) throw new PublishingError('Das Video überschreitet die maximale TikTok-Dauer dieses Kontos.');
      const settings = input.tiktok;
      if (!settings?.musicUsageConfirmed || (settings.brandContentToggle && input.privacy === 'SELF_ONLY')) throw new PublishingError('Bitte TikTok-Inhaltsangaben prüfen.');
      if ((!settings.disableComment && creator.commentDisabled) || (!settings.disableDuet && creator.duetDisabled) || (!settings.disableStitch && creator.stitchDisabled)) throw new PublishingError('Die TikTok-Interaktionseinstellungen haben sich geändert. Bitte erneut bestätigen.');
      // TikTok permits 5–64 MiB chunks; the last may be smaller. Small videos
      // upload as one chunk. Floor lets the final chunk absorb the remainder.
      const base = 10 * 1024 * 1024;
      const count = Math.max(1, Math.floor(content.length / base));
      const chunkSize = count === 1 ? content.length : base;
      await mark({ stage: 'initializing_upload' }); mutationStarted = true;
      const result = await json('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        post_info: { title: input.caption, privacy_level: input.privacy,
          disable_comment: settings.disableComment, disable_duet: settings.disableDuet, disable_stitch: settings.disableStitch,
          brand_content_toggle: settings.brandContentToggle, brand_organic_toggle: settings.brandOrganicToggle, is_aigc: true },
        source_info: { source: 'FILE_UPLOAD', video_size: content.length, chunk_size: chunkSize, total_chunk_count: count },
      });
      const externalId = result.data?.publish_id;
      if (!externalId) throw new PublishingError('TikTok hat keine Upload-ID bestätigt.', true);
      const uploadUrl = assertUploadUrl(result.data?.upload_url, 'tiktok');
      await mark({ stage: 'uploading', externalId, state: { uploadUrl, uploadedBytes: 0 } });
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize, end = i === count - 1 ? content.length : start + chunkSize;
        const response = await boundedFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4',
          'Content-Length': String(end - start), 'Content-Range': `bytes ${start}-${end - 1}/${content.length}` }, body: content.subarray(start, end) }, transport);
        if (!response.ok) throw new PublishingError('TikTok konnte den Upload nicht bestätigen. Bitte den Status prüfen.', true);
        await response.body?.cancel();
        await mark({ stage: 'uploading', externalId, state: { uploadUrl, uploadedBytes: end } });
      }
      await mark({ stage: 'provider_processing', externalId });
      for (let i = 0; i < 36; i++) {
        const response = await json('https://open.tiktokapis.com/v2/post/publish/status/fetch/', { publish_id: externalId });
        if (response.data?.status === 'PUBLISH_COMPLETE') {
          await mark({ stage: 'complete', status: 'published', externalId, state: null }); return;
        }
        if (response.data?.status === 'FAILED') throw rejected('TikTok hat die Veröffentlichung abgelehnt. Bitte Video und App-Freigabe prüfen.');
        await sleep(5_000, signal);
      }
      throw new PublishingError('TikTok hat den Upload erhalten, die Veröffentlichung aber noch nicht bestätigt. Status vor einem neuen Versuch prüfen.', true);
    }
    if (job.provider === 'youtube') {
      if (!['private', 'unlisted', 'public'].includes(input.privacy) || typeof input.selfDeclaredMadeForKids !== 'boolean' || !input.title) throw new PublishingError('Bitte YouTube-Sichtbarkeit, Titel und Zielgruppe auswählen.');
      await mark({ stage: 'initializing_upload' }); mutationStarted = true;
      const response = await boundedFetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST', headers: { ...jsonHeaders, 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(content.length) },
        body: JSON.stringify({ snippet: { title: input.title, description: input.caption },
          status: { privacyStatus: input.privacy, selfDeclaredMadeForKids: input.selfDeclaredMadeForKids, containsSyntheticMedia: true } }),
      }, transport);
      if (!response.ok) { await response.body?.cancel(); throw new PublishingError('YouTube hat den Upload abgelehnt. Bitte Kanal und App-Freigabe prüfen.', response.status >= 500); }
      const uploadUrl = assertUploadUrl(response.headers.get('location'), 'youtube');
      await response.body?.cancel();
      await mark({ stage: 'uploading', state: { uploadUrl } });
      const uploaded = await providerJson(uploadUrl, { method: 'PUT', headers: { ...auth, 'Content-Type': 'video/mp4', 'Content-Length': String(content.length) }, body: content }, transport);
      if (!uploaded.id) throw new PublishingError('YouTube hat keine Video-ID bestätigt.', true);
      const externalId = String(uploaded.id);
      await mark({ stage: 'provider_processing', externalId, state: { uploadUrl } });
      // A successful upload may be private due to app verification restrictions.
      // Report provider-confirmed visibility, never the requested visibility.
      const details = await providerJson(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(externalId)}`, { headers: auth }, transport);
      const video = details.items?.[0];
      if (video?.status?.uploadStatus === 'rejected' || video?.status?.uploadStatus === 'failed') throw rejected('YouTube hat die Videoverarbeitung abgelehnt.');
      const published = video?.status?.privacyStatus === 'public' && video?.status?.uploadStatus === 'processed';
      await mark({ stage: 'complete', status: published ? 'published' : 'uploaded', externalId, state: null });
      return;
    }
    throw new PublishingError('Diese Plattform wird nicht unterstützt.');
  } catch (error) {
    // A thrown transport/persistence error after a side effect can represent a
    // successful remote operation. Preserve identifiers and prohibit retries.
    if (error instanceof PublishingError) { if (mutationStarted && !error.safeToRetry) error.uncertain = true; throw error; }
    throw new PublishingError('Der Veröffentlichungsstatus muss geprüft werden.', mutationStarted);
  }
}
