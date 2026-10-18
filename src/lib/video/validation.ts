import type { VideoInput } from "./types";

export class VideoRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseVideoInput(value: unknown): VideoInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VideoRequestError("Ungültige Video-Anfrage.");
  const input = value as Record<string, unknown>;
  if (typeof input.topic !== "string" || input.topic.trim().length < 3 || input.topic.length > 1_000) {
    throw new VideoRequestError("Das Thema muss zwischen 3 und 1000 Zeichen lang sein.");
  }
  if (input.script !== undefined && (typeof input.script !== "string" || input.script.length > 4_000)) {
    throw new VideoRequestError("Das Skript darf höchstens 4000 Zeichen enthalten.");
  }
  if (input.language !== "de" && input.language !== "en") throw new VideoRequestError("Bitte Deutsch oder Englisch auswählen.");
  if (!["alloy", "nova", "onyx", "shimmer"].includes(String(input.voice))) throw new VideoRequestError("Ungültige Sprecherstimme.");
  if (!["9:16", "16:9", "1:1"].includes(String(input.aspectRatio))) throw new VideoRequestError("Ungültiges Videoformat.");
  if (![30, 60, 90].includes(input.durationSeconds as number)) throw new VideoRequestError("Bitte 30, 60 oder 90 Sekunden auswählen.");
  if (typeof input.subtitles !== "boolean") throw new VideoRequestError("Bitte die Untertitel-Einstellung auswählen.");
  if (input.credentialConsent !== true) throw new VideoRequestError("Bitte der vorübergehenden verschlüsselten Speicherung des API-Keys zustimmen.");
  return {
    topic: input.topic.trim(), script: (input.script as string | undefined)?.trim() || undefined,
    language: input.language, voice: input.voice as VideoInput["voice"],
    aspectRatio: input.aspectRatio as VideoInput["aspectRatio"], durationSeconds: input.durationSeconds as VideoInput["durationSeconds"],
    subtitles: input.subtitles,
  };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new VideoRequestError("Diese Anfrage muss aus deinem ContentDock-Workspace kommen.", 403);
  }
}

export async function readBoundedJson(request: Request, maximumBytes = 40_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new VideoRequestError("JSON-Anfrage erforderlich.", 415);
  }
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > maximumBytes) throw new VideoRequestError("Anfrage zu groß.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new VideoRequestError("Anfragedaten fehlen.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); throw new VideoRequestError("Anfrage zu groß.", 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new VideoRequestError("Ungültiges JSON."); }
}
