import { NextResponse } from "next/server";

type CaptionRequest = {
  title?: string;
  channel?: string;
  tone?: string;
};

function readOutputText(data: unknown): string {
  if (!data || typeof data !== "object" || !("output" in data) || !Array.isArray(data.output)) return "";
  for (const item of data.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-ai-key") ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Kein API-Key übergeben." }, { status: 400 });

  const body = (await request.json()) as CaptionRequest;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "developer",
          content: "Du bist ein präziser deutschsprachiger Social-Media-Editor. Antworte ausschließlich als valides JSON mit caption (string) und hashtags (array mit 5 strings). Keine erfundenen Fakten.",
        },
        {
          role: "user",
          content: `Erstelle eine Caption für ${body.channel ?? "Social Media"}. Arbeitstitel: ${body.title ?? "Behind the Scenes"}. Ton: ${body.tone ?? "klar und nahbar"}.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Caption provider error", response.status, errorBody.slice(0, 400));
    return NextResponse.json({ error: "Der KI-Provider hat die Anfrage abgelehnt. Bitte Key und Guthaben prüfen." }, { status: response.status });
  }

  const data = (await response.json()) as unknown;
  const raw = readOutputText(data);
  try {
    const parsed = JSON.parse(raw) as { caption?: unknown; hashtags?: unknown };
    if (typeof parsed.caption !== "string" || !Array.isArray(parsed.hashtags)) throw new Error("Invalid output shape");
    return NextResponse.json({ caption: parsed.caption, hashtags: parsed.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 8) });
  } catch {
    return NextResponse.json({ error: "Die KI-Antwort hatte nicht das erwartete Format. Bitte erneut versuchen." }, { status: 502 });
  }
}
