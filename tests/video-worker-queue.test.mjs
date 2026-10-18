import assert from "node:assert/strict";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { decryptJobKey, processJob, VideoQueue } from "../scripts/video/queue.mjs";

const key = randomBytes(32);
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.from(`v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`);
}
function job() { return { id: randomUUID(), lease_token: randomUUID(), encrypted_api_key: encrypt("test-api-key"), expires_at: new Date(Date.now() + 60_000), input: {} }; }

test("temporary job keys use authenticated workspace-secret format and reject tampering", () => {
  assert.equal(decryptJobKey(encrypt("test-api-key"), key.toString("base64")), "test-api-key");
  assert.equal(decryptJobKey(encrypt("test-api-key"), randomBytes(32).toString("base64")), null);
  const encrypted = encrypt("test-api-key");
  encrypted[encrypted.length - 4] ^= 1;
  assert.equal(decryptJobKey(encrypted, key.toString("base64")), null);
  assert.equal(decryptJobKey(Buffer.from("v1.bad.bad.bad.extra"), key.toString("base64")), null);
});

test("completed jobs only publish after successful pipeline and clear local encrypted value", async () => {
  const current = job();
  const calls = [];
  const queue = { renew: async () => true, complete: async () => calls.push("complete"), fail: async () => calls.push("fail"), progress: async () => calls.push("progress") };
  const result = await processJob(queue, current, { encryptionKey: key.toString("base64"), providerFactory: ({ apiKey }) => { assert.equal(apiKey, "test-api-key"); return {}; }, pipeline: async (_input, options) => { await options.onProgress("voice", 20, {}); return {}; } });
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, ["progress", "complete"]);
  assert.equal(current.encrypted_api_key, null);
});

test("lease loss cancels work and prevents completion", async () => {
  const calls = [];
  const queue = { renew: async () => false, complete: async () => calls.push("complete"), fail: async (_job, error) => calls.push(error.code) };
  const result = await processJob(queue, job(), { encryptionKey: key.toString("base64"), providerFactory: () => ({}), leaseIntervalMs: 5,
    pipeline: async (_input, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(calls, ["lease_lost"]);
});

test("expired job key never reaches a provider", async () => {
  const current = { ...job(), expires_at: new Date(Date.now() - 10) };
  let providersCalled = false;
  const result = await processJob({ fail: async () => {}, renew: async () => true }, current, {
    encryptionKey: key.toString("base64"), providerFactory: () => { providersCalled = true; return {}; },
  });
  assert.equal(result.code, "key_expired");
  assert.equal(providersCalled, false);
});

test("canceled or stale jobs cannot create media at transactional completion", async () => {
  const statements = [];
  const queue = new VideoQueue({ query: async (sql) => { statements.push(sql); return { rowCount: 0, rows: [] }; } });
  await assert.rejects(queue.complete(job(), {}), { code: "lease_lost" });
  assert.equal(statements[0], "begin");
  assert.equal(statements.at(-1), "rollback");
  assert.ok(statements.every((sql) => !sql.includes("insert into media_asset")));
});
