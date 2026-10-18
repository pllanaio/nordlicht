import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext } from "@/lib/workspace-store";
import { getMediaDeliveryOrigin, signedAssetUrl } from "@/lib/media-delivery/core.mjs";
import { parseMediaRange } from "@/lib/media-range";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Medium nicht gefunden." }, { status: 404 });

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const result = await client.query<{ size: number; contentType: string }>(
      `select octet_length(content) as size, content_type as "contentType" from media_asset
        where id = $1 and workspace_id = $2 and content is not null`,
      [id, context.workspaceId],
    );
    const asset = result.rows[0];
    if (!asset) {
      await client.query("commit");
      return NextResponse.json({ error: "Medium nicht gefunden." }, { status: 404 });
    }
    if (getMediaDeliveryOrigin()) {
      const location = signedAssetUrl(id, context.workspaceId, new URL(request.url).searchParams.get("download") === "1");
      await client.query("commit");
      return new NextResponse(null, { status: 307, headers: { Location: location, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
    if (process.env.VERCEL && asset.contentType === "video/mp4") {
      await client.query("commit");
      return NextResponse.json({ error: "Der Mediendienst ist noch nicht eingerichtet." }, { status: 503 });
    }
    const range = parseMediaRange(request.headers.get("range"), asset.size);
    if (range === false) {
      await client.query("commit");
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${asset.size}`, "Cache-Control": "private, no-store" } });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? asset.size - 1;
    const content = request.method === "HEAD" ? null : (await client.query<{ content: Buffer }>(
      `select substring(content from $3::integer for $4::integer) as content
       from media_asset where id = $1 and workspace_id = $2`, [id, context.workspaceId, start + 1, end - start + 1],
    )).rows[0]?.content;
    await client.query("commit");
    return new NextResponse(content ? new Uint8Array(content) : null, {
      status: range ? 206 : 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": asset.contentType,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${asset.size}` } : {}),
        ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="contentdock-${id}.${asset.contentType === "video/mp4" ? "mp4" : "bin"}"` } : {}),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    console.error("Workspace media read failed", cause instanceof Error ? cause.message : "Unknown media error");
    return NextResponse.json({ error: "Medium konnte nicht geladen werden." }, { status: 500 });
  } finally {
    client.release();
  }
}

export const HEAD = GET;
