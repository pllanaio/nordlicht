import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { VideoQueue } from "../scripts/video/queue.mjs";

// Opt in with a disposable PostgreSQL database. Each run creates and drops its
// own schema; it never reads or changes application workspace/job rows.
test("PostgreSQL queue claims exclusively, expires credentials and commits media atomically", { skip: !process.env.VIDEO_TEST_DATABASE_URL, timeout: 30_000 }, async () => {
  const schema = `video_worker_test_${randomUUID().replaceAll("-", "")}`;
  const clients = [0, 1].map(() => new Client({ connectionString: process.env.VIDEO_TEST_DATABASE_URL }));
  const workspaceId = randomUUID();
  const userId = randomUUID();
  try {
    await Promise.all(clients.map((client) => client.connect()));
    await clients[0].query(`create schema ${schema}`);
    await Promise.all(clients.map((client) => client.query(`set search_path to ${schema}`)));
    for (const file of ["001_initial.sql", "002_video_jobs.sql"]) await clients[0].query(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), "utf8"));
    await clients[0].query("insert into app_user(id, external_auth_id, email, display_name, first_name, last_name) values ($1::uuid, $1::text, 'worker@example.test', 'Worker', 'Worker', 'Test')", [userId]);
    await clients[0].query("insert into workspace(id, name, slug) values ($1, 'Worker test', 'worker-test')", [workspaceId]);
    const queues = clients.map((client) => new VideoQueue(client));
    const insert = async () => {
      const id = randomUUID();
      await clients[0].query(`insert into video_job(id, workspace_id, created_by, idempotency_key, request_hash, input, encrypted_api_key)
        values ($1, $2, $3, $1, 'test-hash', '{"topic":"Test video"}', $4)`, [id, workspaceId, userId, Buffer.from("encrypted-test-value")]);
      return id;
    };
    await Promise.all([insert(), insert()]);
    const claimed = await Promise.all(queues.map((queue) => queue.claim()));
    assert.ok(claimed[0] && claimed[1]);
    assert.notEqual(claimed[0].id, claimed[1].id);
    assert.notEqual(claimed[0].lease_token, claimed[1].lease_token);
    assert.equal(claimed[0].attempts, 1);
    assert.equal(await queues[0].claim(), null);
    assert.equal(await queues[0].renew(claimed[0]), true);
    await clients[0].query("update video_job set status='canceled', encrypted_api_key=null, lease_token=null, lease_expires_at=null where id=$1", [claimed[0].id]);
    assert.equal(await queues[0].renew(claimed[0]), false);
    await assert.rejects(queues[0].complete(claimed[0], {}), { code: "lease_lost" });
    assert.equal((await clients[0].query("select count(*)::int as count from media_asset")).rows[0].count, 0);
    await clients[0].query("update video_job set lease_expires_at=now()-interval '1 minute' where id=$1", [claimed[1].id]);
    const expired = await insert();
    await clients[0].query("update video_job set expires_at=now()-interval '1 minute' where id=$1", [expired]);
    await queues[0].expire();
    const terminal = await clients[0].query("select status, encrypted_api_key from video_job where id=any($1::uuid[])", [[expired, claimed[1].id]]);
    assert.ok(terminal.rows.every((row) => row.status === "failed" && row.encrypted_api_key === null));
    assert.equal(await queues[0].claim(), null, "expired processing jobs must not be retried and charged again");
    const completedId = await insert();
    const completion = await queues[0].claim();
    assert.equal(completion.id, completedId);
    await queues[0].progress(completion, "render", 75, { script: "Hallo", searchTerms: ["forest"], sources: [] });
    const assetId = await queues[0].complete(completion, { content: Buffer.from("offline-fixture"), width: 1080, height: 1920, duration: 1, script: "Hallo", searchTerms: ["forest"], sources: [], subtitleSrt: "" });
    const complete = (await clients[0].query("select status, progress, media_asset_id, encrypted_api_key, lease_token from video_job where id=$1", [completedId])).rows[0];
    assert.deepEqual(complete, { status: "completed", progress: 100, media_asset_id: assetId, encrypted_api_key: null, lease_token: null });
    const asset = (await clients[0].query("select workspace_id, created_by, content_type, bytes::int, duration_ms from media_asset where id=$1", [assetId])).rows[0];
    assert.deepEqual(asset, { workspace_id: workspaceId, created_by: userId, content_type: "video/mp4", bytes: 15, duration_ms: 1000 });
    await assert.rejects(queues[0].complete(completion, {}), { code: "lease_lost" });
    assert.equal((await clients[0].query("select count(*)::int as count from media_asset")).rows[0].count, 1);
    await queues[0].heartbeat("test-worker");
    assert.equal((await clients[0].query("select id from video_worker")).rows[0].id, "test-worker");
  } finally {
    await clients[0].query(`drop schema if exists ${schema} cascade`).catch(() => undefined);
    await Promise.allSettled(clients.map((client) => client.end()));
  }
});
