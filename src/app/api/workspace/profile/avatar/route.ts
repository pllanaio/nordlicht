import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext } from "@/lib/workspace-store";

export const runtime = "nodejs";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumAvatarSize = 2 * 1024 * 1024;

export async function GET() {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const result = await client.query<{ content: Buffer; contentType: string }>(
      `select avatar_data as content, avatar_content_type as "contentType"
         from app_user where id = $1 and avatar_data is not null`,
      [context.userId],
    );
    await client.query("commit");
    const avatar = result.rows[0];
    if (!avatar) return NextResponse.json({ error: "Profilbild nicht gefunden." }, { status: 404 });
    return new NextResponse(new Uint8Array(avatar.content), {
      headers: { "Cache-Control": "private, max-age=3600", "Content-Type": avatar.contentType, "X-Content-Type-Options": "nosniff" },
    });
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    console.error("Avatar read failed", cause instanceof Error ? cause.message : "Unknown avatar error");
    return NextResponse.json({ error: "Profilbild konnte nicht geladen werden." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const formData = await request.formData();
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || !allowedContentTypes.has(avatar.type) || avatar.size < 1 || avatar.size > maximumAvatarSize) {
    return NextResponse.json({ error: "Das Profilbild muss JPG, PNG oder WebP und höchstens 2 MB groß sein." }, { status: 400 });
  }
  const content = Buffer.from(await avatar.arrayBuffer());
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    await client.query("update app_user set avatar_data = $2, avatar_content_type = $3 where id = $1", [context.userId, content, avatar.type]);
    await client.query("commit");
    return NextResponse.json({ avatarUrl: `/api/workspace/profile/avatar?v=${Date.now()}` });
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    console.error("Avatar upload failed", cause instanceof Error ? cause.message : "Unknown avatar error");
    return NextResponse.json({ error: "Das Profilbild konnte nicht gespeichert werden." }, { status: 500 });
  } finally {
    client.release();
  }
}
