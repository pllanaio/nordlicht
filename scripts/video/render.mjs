import { spawn } from "node:child_process";
import { stat, writeFile } from "node:fs/promises";
import { VideoError, checkAbort } from "./errors.mjs";

export const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
export const DIMENSIONS = { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1080, 1080] };

export async function runProgram(command, args, { cwd, signal, timeoutMs = 180_000 } = {}) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    // Neither user text nor provider URLs are ever interpolated into a shell.
    // Child processes do not inherit API keys or database credentials.
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, LANG: "C.UTF-8" } });
    let output = "";
    let failed;
    const stop = (error) => { failed ??= error; child.kill("SIGKILL"); };
    const timer = setTimeout(() => stop(new VideoError("render_timeout", "Die Video-Verarbeitung hat das Zeitlimit erreicht.")), timeoutMs);
    const onAbort = () => stop(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      if (output.length + chunk.length > 128 * 1024) stop(new VideoError("render_output", "Die Video-Verarbeitung hat zu viele Metadaten geliefert."));
      else output += chunk.toString("utf8");
    });
    child.stderr.resume();
    child.once("error", () => { failed = new VideoError("render_unavailable", "Die Video-Verarbeitung ist nicht verfügbar."); });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (failed) reject(failed);
      else if (code !== 0) reject(new VideoError("render_failed", "Eine Mediendatei konnte nicht verarbeitet werden."));
      else resolve(output);
    });
    if (signal?.aborted) onAbort();
  });
}

const inputLimits = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,mp3,wav", "-max_alloc", "134217728", "-threads", "2"];

export async function probeMedia(filename, { cwd, signal } = {}) {
  const output = await runProgram("ffprobe", ["-v", "error", ...inputLimits, "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", filename], { cwd, signal, timeoutMs: 20_000 });
  let result;
  try { result = JSON.parse(output); }
  catch { throw new VideoError("invalid_media", "Eine Mediendatei konnte nicht geprüft werden."); }
  const duration = Number(result.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Array.isArray(result.streams) || result.streams.length > 8) throw new VideoError("invalid_media", "Eine Mediendatei hat ungültige Abmessungen oder Laufzeit.");
  if (result.streams.some((stream) => stream.codec_type === "video" && (!Number.isInteger(stream.width) || !Number.isInteger(stream.height) || stream.width < 1 || stream.height < 1 || stream.width > 4096 || stream.height > 4096))) throw new VideoError("invalid_media", "Eine Mediendatei überschreitet die erlaubte Auflösung.");
  return { duration, streams: result.streams };
}

function captionText(text) {
  return text.replace(/\{[^}]*\}|<[^>]*>/g, "").replace(/[<>\\{}\u0000-\u001f\u007f]/g, " ").replace(/-->/g, " ").replace(/\s+/g, " ").trim();
}

function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

export function transcriptToSrt(transcript, duration, aspectRatio) {
  const words = transcript?.words;
  if (!Array.isArray(words) || !words.length || words.length > 1200) throw new VideoError("invalid_subtitles", "Es konnten keine zeitlich passenden Untertitel erstellt werden.");
  const maxCharacters = aspectRatio === "9:16" ? 24 : 40;
  const cues = [];
  let pending = [];
  let lastStart = 0;
  const flush = () => {
    if (!pending.length) return;
    const start = pending[0].start;
    const end = Math.min(duration, Math.max(start + 0.08, pending.at(-1).end));
    if (end > start) cues.push({ start, end, text: pending.map((word) => word.text).join(" ") });
    pending = [];
  };
  for (const word of words) {
    if (typeof word?.word !== "string" || word.word.length > 200 || !Number.isFinite(word.start) || !Number.isFinite(word.end)
      || word.start < 0 || word.end < word.start || word.start < lastStart || word.start > duration + 1 || word.end > duration + 2) throw new VideoError("invalid_subtitles", "Die Untertitel enthalten ungültige Zeitangaben.");
    lastStart = word.start;
    const text = captionText(word.word);
    if (!text || word.start >= duration) continue;
    if (pending.length && (pending.length >= 6 || pending.map((item) => item.text).join(" ").length + text.length + 1 > maxCharacters || word.start - pending.at(-1).end > 0.7)) flush();
    pending.push({ start: word.start, end: word.end, text });
    if (/[.!?]$/.test(text)) flush();
  }
  flush();
  if (!cues.length) throw new VideoError("invalid_subtitles", "Es konnten keine Untertitel erstellt werden.");
  return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join("\n");
}

export async function renderVideo({ directory, clipCount, duration, aspectRatio, subtitles, signal }) {
  const [width, height] = DIMENSIONS[aspectRatio] ?? [];
  if (!width || !Number.isInteger(clipCount) || clipCount < 1 || clipCount > 6 || !Number.isFinite(duration) || duration <= 0 || duration > 180) throw new VideoError("invalid_render", "Die Render-Einstellungen sind ungültig.");
  const segmentDuration = duration / clipCount;
  for (let i = 0; i < clipCount; i += 1) {
    const filename = `clip-${i}.mp4`;
    const metadata = await probeMedia(filename, { cwd: directory, signal });
    if (!metadata.streams.some((stream) => stream.codec_type === "video")) throw new VideoError("invalid_media", "Eine Stockdatei enthält keine Videospur.");
    await runProgram("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...inputLimits,
      "-stream_loop", "-1", "-i", filename, "-map", "0:v:0", "-an", "-sn", "-dn", "-t", segmentDuration.toFixed(3),
      "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=24`,
      "-c:v", "libx264", "-threads", "2", "-filter_threads", "1", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-map_metadata", "-1", "-fs", String(MAX_OUTPUT_BYTES), `segment-${i}.mp4`,
    ], { cwd: directory, signal });
  }
  await writeFile(`${directory}/segments.txt`, Array.from({ length: clipCount }, (_, index) => `file 'segment-${index}.mp4'`).join("\n"), { mode: 0o600 });
  const filter = subtitles ? ["-vf", "subtitles=filename=captions.srt:force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.2,Shadow=0,Alignment=2,MarginV=24'"] : [];
  await runProgram("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-f", "concat", "-safe", "1", "-i", "segments.txt",
    ...inputLimits, "-i", "narration.mp3", "-map", "0:v:0", "-map", "1:a:0", ...filter,
    "-c:v", ...(subtitles ? ["libx264", "-threads", "2", "-filter_threads", "1", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p"] : ["copy"]),
    "-c:a", "aac", "-b:a", "128k", "-t", duration.toFixed(3), "-shortest", "-movflags", "+faststart", "-map_metadata", "-1", "-fs", String(MAX_OUTPUT_BYTES), "output.mp4",
  ], { cwd: directory, signal, timeoutMs: 300_000 });
  const info = await stat(`${directory}/output.mp4`);
  if (info.size < 1 || info.size >= MAX_OUTPUT_BYTES) throw new VideoError("output_too_large", "Das fertige Video überschreitet das Größenlimit.");
  const finalMetadata = await probeMedia("output.mp4", { cwd: directory, signal });
  if (Math.abs(finalMetadata.duration - duration) > 1) throw new VideoError("incomplete_render", "Das Video konnte nicht vollständig gerendert werden.");
  return { path: `${directory}/output.mp4`, width, height, duration: finalMetadata.duration, bytes: info.size };
}
