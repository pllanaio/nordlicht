import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";

const allowedTools = new Set(["caption", "hashtags", "hooks", "repurpose", "industry_ideas"]);

type GenerateRequest = {
  tool?: string;
  prompt?: string;
  channel?: string;
  tone?: string;
};

function readOutputText(data: unknown): string {
  if (!data || typeof data !== "object" || !("output" in data) || !Array.isArray(data.output)) return "";
  for (const item of data.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  const entitlement = await getSubscriptionEntitlement();
  const isDemoRequest = request.headers.get("x-contentdock-mode") === "demo";
  const personalApiKey = request.headers.get("x-ai-key")?.trim();
  if (!entitlement && !isDemoRequest) return NextResponse.json({ error: "Für diesen Zugriff ist ein aktives Abo erforderlich." }, { status: 403 });
  if (!personalApiKey) return NextResponse.json({ error: "Für KI-Funktionen ist dein persönlicher API-Key erforderlich." }, { status: 400 });

  const body = (await request.json()) as GenerateRequest;
  const tool = allowedTools.has(body.tool ?? "") ? body.tool : "caption";
  const prompt = body.prompt?.trim().slice(0, 3_000);
  if (!prompt) return NextResponse.json({ error: "Bitte beschreibe zuerst das gewünschte Thema." }, { status: 400 });

  const toolInstruction: Record<string, string> = {
    caption: "Erstelle eine veröffentlichungsreife Caption und fünf passende Hashtags.",
    hashtags: "Erstelle einen strategischen Mix aus acht breiten, Nischen- und Marken-Hashtags und erkläre den Mix kurz.",
    hooks: "Erstelle fünf starke, unterschiedliche Einstiege für einen Social-Media-Beitrag. Hashtags sind optional.",
    repurpose: "Übertrage die Idee in konkrete Formate für Instagram, TikTok, LinkedIn und YouTube.",
    industry_ideas: "Erstelle fünf konkrete Content-Ideen für die genannte Branche und Zielgruppe, inklusive passender Hashtags und kurzer Begründung.",
  };

  const providerResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${personalApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        { role: "developer", content: "Du bist ein präziser deutschsprachiger Social-Media-Stratege. Antworte ausschließlich als valides JSON mit title (string), content (string) und hashtags (array mit strings). Erfinde keine Performance-Zahlen oder Plattformfakten." },
        { role: "user", content: `${toolInstruction[tool ?? "caption"]} Plattform: ${body.channel ?? "plattformübergreifend"}. Ton: ${body.tone ?? "klar und nahbar"}. Thema: ${prompt}` },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!providerResponse.ok) {
    const providerError = await providerResponse.text();
    console.error("AI provider error", providerResponse.status, providerError.slice(0, 400));
    return NextResponse.json({ error: "Der KI-Provider hat die Anfrage abgelehnt. Bitte API-Key und Guthaben prüfen." }, { status: providerResponse.status });
  }

  const raw = readOutputText((await providerResponse.json()) as unknown);
  try {
    const parsed = JSON.parse(raw) as { title?: unknown; content?: unknown; hashtags?: unknown };
    if (typeof parsed.title !== "string" || typeof parsed.content !== "string" || !Array.isArray(parsed.hashtags)) throw new Error("Invalid output shape");
    return NextResponse.json({ title: parsed.title, content: parsed.content, hashtags: parsed.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 12) });
  } catch {
    return NextResponse.json({ error: "Die KI-Antwort hatte nicht das erwartete Format. Bitte erneut versuchen." }, { status: 502 });
  }
}
