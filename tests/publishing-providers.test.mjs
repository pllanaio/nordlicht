import test from 'node:test';
import assert from 'node:assert/strict';
import { publishVideo } from '../scripts/publishing/providers.mjs';
import { assertUploadUrl, assertConnection, encryptState, decryptState, mediaSignature, verifyMediaSignature, requiredScopes, refreshConnection, PublishingError } from '../src/lib/publishing/core.mjs';
const env = { SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), APP_URL: 'https://contentdock.example', PUBLISHING_MEDIA_SECRET: 'test-media-secret-is-longer-than-32-characters' };
const connection = provider => ({ provider, accountId: 'account-1', accessToken: 'never-log-this-token', tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(), scopes: requiredScopes[provider], displayName: 'Test Creator' });
const job = (provider, input = {}) => ({ id: 'ae169b28-2cb4-4eb3-bc44-f54a6d737784', provider, provider_account_id: 'account-1', durationSeconds: 30, input: { caption: 'An example', consent: true, ...input } });
const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const creator = { data: { creator_nickname: 'Creator', privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'], max_video_post_duration_sec: 60, comment_disabled: true, duet_disabled: false, stitch_disabled: false }, error: { code: 'ok' } };
const tiktokSettings = { privacy: 'SELF_ONLY', tiktok: { disableComment: true, disableDuet: true, disableStitch: true, brandContentToggle: false, brandOrganicToggle: false, musicUsageConfirmed: true } };

test('credential envelopes authenticate ciphertext and never contain plaintext', () => {
  const original = connection('youtube'); const encrypted = encryptState(original, env);
  assert(!encrypted.toString().includes(original.accessToken)); assert.deepEqual(decryptState(encrypted, env), original);
  const tampered = Buffer.from(encrypted); tampered[tampered.length - 3] ^= 3;
  assert.throws(() => decryptState(tampered, env));
});
test('signed media access is scoped to publication and expiry', () => {
  const expiry = Math.floor(Date.now() / 1000) + 120;
  const sig = mediaSignature('ae169b28-2cb4-4eb3-bc44-f54a6d737784', expiry, env);
  assert(verifyMediaSignature('ae169b28-2cb4-4eb3-bc44-f54a6d737784', String(expiry), sig, env));
  assert(!verifyMediaSignature('be169b28-2cb4-4eb3-bc44-f54a6d737784', String(expiry), sig, env));
  assert(!verifyMediaSignature('ae169b28-2cb4-4eb3-bc44-f54a6d737784', String(expiry - 1000), sig, env));
  assert(!verifyMediaSignature('ae169b28-2cb4-4eb3-bc44-f54a6d737784', String(expiry), 'bad', env));
});
test('upload egress rejects arbitrary hosts, credentials, ports and redirects', () => {
  for (const url of ['http://open-upload.tiktokapis.com/video', 'https://tiktokapis.com.attacker.example/a', 'https://127.0.0.1/a', 'https://user:pass@open-upload.tiktokapis.com/a', 'https://open-upload.tiktokapis.com:444/a']) assert.throws(() => assertUploadUrl(url, 'tiktok'));
  assert.equal(assertUploadUrl('https://open-upload.tiktokapis.com/video/?upload_id=1', 'tiktok'), 'https://open-upload.tiktokapis.com/video/?upload_id=1');
  assert.throws(() => assertUploadUrl('https://www.googleapis.com/other', 'youtube'));
});
test('scope and expiry checks fail closed', () => {
  assert.throws(() => assertConnection({ ...connection('youtube'), scopes: [] }, 'youtube'));
  assert.throws(() => assertConnection({ ...connection('youtube'), tokenExpiresAt: undefined }, 'youtube'));
  assert.throws(() => assertConnection(connection('tiktok'), 'youtube'));
});
test('Instagram persists container before polling and only publishes after FINISHED', async () => {
  const states = []; let index = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(init.redirect, 'error');
    if (index++ === 0) { assert.equal(states.at(-1).stage, 'creating_container'); assert.match(JSON.parse(init.body).video_url, /\/api\/publishing\/media\/.*signature=/); return reply({ id: 'container-1' }); }
    if (index === 2) { assert.equal(states.at(-1).externalId, 'container-1'); assert.match(String(url), /status_code/); return reply({ status_code: 'IN_PROGRESS' }); }
    if (index === 3) return reply({ status_code: 'FINISHED' });
    assert.equal(states.at(-1).stage, 'publishing'); assert.equal(JSON.parse(init.body).creation_id, 'container-1'); return reply({ id: 'post-1' });
  };
  await publishVideo(job('instagram'), connection('instagram'), Buffer.from('mp4'), { env, fetchImpl, sleep: async () => {}, persist: async state => states.push(state) });
  assert.equal(index, 4); assert.equal(states.at(-1).status, 'published'); assert.equal(states.at(-1).externalId, 'post-1');
});
test('ambiguous Instagram publish timeout is unknown and never retried', async () => {
  let requests = 0; const states = [];
  const fetchImpl = async () => { requests++; if (requests === 1) return reply({ id: 'container' }); if (requests === 2) return reply({ status_code: 'FINISHED' }); throw new Error('network lost'); };
  await assert.rejects(publishVideo(job('instagram'), connection('instagram'), Buffer.from('mp4'), { env, fetchImpl, persist: async s => states.push(s) }), error => error instanceof PublishingError && error.uncertain);
  assert.equal(requests, 3); assert.equal(states.at(-1).externalId, 'container');
});
test('TikTok uses fresh creator choices, explicit disclosure and binary FILE_UPLOAD', async () => {
  const states = [], requests = []; const content = Buffer.alloc(22 * 1024 * 1024);
  const fetchImpl = async (url, init) => {
    requests.push(String(url));
    if (String(url).endsWith('creator_info/query/')) return reply(creator);
    if (String(url).endsWith('video/init/')) {
      const body = JSON.parse(init.body); assert.equal(body.post_info.privacy_level, 'SELF_ONLY'); assert.equal(body.post_info.is_aigc, true);
      assert.equal(body.source_info.source, 'FILE_UPLOAD'); assert.equal(body.source_info.total_chunk_count, 2);
      return reply({ data: { publish_id: 'publish-1', upload_url: 'https://open-upload.tiktokapis.com/video/' }, error: { code: 'ok' } });
    }
    if (init.method === 'PUT') {
      assert.equal(states.at(-1).externalId, 'publish-1'); assert.equal(init.headers.Authorization, undefined);
      assert.match(init.headers['Content-Range'], /^bytes /); return new Response(null, { status: 201 });
    }
    return reply({ data: { status: 'PUBLISH_COMPLETE' }, error: { code: 'ok' } });
  };
  await publishVideo(job('tiktok', tiktokSettings), connection('tiktok'), content, { env, fetchImpl, persist: async state => states.push(state) });
  assert.equal(requests.length, 5); assert.equal(states.at(-1).status, 'published');
});
test('TikTok changed privacy or duration aborts before creating a post', async () => {
  let calls = 0;
  for (const input of [{ ...tiktokSettings, privacy: 'MUTUAL_FOLLOW_FRIENDS' }, { ...tiktokSettings, tiktok: { ...tiktokSettings.tiktok, disableComment: false } }]) {
    await assert.rejects(publishVideo(job('tiktok', input), connection('tiktok'), Buffer.from('mp4'), { fetchImpl: async () => { calls++; return reply(creator); }, persist: async () => {} }), error => error instanceof PublishingError && !error.uncertain);
  }
  assert.equal(calls, 2);
});
test('YouTube persists resumable session before upload and reports private processing accurately', async () => {
  const states = []; let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    if (calls === 1) {
      const body = JSON.parse(init.body); assert.equal(body.status.privacyStatus, 'public'); assert.equal(body.status.selfDeclaredMadeForKids, false);
      return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session1' } });
    }
    if (calls === 2) { assert.match(states.at(-1).state.uploadUrl, /session1/); assert.equal(init.method, 'PUT'); return reply({ id: 'video-1' }); }
    assert.equal(states.at(-1).externalId, 'video-1'); return reply({ items: [{ status: { privacyStatus: 'private', uploadStatus: 'uploaded' } }] });
  };
  await publishVideo(job('youtube', { title: 'Short', privacy: 'public', selfDeclaredMadeForKids: false }), connection('youtube'), Buffer.from('mp4'), { fetchImpl, persist: async s => states.push(s) });
  assert.equal(states.at(-1).status, 'uploaded'); assert.equal(calls, 3);
});
test('lease/persistence failure prevents next side effect and is uncertain after initialization', async () => {
  let calls = 0;
  await assert.rejects(publishVideo(job('instagram'), connection('instagram'), Buffer.from('mp4'), { env,
    fetchImpl: async () => { calls++; return reply({ id: 'container' }); },
    persist: async state => { if (state.externalId) throw new Error('database down'); },
  }), error => error.uncertain === true);
  assert.equal(calls, 1);
});
test('refresh preserves previous granted scopes only when token response omits scope', async () => {
  const expired = { ...connection('youtube'), refreshToken: 'refresh', tokenExpiresAt: new Date(0).toISOString() };
  const refreshed = await refreshConnection(expired, { YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'secret' }, async () => reply({ access_token: 'new', expires_in: 3600 }));
  assert.deepEqual(refreshed.scopes, expired.scopes); assert.equal(refreshed.accessToken, 'new');
  const narrowed = await refreshConnection(expired, { YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'secret' }, async () => reply({ access_token: 'new', expires_in: 3600, scope: 'identity-only' }));
  assert.throws(() => assertConnection(narrowed, 'youtube'));
});
