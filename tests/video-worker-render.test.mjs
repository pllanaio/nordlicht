import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateVideo } from "../scripts/video/pipeline.mjs";
import { DIMENSIONS, probeMedia, runProgram } from "../scripts/video/render.mjs";

const input = { topic: "Nordlichter", language: "de", voice: "nova", aspectRatio: "9:16", durationSeconds: 30, subtitles: true };
const ffmpegAvailable = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

test("offline pipeline renders real MP4 with narration, captions and all three aspect ratios", { skip: !ffmpegAvailable, timeout: 120_000 }, async () => {
  const fixtures = await mkdtemp(join(tmpdir(), "contentdock-video-test-"));
  const stages = [];
  let temporaryDirectory;
  try {
    await runProgram("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=24", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "fixture.mp4"], { cwd: fixtures });
    await runProgram("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libmp3lame", "voice.mp3"], { cwd: fixtures });
    const providers = {
      script: async () => ({ script: "Hallo Welt.", searchTerms: ["northern lights"] }),
      voice: async () => readFile(join(fixtures, "voice.mp3")),
      stock: async () => [{ url: "fixture", source: { id: "1", url: "https://www.pexels.com/video/fixture-1/", author: "Fixture" } }],
      download: async (_url, destination) => { temporaryDirectory = dirname(destination); await copyFile(join(fixtures, "fixture.mp4"), destination); return 1024; },
      transcribe: async () => ({ words: [{ word: "Hallo", start: 0, end: 0.4 }, { word: "Welt.", start: 0.4, end: 0.9 }] }),
    };
    for (const aspectRatio of ["9:16", "16:9", "1:1"]) {
      const result = await generateVideo({ ...input, aspectRatio, subtitles: aspectRatio !== "1:1" }, { providers, onProgress: async (stage) => stages.push(stage) });
      assert.ok(result.content.length > 1000);
      assert.equal(result.sources[0].author, "Fixture");
      if (aspectRatio !== "1:1") assert.match(result.subtitleSrt, /Hallo Welt/);
      else assert.equal(result.subtitleSrt, "");
      await writeFile(join(fixtures, "result.mp4"), result.content);
      const metadata = await probeMedia("result.mp4", { cwd: fixtures });
      const video = metadata.streams.find((stream) => stream.codec_type === "video");
      assert.deepEqual([video.width, video.height], DIMENSIONS[aspectRatio]);
      assert.ok(metadata.streams.some((stream) => stream.codec_type === "audio"));
      assert.ok(Math.abs(metadata.duration - 1) < 0.2);
      await assert.rejects(access(temporaryDirectory));
    }
    assert.ok(["script", "voice", "stock", "subtitles", "render"].every((stage) => stages.includes(stage)));
  } finally { await rm(fixtures, { recursive: true, force: true }); }
});

test("provider failure removes the entire temporary work directory", async () => {
  let temporaryDirectory;
  const providers = {
    script: async () => ({ script: "test", searchTerms: ["forest"] }), voice: async () => Buffer.from("audio"),
    stock: async () => [{ url: "fixture", source: {} }],
    download: async (_url, destination) => { temporaryDirectory = dirname(destination); await writeFile(destination, "partial"); throw new Error("simulated failure"); },
  };
  await assert.rejects(generateVideo(input, { providers, probe: async () => ({ duration: 1, streams: [{ codec_type: "audio" }] }) }), /simulated failure/);
  await assert.rejects(access(temporaryDirectory));
});

test("cancellation between pipeline stages stops before the next paid request", async () => {
  const controller = new AbortController();
  let voiceCalled = false;
  const providers = { script: async () => ({ script: "test", searchTerms: ["forest"] }), voice: async () => { voiceCalled = true; return Buffer.from("audio"); } };
  await assert.rejects(generateVideo(input, { providers, signal: controller.signal, onProgress: async (stage) => { if (stage === "voice") controller.abort(); } }), { name: "AbortError" });
  assert.equal(voiceCalled, false);
});
