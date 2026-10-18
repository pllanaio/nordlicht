import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { assertSameOrigin, readBoundedJson, uuidPattern, VideoRequestError } from "@/lib/video/validation";
import { videoError } from "@/lib/video/http";
import { enqueuePublication, getPublicationOptions, getPublicationStatuses, parsePublicationInput } from "@/lib/publishing/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new VideoRequestError("Video nicht gefunden.", 404);
    const result = new URL(request.url).searchParams.get("status") === "1"
      ? await getPublicationStatuses(entitlement, id)
      : await getPublicationOptions(entitlement, id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    assertSameOrigin(request);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new VideoRequestError("Video nicht gefunden.", 404);
    const key = request.headers.get("idempotency-key");
    if (!key || !uuidPattern.test(key)) throw new VideoRequestError("Ein gültiger Auftragsschlüssel ist erforderlich.");
    const input = parsePublicationInput(await readBoundedJson(request, 12_000));
    return NextResponse.json({ publication: await enqueuePublication(entitlement, id, input, key) }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}
