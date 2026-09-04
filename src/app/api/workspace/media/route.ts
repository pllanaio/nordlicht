import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/database";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext } from "@/lib/workspace-store";
import type { MediaAsset } from "@/lib/workspace-types";

export const runtime = "nodejs";

const allowedContentTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const maximumFileSize = 12 * 1024 * 1024;
const maximumFiles = 8;

function cleanFileName(value: string) {
  return value.replace(/\.[^/.]+$/, "").replace(/[\r\n]/g, " ").trim().slice(0, 160) || "Unbenanntes Medium";
}

export async function POST(request: Request) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length || files.length > maximumFiles) {
    return NextResponse.json({ error: `Bitte lade zwischen 1 und ${maximumFiles} Dateien gleichzeitig hoch.` }, { status: 400 });
  }
  if (files.some((file) => !allowedContentTypes.has(file.type) || file.size < 1 || file.size > maximumFileSize)) {
    return NextResponse.json({ error: "Unterstützt werden Bilder und Videos bis jeweils 12 MB." }, { status: 400 });
  }

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, entitlement);
    const assets: MediaAsset[] = [];
    for (const file of files) {
      const content = Buffer.from(await file.arrayBuffer());
      const id = randomUUID();
      await client.query(
        `insert into media_asset
           (id, workspace_id, storage_key, name, content_type, content, bytes, checksum_sha256, scan_status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'accepted', $9)`,
        [id, context.workspaceId, `database:${id}`, cleanFileName(file.name), file.type, content, content.length, createHash("sha256").update(content).digest("hex"), context.userId],
      );
      assets.push({
        id,
        name: cleanFileName(file.name),
        kind: file.type.startsWith("video/") ? "video" : "image",
        preview: `/api/workspace/media/${id}`,
        size: content.length,
        uploadedAt: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
      });
    }
    await client.query("commit");
    return NextResponse.json({ assets }, { status: 201 });
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    console.error("Workspace media upload failed", cause instanceof Error ? cause.message : "Unknown media error");
    return NextResponse.json({ error: "Das Material konnte nicht gespeichert werden." }, { status: 500 });
  } finally {
    client.release();
  }
}
