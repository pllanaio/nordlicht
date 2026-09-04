import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext } from "@/lib/workspace-store";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Medium nicht gefunden." }, { status: 404 });

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const result = await client.query<{ content: Buffer; contentType: string }>(
      `select content, content_type as "contentType" from media_asset
        where id = $1 and workspace_id = $2 and content is not null`,
      [id, context.workspaceId],
    );
    await client.query("commit");
    const asset = result.rows[0];
    if (!asset) return NextResponse.json({ error: "Medium nicht gefunden." }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.content), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": asset.contentType,
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
