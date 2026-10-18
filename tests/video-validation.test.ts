import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSameOrigin, parseVideoInput, readBoundedJson, VideoRequestError } from "../src/lib/video/validation";
import { parseMediaRange } from "../src/lib/media-range";

const valid = { topic: "Nordlichter in Norwegen", language: "de", voice: "nova", aspectRatio: "9:16", durationSeconds: 30, subtitles: true, credentialConsent: true };

test("video request rejects malformed/oversized values and missing credential consent", () => {
  for (const value of [null, [], { ...valid, credentialConsent: false }, { ...valid, topic: "a" }, { ...valid, topic: "a".repeat(1001) }, { ...valid, script: "a".repeat(4001) }, { ...valid, durationSeconds: "30" }, { ...valid, language: "xx" }, { ...valid, voice: "../../../tmp" }, { ...valid, subtitles: "yes" }]) {
    assert.throws(() => parseVideoInput(value), VideoRequestError);
  }
  const parsed = parseVideoInput({ ...valid, topic: "  Nordlicht  ", script: "  Hallo  ", workspaceId: "attacker", apiKey: "must-not-persist" });
  assert.equal(parsed.topic, "Nordlicht");
  assert.equal(parsed.script, "Hallo");
  assert.equal("workspaceId" in parsed, false);
  assert.equal("apiKey" in parsed, false);
});

test("mutations require trusted same-origin browser request", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://contentdock.test";
  try {
    assert.doesNotThrow(() => assertSameOrigin(new Request("http://proxy:3000/api/video/jobs", { headers: { origin: "https://contentdock.test" } })));
    const cases: HeadersInit[] = [{}, { origin: "https://evil.test" }, { origin: "https://contentdock.test", "sec-fetch-site": "cross-site" }];
    for (const headers of cases) {
      assert.throws(() => assertSameOrigin(new Request("https://contentdock.test/api/video/jobs", { headers })), VideoRequestError);
    }
  } finally { if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous; }
});

test("bounded JSON rejects oversized chunked bodies without trusting content-length", async () => {
  const request = new Request("https://contentdock.test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ huge: "x".repeat(100) }) });
  await assert.rejects(readBoundedJson(request, 20), (error: unknown) => error instanceof VideoRequestError && error.status === 413);
  await assert.rejects(readBoundedJson(new Request("https://contentdock.test", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), VideoRequestError);
});

test("MP4 seeking handles bounded, open and suffix ranges without cross-file offsets", () => {
  assert.deepEqual(parseMediaRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(parseMediaRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseMediaRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(parseMediaRange("bytes=0-999", 100), { start: 0, end: 99 });
  for (const range of ["bytes=100-", "bytes=9-1", "bytes=-0", "bytes=0-1,3-5", "bytes=-", "bytes=999999999999999999999999-"]) assert.equal(parseMediaRange(range, 100), false);
});
