import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { createMediaServer } from '../scripts/media-server.mjs';
import { assetSignature, publicationSignature, signedAssetUrl, verifyAssetSignature, getMediaDeliveryOrigin, parseRange } from '../src/lib/media-delivery/core.mjs';
import { signedMediaUrl } from '../src/lib/publishing/core.mjs';
const env = { PUBLISHING_MEDIA_SECRET: 'media-delivery-test-secret-at-least-32-chars', MEDIA_DELIVERY_URL: 'https://media.example.invalid' };
const id = randomUUID(), workspace = randomUUID();

test('media capabilities bind workspace, asset, download mode and expiry', () => {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = assetSignature(id, workspace, expires, false, env);
  assert(verifyAssetSignature(id, workspace, expires, false, signature, env));
  assert(!verifyAssetSignature(id, randomUUID(), expires, false, signature, env));
  assert(!verifyAssetSignature(randomUUID(), workspace, expires, false, signature, env));
  assert(!verifyAssetSignature(id, workspace, expires, true, signature, env));
  assert(!verifyAssetSignature(id, workspace, expires - 1000, false, signature, env));
  assert(!verifyAssetSignature(id, workspace, expires, false, publicationSignature(id, expires, env), env));
  const url = new URL(signedAssetUrl(id, workspace, true, env));
  assert.equal(url.origin, env.MEDIA_DELIVERY_URL); assert.equal(url.searchParams.get('download'), '1');
});
test('media origin is fixed HTTPS and Vercel publication requires dedicated delivery', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?redirect=https://evil.com', 'https://example.com/#fragment']) assert.throws(() => getMediaDeliveryOrigin({ MEDIA_DELIVERY_URL: value }));
  assert.throws(() => signedMediaUrl(id, { ...env, MEDIA_DELIVERY_URL: '', APP_URL: 'https://app.example.com', VERCEL: '1' }));
  assert.equal(new URL(signedMediaUrl(id, { ...env, APP_URL: 'https://app.example.com', VERCEL: '1' })).origin, env.MEDIA_DELIVERY_URL);
});
test('range parsing rejects invalid/multiple/unsafe ranges and supports suffix', () => {
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=20-', 100), { start: 20, end: 99 });
  for (const value of ['bytes=-0', 'bytes=100-', 'bytes=1-2,4-5', 'bytes=999999999999999999999-', 'bytes=-', 'bytes=10-2']) assert.equal(parseRange(value, 100), false);
});

test('HTTP media service streams real PostgreSQL media with scoped access', { skip: !process.env.PUBLISHING_TEST_DATABASE_URL }, async t => {
  const pool = new pg.Pool({ connectionString: process.env.PUBLISHING_TEST_DATABASE_URL, max: 4 });
  const user = randomUUID(), workspaceId = randomUUID(), assetId = randomUUID(), videoId = randomUUID(), publicationId = randomUUID();
  const bytes = Buffer.alloc(6 * 1024 * 1024, 119); bytes[262144] = 23; bytes[bytes.length - 1] = 8;
  let queries = 0, active = 0, maxChunk = 0;
  const instrumentedPool = { connect: async () => {
    const client = await pool.connect(); active++;
    return { query: async (sql, values) => { queries++; if (sql.includes('substring(content')) maxChunk = Math.max(maxChunk, values[3]); return client.query(sql, values); }, release: broken => { active--; client.release(broken); } };
  } };
  const server = createMediaServer({ pool: instrumentedPool, env, maxConcurrent: 2 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const assetUrl = (opts = {}) => {
    const expires = opts.expires || Math.floor(Date.now() / 1000) + 300;
    const tenant = opts.workspaceId || workspaceId, download = opts.download || false;
    return `${origin}/api/media/${assetId}?workspace=${tenant}&expires=${expires}&download=${download ? '1' : '0'}&signature=${assetSignature(assetId, tenant, expires, download, env)}`;
  };
  const publicationUrl = () => { const expires = Math.floor(Date.now() / 1000) + 3600; return `${origin}/api/publishing/media/${publicationId}?expires=${expires}&signature=${publicationSignature(publicationId, expires, env)}`; };
  try {
    await pool.query("insert into workspace(id,name,slug) values($1::uuid,'Media test',$1::text)", [workspaceId]);
    await pool.query("insert into app_user(id,external_auth_id,email,display_name,first_name,last_name) values($1::uuid,$1::text,$2,'Media','Media','Test')", [user, `${user}@example.invalid`]);
    await pool.query("insert into media_asset(id,workspace_id,storage_key,name,content_type,content,bytes,checksum_sha256,created_by) values($1::uuid,$2,$1::text,'Video','video/mp4',$3,$4,'test',$5)", [assetId, workspaceId, bytes, bytes.length, user]);
    await pool.query("insert into video_job(id,workspace_id,created_by,idempotency_key,request_hash,input,status,media_asset_id) values($1,$2,$3,$1,'test','{}','completed',$4)", [videoId, workspaceId, user, assetId]);
    await pool.query("insert into video_publication(id,workspace_id,video_job_id,created_by,provider,provider_account_id,idempotency_key,request_hash,input,status) values($1,$2,$3,$4,'instagram','account',$1,'test','{}','processing')", [publicationId, workspaceId, videoId, user]);
    await t.test('6 MiB whole download uses bounded database chunks and safe fixed filename', async () => {
      const response = await fetch(assetUrl({ download: true })); assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-length'), String(bytes.length)); assert.match(response.headers.get('content-disposition'), /attachment; filename="contentdock-.*\.mp4"/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes); assert.equal(maxChunk, 256 * 1024);
    });
    await t.test('HEAD, explicit and suffix ranges return accurate metadata/body', async () => {
      const head = await fetch(assetUrl(), { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
      for (const [range, expected] of [['bytes=262140-262150', bytes.subarray(262140, 262151)], ['bytes=-7', bytes.subarray(-7)]]) {
        const response = await fetch(assetUrl(), { headers: { Range: range } }); assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
      }
      const invalid = await fetch(assetUrl(), { headers: { Range: 'bytes=-0' } }); assert.equal(invalid.status, 416);
    });
    await t.test('invalid signatures and methods never touch the database', async () => {
      const before = queries;
      assert.equal((await fetch(assetUrl() + 'broken')).status, 404);
      assert.equal((await fetch(assetUrl({ expires: Math.floor(Date.now() / 1000) - 10 }))).status, 404);
      assert.equal((await fetch(assetUrl(), { method: 'POST' })).status, 405);
      assert.equal(queries, before);
    });
    await t.test('valid token for another workspace cannot read this asset', async () => { assert.equal((await fetch(assetUrl({ workspaceId: randomUUID() }))).status, 404); });
    await t.test('publication URL serves only active same-tenant Instagram publication', async () => {
      const response = await fetch(publicationUrl(), { headers: { Range: 'bytes=0-9' } }); assert.equal(response.status, 206); assert.equal((await response.arrayBuffer()).byteLength, 10);
      await pool.query("update video_publication set status='published' where id=$1", [publicationId]);
      assert.equal((await fetch(publicationUrl())).status, 404);
    });
    await t.test('abandoned download releases transaction and pool slot', async () => {
      const response = await fetch(assetUrl()); await response.body.cancel();
      for (let i = 0; i < 50 && active > 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(active, 0); assert.equal((await fetch(assetUrl(), { method: 'HEAD' })).status, 200);
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (let i = 0; i < 50 && active > 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
    await pool.query('delete from workspace where id=$1', [workspaceId]); await pool.query('delete from app_user where id=$1', [user]); await pool.end();
  }
});

test('service rejects excess concurrent signed requests without another database connection', async () => {
  let unblock, connected;
  const waiting = new Promise(resolve => { connected = resolve; });
  const gate = new Promise(resolve => { unblock = resolve; });
  let connections = 0;
  const pool = { connect: async () => { connections++; connected(); await gate; return { query: async () => ({ rows: [] }), release: () => {} }; } };
  const server = createMediaServer({ pool, env, maxConcurrent: 1 }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = new URL(signedAssetUrl(id, workspace, false, env)); url.protocol = 'http:'; url.host = `127.0.0.1:${server.address().port}`;
  try {
    const first = fetch(url); await waiting;
    const rejected = await fetch(url); assert.equal(rejected.status, 503); assert.equal(rejected.headers.get('retry-after'), '2'); assert.equal(connections, 1);
    unblock(); assert.equal((await first).status, 404);
  } finally { unblock(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
