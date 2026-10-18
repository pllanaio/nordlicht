import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { getVideoSubtitles } from "@/lib/video/store";
import { uuidPattern, VideoRequestError } from "@/lib/video/validation";
import { videoError } from "@/lib/video/http";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const entitlement = await getSubscriptionEntitlement();
    if (!entitlement) throw new VideoRequestError("Anmeldung erforderlich.", 401);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new VideoRequestError("Untertitel nicht gefunden.", 404);
    return new Response(await getVideoSubtitles(entitlement, id), { headers: {
      "Content-Type": "application/x-subrip; charset=utf-8", "Content-Disposition": `attachment; filename="contentdock-${id}.srt"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return videoError(error); }
}
