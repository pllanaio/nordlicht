import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { claimPublication, processPublication } from '../scripts/publishing-worker.mjs';
import { encryptState, requiredScopes } from '../src/lib/publishing/core.mjs';
const databaseUrl = process.env.PUBLISHING_TEST_DATABASE_URL;

test('publishing queue database authorization, durability and tenant isolation', { skip: !databaseUrl }, async t => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname), 'Only a local fixture database is allowed');
  const schema = `publishing_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  await admin.query(`create schema ${schema}`);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4, options: `-c search_path=${schema}` });
  try {
    for (const migration of ['001_initial.sql', '002_video_jobs.sql', '003_video_publications.sql']) {
      await pool.query(await readFile(new URL(`../database/migrations/${migration}`, import.meta.url), 'utf8'));
    }
  } catch (error) {
    await pool.end(); await admin.query(`drop schema ${schema} cascade`); await admin.end(); throw error;
  }
  const workspaces = [], users = [];
  const originalKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
  async function fixture() {
    const workspace = randomUUID(), user = randomUUID(), media = randomUUID(), video = randomUUID(), publication = randomUUID();
    workspaces.push(workspace); users.push(user);
    await pool.query("insert into workspace(id,name,slug) values ($1::uuid,'Publishing test',$1::text)", [workspace]);
    await pool.query("insert into app_user(id,external_auth_id,email,display_name,first_name,last_name) values ($1::uuid,$1::text,$2,'Test','Test','User')", [user, `${user}@example.invalid`]);
    await pool.query("insert into workspace_member(workspace_id,user_id,role) values ($1,$2,'owner')", [workspace, user]);
    await pool.query("insert into subscription(workspace_id,plan,status,current_period_end) values ($1,'pro','active',now()+interval '1 day')", [workspace]);
    await pool.query("insert into media_asset(id,workspace_id,storage_key,name,content_type,content,bytes,checksum_sha256,created_by) values ($1::uuid,$2,$1::text,'Test','video/mp4',$3,3,'test',$4)", [media, workspace, Buffer.from('mp4'), user]);
    await pool.query("insert into video_job(id,workspace_id,created_by,idempotency_key,request_hash,input,status,media_asset_id) values ($1,$2,$3,$1,'test',$4::jsonb,'completed',$5)", [video, workspace, user, JSON.stringify({ durationSeconds: 30 }), media]);
    const conn = { provider: 'youtube', accountId: 'channel-1', displayName: 'Test', accessToken: 'fake-provider-token', scopes: requiredScopes.youtube, tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString() };
    await pool.query("insert into social_connection(workspace_id,provider,provider_account_id,display_name,encrypted_access_token) values ($1,'youtube','channel-1','Test',$2)", [workspace, encryptState(conn)]);
    await pool.query(`insert into video_publication(id,workspace_id,video_job_id,created_by,provider,provider_account_id,idempotency_key,request_hash,input)
      values ($1,$2,$3,$4,'youtube','channel-1',$1,'test',$5::jsonb)`, [publication, workspace, video, user, JSON.stringify({ provider: 'youtube', caption: 'Test', title: 'Test', privacy: 'private', selfDeclaredMadeForKids: false, consent: true })]);
    return { workspace, user, media, video, publication };
  }
  async function claim(f) { const j = await claimPublication(pool); assert.equal(j.id, f.publication); return j; }
  async function status(f) { return (await pool.query('select * from video_publication where id=$1', [f.publication])).rows[0]; }
  try {
    await t.test('provider identity and status persist; completed media remains untouched', async () => {
      const f = await fixture(); const j = await claim(f); let count = 0;
      await processPublication(pool, j, { fetchImpl: async (url, init) => {
        count++;
        if (count === 1) return new Response(null, { headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test' } });
        if (count === 2) { assert.equal((await status(f)).stage, 'uploading'); assert.equal(init.method, 'PUT'); return Response.json({ id: 'remote-video' }); }
        assert.equal((await status(f)).external_id, 'remote-video'); return Response.json({ items: [{ status: { privacyStatus: 'private', uploadStatus: 'processed' } }] });
      } });
      const result = await status(f); assert.equal(result.status, 'uploaded'); assert.equal(result.external_id, 'remote-video'); assert.equal(result.encrypted_state, null);
      assert.equal((await pool.query('select status from video_job where id=$1', [f.video])).rows[0].status, 'completed');
    });
    await t.test('reviewer role, revoked subscription and expired subscription block all calls', async () => {
      for (const kind of ['reviewer', 'revoked', 'expired']) {
        const f = await fixture(); const j = await claim(f);
        if (kind === 'reviewer') await pool.query("update workspace_member set role='reviewer' where workspace_id=$1", [f.workspace]);
        else if (kind === 'revoked') await pool.query("update subscription set status='canceled' where workspace_id=$1", [f.workspace]);
        else await pool.query("update subscription set current_period_end=now()-interval '1 day' where workspace_id=$1", [f.workspace]);
        await processPublication(pool, j, { fetchImpl: async () => { assert.fail('Provider must not be called'); } });
        assert.equal((await status(f)).status, 'failed');
      }
    });
    await t.test('asset in a different tenant is never uploaded', async () => {
      const foreign = await fixture(); await pool.query("update video_publication set status='failed' where id=$1", [foreign.publication]);
      const f = await fixture(); await pool.query('update video_job set media_asset_id=$1 where id=$2', [foreign.media, f.video]);
      await processPublication(pool, await claim(f), { fetchImpl: async () => { assert.fail('Foreign media must not be read'); } });
      assert.equal((await status(f)).status, 'failed');
    });
    await t.test('changed connected account cannot receive an already-confirmed post', async () => {
      const f = await fixture(); const j = await claim(f);
      await pool.query("update social_connection set provider_account_id='changed' where workspace_id=$1", [f.workspace]);
      await processPublication(pool, j, { fetchImpl: async () => { assert.fail('Changed channel must not be called'); } });
      assert.equal((await status(f)).status, 'failed');
    });
    await t.test('expired processing lease becomes unknown and cannot enqueue duplicate', async () => {
      const f = await fixture(); await claim(f);
      await pool.query("update video_publication set lease_expires_at=now()-interval '1 second', external_id='may-exist' where id=$1", [f.publication]);
      assert.equal(await claimPublication(pool), null); const result = await status(f);
      assert.equal(result.status, 'unknown'); assert.equal(result.external_id, 'may-exist');
      await assert.rejects(pool.query(`insert into video_publication(workspace_id,video_job_id,created_by,provider,provider_account_id,idempotency_key,request_hash,input)
        values ($1,$2,$3,'youtube','channel-1',$4,'test','{}')`, [f.workspace, f.video, f.user, randomUUID()]), error => error.code === '23505');
    });
    await t.test('shutdown aborts active request and never submits a second one', async () => {
      const f = await fixture(); const j = await claim(f); const controller = new AbortController(); let calls = 0;
      await processPublication(pool, j, { signal: controller.signal, fetchImpl: async (_url, init) => {
        calls++; controller.abort(new Error('shutdown'));
        init.signal.throwIfAborted(); return Response.json({});
      } });
      assert.equal(calls, 1); assert.equal((await status(f)).status, 'unknown');
    });
    await t.test('concurrent claims are distinct', async () => {
      const a = await fixture(), b = await fixture(); const claimed = await Promise.all([claimPublication(pool), claimPublication(pool)]);
      assert.deepEqual(new Set(claimed.map(j => j.id)), new Set([a.publication, b.publication]));
      await pool.query("update video_publication set status='failed' where id=any($1::uuid[])", [[a.publication, b.publication]]);
    });
  } finally {
    // Remove cross-tenant asset references before deleting fixtures.
    await pool.query('update video_job set media_asset_id=null where workspace_id=any($1::uuid[])', [workspaces]);
    await pool.query('delete from workspace where id=any($1::uuid[])', [workspaces]);
    await pool.query('delete from app_user where id=any($1::uuid[])', [users]);
    await pool.end();
    await admin.query(`drop schema ${schema} cascade`);
    await admin.end();
    if (originalKey === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY; else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = originalKey;
  }
});
