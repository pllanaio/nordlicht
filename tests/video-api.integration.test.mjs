import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { encryptState, requiredScopes } from "../src/lib/publishing/core.mjs";

test("video HTTP API isolates tenants, encrypts keys, deduplicates and enforces role/queue limits", { skip: !process.env.TEST_BASE_URL }, async () => {
  const base = new URL(process.env.TEST_BASE_URL);
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Tests may only target local fixture servers");
  assert.ok(["localhost", "127.0.0.1"].includes(database.hostname), "Tests may only target local fixture databases");
  const secret = process.env.TEST_SESSION_SECRET;
  assert.ok(secret?.length >= 32);
  const db = new Client({ connectionString: database.href });
  await db.connect();
  const marker = randomUUID();
  const identities = [0, 1].map((index) => `video-api-fixture-${marker}-${index}`);
  const token = (id) => {
    const payload = Buffer.from(JSON.stringify({ paymentId: id, plan: "pro", source: "internal-test", expiresAt: Date.now() + 300000 })).toString("base64url");
    return `${payload}.${createHmac("sha256", secret).update(`entitlement:${payload}`).digest("base64url")}`;
  };
  const request = (path, { principal = 0, method = "GET", data, headers = {}, auth = true } = {}) => fetch(new URL(path, base), {
    method, redirect: 'manual', headers: { ...(auth ? { cookie: `contentdock_subscription=${token(identities[principal])}` } : {}), origin: base.origin, ...(data ? { "content-type": "application/json" } : {}), ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const input = { topic: "Lokaler Integrationstest", language: "de", voice: "nova", aspectRatio: "9:16", durationSeconds: 30, subtitles: true, credentialConsent: true };
  const apiKey = "sk-local-fixture-never-a-real-provider-key";
  const enqueue = (key, data = input) => request("/api/video/jobs", { method: "POST", data, headers: { "x-ai-key": apiKey, "idempotency-key": key } });
  const workerId = `api-fixture:${marker}`;
  const workspaceIds = [];
  try {
    assert.equal((await request("/api/video/jobs", { auth: false })).status, 401);
    for (let principal = 0; principal < 2; principal++) {
      const response = await request("/api/video/jobs", { principal });
      assert.equal(response.status, 200);
      const context = await db.query("select wm.workspace_id from workspace_member wm join app_user u on u.id = wm.user_id where u.external_auth_id = $1", [`internal-test:${identities[principal]}`]);
      workspaceIds.push(context.rows[0].workspace_id);
    }
    assert.notEqual(workspaceIds[0], workspaceIds[1]);
    await db.query("insert into video_worker(id) values($1)", [workerId]);
    const key = randomUUID();
    const created = await enqueue(key);
    assert.equal(created.status, 202);
    const { job } = await created.json();
    assert.equal(job.status, "queued");
    assert.equal(JSON.stringify(job).includes(apiKey), false);
    const stored = (await db.query("select encrypted_api_key,input from video_job where id=$1", [job.id])).rows[0];
    assert.ok(stored.encrypted_api_key.length > 0);
    assert.equal(stored.encrypted_api_key.toString().includes(apiKey), false);
    assert.equal(JSON.stringify(stored.input).includes(apiKey), false);
    assert.equal((await (await enqueue(key)).json()).job.id, job.id);
    assert.equal((await enqueue(key, { ...input, topic: "Geändertes Thema" })).status, 409);
    assert.equal((await request(`/api/video/jobs/${job.id}`, { principal: 1 })).status, 404);
    assert.equal((await request(`/api/video/jobs/${job.id}`, { principal: 1, method: "DELETE" })).status, 404);
    assert.equal((await request(`/api/video/jobs/${job.id}/subtitles`, { principal: 1 })).status, 404);
    assert.equal((await request("/api/video/jobs", { method: "POST", data: input, headers: { origin: "https://evil.invalid" } })).status, 403);
    assert.equal((await enqueue(randomUUID(), { ...input, credentialConsent: false })).status, 400);
    assert.equal((await enqueue(randomUUID())).status, 202);
    assert.equal((await enqueue(randomUUID())).status, 429);
    assert.equal((await request(`/api/video/jobs/${job.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await db.query("select encrypted_api_key from video_job where id=$1", [job.id])).rows[0].encrypted_api_key, null);
    await db.query("update video_job set expires_at=now()-interval '1 second' where workspace_id=$1 and status='queued'", [workspaceIds[0]]);
    const expired = await (await request("/api/video/jobs")).json();
    assert.ok(expired.jobs.some((entry) => entry.status === "failed"));
    assert.equal((await db.query("select count(*)::integer as n from video_job where workspace_id=$1 and encrypted_api_key is not null", [workspaceIds[0]])).rows[0].n, 0);
    await db.query("update workspace_member set role='reviewer' where workspace_id=$1", [workspaceIds[0]]);
    assert.equal((await enqueue(randomUUID())).status, 403);

    // Completed-video publication uses local encrypted dummy credentials and no
    // worker process. None of these API calls may contact a real provider.
    await db.query("update workspace_member set role='owner' where workspace_id=$1", [workspaceIds[0]]);
    const user = (await db.query("select user_id from workspace_member where workspace_id=$1", [workspaceIds[0]])).rows[0].user_id;
    const media = randomUUID();
    await db.query("insert into media_asset(id,workspace_id,storage_key,name,content_type,content,bytes,checksum_sha256,created_by,duration_ms) values($1,$2,$3,'Fixture','video/mp4',$4,4,'fixture',$5,30000)", [media, workspaceIds[0], `fixture:${media}`, Buffer.from('mp4!'), user]);
    await db.query("update video_job set status='completed',stage='complete',progress=100,media_asset_id=$2 where id=$1", [job.id, media]);
    const privateToken = 'local-dummy-youtube-token-never-serialize';
    const storedConnection = { provider: 'youtube', accountId: 'dummy-channel', displayName: 'Fixture channel', accessToken: privateToken, refreshToken: 'dummy-refresh', scopes: requiredScopes.youtube, tokenExpiresAt: new Date(Date.now() + 3600000).toISOString() };
    await db.query("insert into social_connection(workspace_id,provider,provider_account_id,display_name,encrypted_access_token,scopes,token_expires_at) values($1,'youtube','dummy-channel','Fixture channel',$2,$3,$4)", [workspaceIds[0], encryptState(storedConnection, { SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 'b').toString('base64') }), requiredScopes.youtube, storedConnection.tokenExpiresAt]);
    await db.query("insert into publishing_worker(id) values($1)", [workerId]);
    const publicationPath = `/api/video/jobs/${job.id}/publish`;
    const options = await (await request(publicationPath)).json();
    assert.equal(options.channels.find(entry => entry.provider === 'youtube').ready, true);
    assert.equal(JSON.stringify(options).includes(privateToken), false);
    assert.equal((await request(publicationPath, { principal: 1 })).status, 404);
    const pubKey = randomUUID();
    const publication = { provider: 'youtube', title: 'Fixture video', caption: 'Fixture caption', privacy: 'private', selfDeclaredMadeForKids: false, consent: true };
    const publish = (data = publication, extra = {}) => request(publicationPath, { method: 'POST', data, headers: { 'idempotency-key': pubKey }, ...extra });
    assert.equal((await publish({ ...publication, consent: false })).status, 400);
    assert.equal((await publish({ ...publication, privacy: undefined })).status, 400);
    assert.equal((await publish(publication, { principal: 1 })).status, 404);
    const published = await publish();
    assert.equal(published.status, 202);
    const publicationId = (await published.json()).publication.id;
    const statuses = await (await request(`${publicationPath}?status=1`)).json();
    assert.equal(statuses.publications[0].id, publicationId);
    assert.equal('channels' in statuses, false);
    assert.equal((await request(`${publicationPath}?status=1`, { principal: 1 })).status, 404);
    assert.equal((await (await publish()).json()).publication.id, publicationId);
    assert.equal((await publish({ ...publication, title: 'Changed' })).status, 409);
    assert.equal((await request(publicationPath, { method: 'POST', data: publication, headers: { 'idempotency-key': randomUUID() } })).status, 409);
    assert.equal((await request(`/api/workspace/media/${media}`, { principal: 1 })).status, 404);
    const partial = await request(`/api/workspace/media/${media}`, { headers: { range: 'bytes=1-2' } });
    if (process.env.TEST_MEDIA_DELIVERY_ORIGIN) {
      assert.equal(partial.status, 307);
      const destination = new URL(partial.headers.get('location'));
      assert.equal(destination.origin, process.env.TEST_MEDIA_DELIVERY_ORIGIN);
      assert.equal(destination.pathname, `/api/media/${media}`);
      assert.equal(destination.searchParams.get('workspace'), workspaceIds[0]);
      assert.ok(Number(destination.searchParams.get('expires')) > Date.now() / 1000);
      assert.match(destination.searchParams.get('signature'), /^[\w-]{43}$/);
      assert.equal(partial.headers.get('cache-control'), 'private, no-store');
    } else {
      assert.equal(partial.status, 206); assert.equal(await partial.text(), 'p4');
      assert.equal((await request(`/api/workspace/media/${media}`, { headers: { range: 'bytes=99-' } })).status, 416);
    }
    const dashboard = await (await request('/dashboard?view=video-studio')).text();
    assert.equal(dashboard.includes(privateToken), false);
    assert.equal(dashboard.includes('dummy-refresh'), false);
    await db.query("update workspace_member set role='reviewer' where workspace_id=$1", [workspaceIds[0]]);
    assert.equal((await publish()).status, 403);
  } finally {
    await db.query("delete from video_worker where id=$1", [workerId]);
    await db.query("delete from publishing_worker where id=$1", [workerId]);
    for (const workspaceId of workspaceIds) await db.query("delete from workspace where id=$1", [workspaceId]);
    await db.query("delete from app_user where external_auth_id=any($1::text[])", [identities.map((id) => `internal-test:${id}`)]);
    await db.end();
  }
});
