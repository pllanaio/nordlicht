import { NextResponse } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { cancelVideoJob, getVideoJob } from "@/lib/video/store";
import { assertSameOrigin, uuidPattern, VideoRequestError } from "@/lib/video/validation";
import { videoError } from "@/lib/video/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new VideoRequestError("Videoauftrag nicht gefunden.", 404);
    return NextResponse.json({ job: await getVideoJob(entitlement, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    assertSameOrigin(request);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new VideoRequestError("Videoauftrag nicht gefunden.", 404);
    return NextResponse.json({ job: await cancelVideoJob(entitlement, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return videoError(error); }
}
