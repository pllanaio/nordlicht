import { getMediaDeliveryOrigin, publicationSignature, verifyPublicationSignature } from '../media-delivery/core.mjs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const publishingProviders = ['instagram', 'tiktok', 'youtube'];
export const requiredScopes = {
  instagram: ['instagram_business_basic', 'instagram_business_content_publish'],
  tiktok: ['user.info.basic', 'video.publish'],
  youtube: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
};
export class PublishingError extends Error {
  constructor(message, uncertain = false) { super(message); this.uncertain = uncertain; }
}
function key(env = process.env) {
  const key = Buffer.from(env.SOCIAL_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new PublishingError('Die sichere Kanalverbindung ist nicht eingerichtet.');
  return key;
}
export function encryptState(value, env = process.env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.from(['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.'));
}
export function decryptState(value, env = process.env) {
  const [version, iv, tag, data] = Buffer.from(value).toString().split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new PublishingError('Kanalverbindung ungültig. Bitte neu verbinden.');
  const cipher = createDecipheriv('aes-256-gcm', key(env), Buffer.from(iv, 'base64url'));
  cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, 'base64url')), cipher.final()]).toString());
}
export function assertConnection(connection, provider, now = Date.now()) {
  if (!connection || connection.provider !== provider || !connection.accessToken || !connection.accountId) throw new PublishingError('Bitte den Kanal erneut verbinden.');
  if (!requiredScopes[provider]?.every(scope => connection.scopes?.includes(scope))) throw new PublishingError('Die Veröffentlichungsberechtigung fehlt. Bitte den Kanal erneut verbinden.');
  if (!connection.tokenExpiresAt || Date.parse(connection.tokenExpiresAt) <= now + 30_000 || !Number.isFinite(Date.parse(connection.tokenExpiresAt))) throw new PublishingError('Die Kanalverbindung ist abgelaufen. Bitte erneut verbinden.');
}
export async function boundedFetch(url, init = {}, fetchImpl = fetch) {
  try { return await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(init.method === 'PUT' ? 120_000 : 25_000) }); }
  catch { throw new PublishingError('Der Plattformaufruf wurde unterbrochen. Der Status muss geprüft werden.', init.method === 'POST' || init.method === 'PUT'); }
}
export async function providerJson(url, init, fetchImpl = fetch) {
  const response = await boundedFetch(url, init, fetchImpl);
  // API responses contain no media; bound bytes before parsing provider-controlled data.
  const reader = response.body?.getReader(); let size = 0; const chunks = [];
  if (reader) try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > 1_000_000) { await reader.cancel(); throw new PublishingError('Ungültige Plattformantwort.', true); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new PublishingError('Ungültige Plattformantwort.', response.ok); }
  if (!response.ok || (data.error && data.error.code !== 'ok')) throw new PublishingError('Die Plattform hat die Anfrage abgelehnt. Bitte Verbindung, App-Freigabe und Video prüfen.', response.status >= 500);
  return data;
}
export async function refreshConnection(connection, env = process.env, fetchImpl = fetch) {
  if (Date.parse(connection.tokenExpiresAt || '') > Date.now() + 120_000) return connection;
  if (!connection.refreshToken || !['youtube', 'tiktok'].includes(connection.provider)) { assertConnection(connection, connection.provider); return connection; }
  const youtube = connection.provider === 'youtube';
  const clientId = youtube ? env.YOUTUBE_CLIENT_ID : env.TIKTOK_CLIENT_KEY;
  const clientSecret = youtube ? env.YOUTUBE_CLIENT_SECRET : env.TIKTOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new PublishingError('Die Kanalverbindung muss erneut eingerichtet werden.');
  const data = await providerJson(youtube ? 'https://oauth2.googleapis.com/token' : 'https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: connection.refreshToken,
      [youtube ? 'client_id' : 'client_key']: clientId, client_secret: clientSecret }),
  }, fetchImpl);
  if (!data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new PublishingError('Die Kanalverbindung muss erneuert werden.');
  return { ...connection, accessToken: data.access_token, refreshToken: data.refresh_token || connection.refreshToken,
    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    // Refresh may omit scope (same grant). Never infer grants from requested scopes.
    scopes: typeof data.scope === 'string' ? data.scope.split(/[\s,]+/).filter(Boolean) : connection.scopes };
}
export async function getTikTokCreator(connection, fetchImpl = fetch) {
  assertConnection(connection, 'tiktok');
  const result = await providerJson('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST', headers: { Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' }, body: '{}',
  }, fetchImpl);
  const d = result.data;
  if (!d || !Array.isArray(d.privacy_level_options) || !Number.isFinite(d.max_video_post_duration_sec)) throw new PublishingError('TikTok-Einstellungen konnten nicht geladen werden.');
  return { creatorNickname: String(d.creator_nickname || d.creator_username || connection.displayName), creatorAvatarUrl: String(d.creator_avatar_url || ''),
    privacyLevelOptions: d.privacy_level_options.filter(v => typeof v === 'string'), maxVideoPostDurationSec: d.max_video_post_duration_sec,
    commentDisabled: d.comment_disabled === true, duetDisabled: d.duet_disabled === true, stitchDisabled: d.stitch_disabled === true };
}
export function assertUploadUrl(value, provider) {
  let url; try { url = new URL(value); } catch { throw new PublishingError('Ungültige Upload-Adresse.'); }
  const valid = provider === 'youtube' ? url.hostname === 'www.googleapis.com' :
    /^(?:[a-z0-9-]+\.)*tiktokapis\.com$/.test(url.hostname) && url.hostname !== 'open.tiktokapis.com';
  if (url.protocol !== 'https:' || !valid || url.username || url.password || url.port || url.hash) throw new PublishingError('Unzulässige Upload-Adresse.');
  if (provider === 'youtube' && !url.pathname.startsWith('/upload/youtube/v3/videos')) throw new PublishingError('Unzulässige Upload-Adresse.');
  return url.toString();
}
export const mediaSignature = publicationSignature;
export const verifyMediaSignature = verifyPublicationSignature;
export function signedMediaUrl(id, env = process.env) {
  const mediaOrigin = getMediaDeliveryOrigin(env);
  if (env.VERCEL && !mediaOrigin) throw new PublishingError('Für Instagram muss der externe Mediendienst eingerichtet werden.');
  const origin = new URL(mediaOrigin || env.APP_URL || 'http://invalid');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.hostname === 'localhost') throw new PublishingError('Instagram benötigt eine öffentliche HTTPS APP_URL.');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const url = new URL(`/api/publishing/media/${id}`, origin);
  url.searchParams.set('expires', String(expires)); url.searchParams.set('signature', mediaSignature(id, expires, env)); return url.toString();
}
