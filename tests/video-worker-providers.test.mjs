import assert from "node:assert/strict";
import test from "node:test";
import { createProviders, downloadClip, publicIpv4, safePexelsUrl, validateInput, validateScript } from "../scripts/video/providers.mjs";
import { transcriptToSrt } from "../scripts/video/render.mjs";
import { publicError } from "../scripts/video/errors.mjs";

const input = { topic: "Nordlichter", language: "de", voice: "nova", aspectRatio: "9:16", durationSeconds: 30, subtitles: true };

test("worker validates all bounded input fields before using providers", () => {
  assert.equal(validateInput(input), input);
  for (const changed of [{ topic: "" }, { topic: "x".repeat(1001) }, { script: "x".repeat(4001) }, { durationSeconds: 3600 }, { aspectRatio: "../../tmp" }, { voice: "$(whoami)" }, { subtitles: "false" }, { language: "xx" }]) {
    assert.throws(() => validateInput({ ...input, ...changed }), { code: "invalid_input" });
  }
  assert.throws(() => validateScript({ script: "test", searchTerms: ["https://127.0.0.1"] }), { code: "invalid_script" });
  assert.throws(() => validateScript({ script: "test", searchTerms: ["forest"], command: "whoami" }), { code: "invalid_script" });
});

test("stock download allowlist rejects credentials, redirects to other hosts, local IPs and non-MP4 paths", async () => {
  assert.equal(safePexelsUrl("https://videos.pexels.com/video-files/123/123-hd.mp4"), "https://videos.pexels.com/video-files/123/123-hd.mp4");
  for (const url of ["http://videos.pexels.com/a.mp4", "https://videos.pexels.com.evil.test/a.mp4", "https://videos.pexels.com@127.0.0.1/a.mp4", "https://u:p@videos.pexels.com/a.mp4", "https://videos.pexels.com:444/a.mp4", "file:///etc/passwd", "https://videos.pexels.com/a.m3u8", "https://127.0.0.1/a.mp4"]) assert.equal(safePexelsUrl(url), null);
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.1.1.1", "::1", "::ffff:127.0.0.1", "192.0.2.1"]) assert.equal(publicIpv4(ip), false, ip);
  assert.equal(publicIpv4("8.8.8.8"), true);
  await assert.rejects(downloadClip("https://videos.pexels.com/a.mp4", "/unused", { resolve: async () => [{ address: "127.0.0.1", family: 4 }] }), { code: "unsafe_stock_address" });
});

test("provider script uses strict schema, preserves supplied narration and never follows redirects", async () => {
  const calls = [];
  const providers = createProviders({ apiKey: "test-key", pexelsKey: "test-pexels", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ script: "rewritten", searchTerms: ["northern lights", "night sky"] }) } }] });
  } });
  const result = await providers.script({ ...input, script: "Mein eigenes Skript." });
  assert.equal(result.script, "Mein eigenes Skript.");
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(JSON.parse(calls[0].options.body).response_format.json_schema.strict, true);
});

test("provider errors exclude credentials and response body", async () => {
  const providers = createProviders({ apiKey: "secret-key", pexelsKey: "secret-stock", fetchImpl: async () => new Response("secret-key secret-stock diagnostic", { status: 401 }) });
  await assert.rejects(providers.script(input), (error) => {
    assert.equal(error.code, "provider_auth");
    assert.doesNotMatch(error.message, /secret|diagnostic/);
    return true;
  });
  assert.doesNotMatch(publicError(new Error("password=secret")).message, /password|secret/);
});

test("provider response byte limits are enforced before parsing JSON", async () => {
  const providers = createProviders({ apiKey: "test", pexelsKey: "test", fetchImpl: async () => new Response("{}", { headers: { "content-length": String(3 * 1024 * 1024) } }) });
  await assert.rejects(providers.script(input), { code: "response_too_large" });
});

test("stock search selects safe MP4 files and canonical provenance only", async () => {
  const providers = createProviders({ apiKey: "test", pexelsKey: "test", fetchImpl: async () => Response.json({ videos: [
    { id: 1, duration: 10, url: "https://www.pexels.com/video/test-1/", user: { name: "Artist", url: "https://www.pexels.com/@artist/" }, video_files: [{ file_type: "video/mp4", width: 1080, height: 1920, link: "http://127.0.0.1/internal.mp4" }] },
    { id: 2, duration: 10, url: "https://www.pexels.com/video/test-2/", user: { name: "Artist", url: "https://www.pexels.com/@artist/" }, video_files: [{ file_type: "video/mp4", width: 1080, height: 1920, link: "https://videos.pexels.com/video-files/2/a.mp4" }] },
  ] }) });
  const result = await providers.stock(["forest", "sky"], "9:16");
  assert.equal(result.length, 1);
  assert.equal(result[0].source.id, "2");
  assert.equal(result[0].source.author, "Artist");
  assert.equal(result[0].source.authorUrl, "https://www.pexels.com/@artist/");
});

test("word timestamps produce bounded SRT and remove subtitle markup", () => {
  const srt = transcriptToSrt({ words: [
    { word: "Hallo", start: 0, end: 0.3 }, { word: "{\\an8}<b>Welt</b>", start: 0.3, end: 0.9 },
    { word: "Heute.", start: 1, end: 1.8 },
  ] }, 2, "9:16");
  assert.match(srt, /00:00:00,000 -->/);
  assert.doesNotMatch(srt.split("\n").filter((line) => !line.includes(" --> ")).join("\n"), /[<>{}\\]/);
  assert.match(srt, /Hallo Welt/);
  assert.throws(() => transcriptToSrt({ words: [{ word: "bad", start: -1, end: 2 }] }, 2, "9:16"), { code: "invalid_subtitles" });
  assert.throws(() => transcriptToSrt({ words: [{ word: "bad", start: 0, end: 2000 }] }, 2, "9:16"), { code: "invalid_subtitles" });
});
