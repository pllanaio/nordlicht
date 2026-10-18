import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAbort, VideoError } from "./errors.mjs";
import { MAX_AUDIO_BYTES, MAX_CLIP_BYTES, validateInput, validateScript } from "./providers.mjs";
import { MAX_OUTPUT_BYTES, probeMedia, renderVideo, transcriptToSrt } from "./render.mjs";

export async function generateVideo(input, { providers, signal, onProgress = async () => {}, renderer = renderVideo, probe = probeMedia } = {}) {
  validateInput(input);
  checkAbort(signal);
  const directory = await mkdtemp(join(tmpdir(), "contentdock-video-"));
  const progress = async (stage, percentage, details = {}) => {
    checkAbort(signal);
    await onProgress(stage, percentage, details);
    checkAbort(signal);
  };
  try {
    await progress("script", 5);
    const scriptResult = validateScript(await providers.script(input, signal));
    // A supplied narration remains the source of truth even if a model rewrites it.
    const script = input.script?.trim() || scriptResult.script;
    const searchTerms = scriptResult.searchTerms;
    await progress("voice", 20, { script, searchTerms });
    const audio = await providers.voice(script, input.voice, signal);
    if (!Buffer.isBuffer(audio) || !audio.length || audio.length > MAX_AUDIO_BYTES) throw new VideoError("invalid_audio", "Die Sprecheraufnahme hat eine ungültige Größe.");
    const audioPath = join(directory, "narration.mp3");
    await writeFile(audioPath, audio, { mode: 0o600 });
    const metadata = await probe("narration.mp3", { cwd: directory, signal });
    if (!metadata.streams.some((stream) => stream.codec_type === "audio") || metadata.duration > 180) throw new VideoError("voice_too_long", "Die Sprecheraufnahme ist zu lang. Bitte kürze das Skript auf höchstens drei Minuten.");
    await progress("stock", 35);
    const clips = await providers.stock(searchTerms, input.aspectRatio, signal);
    if (!Array.isArray(clips) || !clips.length || clips.length > 6) throw new VideoError("no_stock", "Es wurden keine verwendbaren Stockvideos gefunden.");
    let downloadBytes = 0;
    for (let i = 0; i < clips.length; i += 1) {
      checkAbort(signal);
      downloadBytes += await providers.download(clips[i].url, join(directory, `clip-${i}.mp4`), { signal });
      if (downloadBytes > 4 * MAX_CLIP_BYTES) throw new VideoError("stock_too_large", "Die Stockvideos überschreiten das Größenlimit.");
      await progress("stock", 35 + Math.round((i + 1) / clips.length * 20));
    }
    const sources = clips.map((clip) => clip.source);
    let subtitleSrt = "";
    if (input.subtitles) {
      await progress("subtitles", 60, { sources });
      const transcript = await providers.transcribe(audioPath, input.language, signal);
      subtitleSrt = transcriptToSrt(transcript, metadata.duration, input.aspectRatio);
      await writeFile(join(directory, "captions.srt"), subtitleSrt, { mode: 0o600 });
    }
    await progress("render", 75, { sources, subtitleSrt });
    const result = await renderer({ directory, clipCount: clips.length, duration: metadata.duration, aspectRatio: input.aspectRatio, subtitles: input.subtitles, signal });
    checkAbort(signal);
    if (result.bytes > MAX_OUTPUT_BYTES) throw new VideoError("output_too_large", "Das fertige Video überschreitet das Größenlimit.");
    const content = await readFile(result.path);
    if (content.length > MAX_OUTPUT_BYTES) throw new VideoError("output_too_large", "Das fertige Video überschreitet das Größenlimit.");
    return { content, width: result.width, height: result.height, duration: result.duration, script, searchTerms, sources, subtitleSrt };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
