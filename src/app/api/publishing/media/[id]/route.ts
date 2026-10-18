import { getMediaDeliveryOrigin } from "@/lib/media-delivery/core.mjs";
import { getDatabasePool } from "@/lib/database";
import { uuidPattern } from "@/lib/video/validation";
import { verifyMediaSignature } from "@/lib/publishing/core.mjs";
import { parseMediaRange } from "@/lib/media-range";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Only the media attached to a currently processing Instagram publication can
// be fetched by its expiring, job-specific capability. No storage path input.
async function serve(request: Request, params: Promise<{ id: string }>, head: boolean) {
  try {
    const { id } = await params; const url = new URL(request.url);
    if (!uuidPattern.test(id) || !verifyMediaSignature(id, url.searchParams.get("expires") || "", url.searchParams.get("signature") || "")) return new Response(null, { status: 404 });
    const origin = getMediaDeliveryOrigin();
    if (origin) {
      const destination = new URL(`/api/publishing/media/${id}`, origin);
      destination.searchParams.set("expires", url.searchParams.get("expires")!);
      destination.searchParams.set("signature", url.searchParams.get("signature")!);
      return new Response(null, { status: 307, headers: { Location: destination.toString(), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
    if (process.env.VERCEL) return new Response(null, { status: 503 });
    const result = await getDatabasePool().query<{ content: Buffer }>(`select m.content from video_publication p
      join video_job j on j.id = p.video_job_id and j.workspace_id = p.workspace_id
      join media_asset m on m.id = j.media_asset_id and m.workspace_id = p.workspace_id
      where p.id = $1 and p.provider = 'instagram' and p.status = 'processing' and j.status = 'completed'
        and m.content_type = 'video/mp4' and m.content is not null`, [id]);
    const data = result.rows[0]?.content; if (!data) return new Response(null, { status: 404 });
    const headers = new Headers({ "Content-Type": "video/mp4", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    const range = parseMediaRange(request.headers.get("range"), data.length);
    if (range === false) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}`, "Cache-Control": "private, no-store" } });
    const start = range?.start ?? 0, end = range?.end ?? data.length - 1, status = range ? 206 : 200;
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(head ? null : new Uint8Array(data.subarray(start, end + 1)), { status, headers });
  } catch { return new Response(null, { status: 404 }); }
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { return serve(request, params, false); }
export async function HEAD(request: Request, { params }: { params: Promise<{ id: string }> }) { return serve(request, params, true); }
