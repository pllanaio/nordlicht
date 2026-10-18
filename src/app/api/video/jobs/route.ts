import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { createVideoJob, listVideoJobs } from "@/lib/video/store";
import { assertSameOrigin, parseVideoInput, readBoundedJson, uuidPattern, VideoRequestError } from "@/lib/video/validation";
import { videoError } from "@/lib/video/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    return NextResponse.json(await listVideoJobs(entitlement), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}

export async function POST(request: Request) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    assertSameOrigin(request);
    const apiKey = request.headers.get("x-ai-key")?.trim();
    if (!apiKey || apiKey.length > 1024 || /\s/.test(apiKey)) throw new VideoRequestError("Bitte einen gültigen persönlichen OpenAI API-Key angeben.");
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !uuidPattern.test(idempotencyKey)) throw new VideoRequestError("Ein gültiger Auftragsschlüssel ist erforderlich.");
    const input = parseVideoInput(await readBoundedJson(request));
    return NextResponse.json({ job: await createVideoJob(entitlement, input, apiKey, idempotencyKey) }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}
