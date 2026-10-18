import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/database";
import type { SubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext, type WorkspaceContext } from "@/lib/workspace-store";
import { encryptWorkspaceSecret } from "@/lib/workspace-secrets";
import type { VideoInput, VideoJob } from "./types";
import { VideoRequestError } from "./validation";
import { getMediaDeliveryOrigin } from "@/lib/media-delivery/core.mjs";

type VideoRow = {
  id: string; status: VideoJob["status"]; stage: VideoJob["stage"]; progress: number;
  input: VideoInput; script: string | null; sources: VideoJob["sources"]; error_message: string | null;
  created_at: Date; updated_at: Date; media_asset_id: string | null; media_name: string | null;
  media_bytes: string | null; has_subtitles: boolean; request_hash: string;
};

// Deliberately enumerate output columns: credential and lease fields never reach clients.
const jobSelection = `select j.id, j.status, j.stage, j.progress, j.input, j.script, j.sources,
  j.error_message, j.created_at, j.updated_at, j.request_hash,
  m.id as media_asset_id, m.name as media_name, m.bytes as media_bytes,
  (j.subtitle_srt is not null) as has_subtitles
  from video_job j left join media_asset m on m.id = j.media_asset_id and m.workspace_id = j.workspace_id`;

function publicJob(row: VideoRow): VideoJob {
  return {
    id: row.id, status: row.status, stage: row.stage, progress: row.progress, input: row.input,
    script: row.script, sources: row.sources, errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    mediaAsset: row.media_asset_id ? {
      id: row.media_asset_id, name: row.media_name ?? row.input.topic, kind: "video",
      preview: `/api/workspace/media/${row.media_asset_id}`, size: Number(row.media_bytes),
      uploadedAt: row.updated_at.toLocaleDateString("de-DE"),
    } : null,
    subtitleUrl: row.has_subtitles && row.status === "completed" ? `/api/video/jobs/${row.id}/subtitles` : null,
  };
}

async function inWorkspace<T>(entitlement: SubscriptionEntitlement, work: (client: PoolClient, context: WorkspaceContext) => Promise<T>) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    // Serializes first-use workspace provisioning for this authenticated principal.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${entitlement.source}:${entitlement.paymentId}`]);
    const context = await ensureWorkspaceContext(client, entitlement);
    const membership = await client.query<{ role: WorkspaceContext["role"] }>(`select wm.role from workspace_member wm
      join workspace w on w.id = wm.workspace_id where wm.workspace_id = $1 and wm.user_id = $2 for share of w, wm`, [context.workspaceId, context.userId]);
    if (!membership.rows[0]) throw new VideoRequestError("Workspace-Zugriff wurde entzogen.", 403);
    context.role = membership.rows[0].role;
    const result = await work(client, context);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

function assertCanCreate(context: WorkspaceContext) {
  if (!["owner", "admin", "editor"].includes(context.role)) throw new VideoRequestError("Deine Rolle darf keine Videos erstellen.", 403);
}

async function expireJobs(client: PoolClient, workspaceId: string) {
  await client.query(`update video_job set status = 'failed', encrypted_api_key = null,
    lease_token = null, lease_expires_at = null, error_code = 'job_expired',
    error_message = 'Der Auftrag ist abgelaufen. Bitte starte ihn mit deinem API-Key erneut.', updated_at = now()
    where workspace_id = $1 and status in ('queued','processing') and
      (expires_at <= now() or (status = 'processing' and lease_expires_at <= now()))`, [workspaceId]);
}

async function availability(client: PoolClient) {
  try {
    const deliveryOrigin = getMediaDeliveryOrigin();
    if ((process.env.VERCEL && !deliveryOrigin) || (deliveryOrigin && (process.env.PUBLISHING_MEDIA_SECRET?.length ?? 0) < 32)) {
      return { available: false, reason: "Die Medienauslieferung ist noch nicht eingerichtet." };
    }
  } catch {
    return { available: false, reason: "Die Medienauslieferung ist noch nicht eingerichtet." };
  }
  const key = process.env.WORKSPACE_DATA_ENCRYPTION_KEY;
  if (process.env.VIDEO_GENERATION_ENABLED !== "true" || !key || Buffer.from(key, "base64").length !== 32) {
    return { available: false, reason: "Die Videoerstellung ist für diesen Workspace noch nicht eingerichtet." };
  }
  const result = await client.query<{ ready: boolean }>("select exists(select 1 from video_worker where last_seen > now() - interval '90 seconds') as ready");
  return result.rows[0].ready ? { available: true } : { available: false, reason: "Der Video-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut." };
}

export async function listVideoJobs(entitlement: SubscriptionEntitlement) {
  return inWorkspace(entitlement, async (client, context) => {
    await expireJobs(client, context.workspaceId);
    const result = await client.query<VideoRow>(`${jobSelection} where j.workspace_id = $1 order by j.created_at desc limit 30`, [context.workspaceId]);
    return { jobs: result.rows.map(publicJob), ...await availability(client) };
  });
}

export async function createVideoJob(entitlement: SubscriptionEntitlement, input: VideoInput, apiKey: string, idempotencyKey: string) {
  return inWorkspace(entitlement, async (client, context) => {
    assertCanCreate(context);
    await client.query("select id from workspace where id = $1 for update", [context.workspaceId]);
    await expireJobs(client, context.workspaceId);
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const existing = await client.query<VideoRow>(`${jobSelection} where j.workspace_id = $1 and j.idempotency_key = $2`, [context.workspaceId, idempotencyKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== hash) throw new VideoRequestError("Dieser Auftragsschlüssel wurde bereits für andere Einstellungen verwendet.", 409);
      return publicJob(existing.rows[0]);
    }
    const service = await availability(client);
    if (!service.available) throw new VideoRequestError(service.reason!, 503);
    const count = await client.query<{ active: number; daily: number }>(`select
      count(*) filter(where status in ('queued','processing'))::integer as active,
      count(*) filter(where created_at > now() - interval '24 hours')::integer as daily
      from video_job where workspace_id = $1`, [context.workspaceId]);
    const dailyLimit = entitlement.plan === "starter" ? 5 : entitlement.plan === "studio" ? 20 : 50;
    if (count.rows[0].active >= 2 || count.rows[0].daily >= dailyLimit) {
      throw new VideoRequestError(`Maximal zwei laufende Aufträge und ${dailyLimit} Videos pro 24 Stunden sind in deinem Tarif möglich.`, 429);
    }
    const id = randomUUID();
    await client.query(`insert into video_job (id, workspace_id, created_by, idempotency_key, request_hash, input, encrypted_api_key)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7)`, [id, context.workspaceId, context.userId, idempotencyKey, hash, JSON.stringify(input), encryptWorkspaceSecret(apiKey)]);
    const result = await client.query<VideoRow>(`${jobSelection} where j.id = $1 and j.workspace_id = $2`, [id, context.workspaceId]);
    return publicJob(result.rows[0]);
  });
}

export async function getVideoJob(entitlement: SubscriptionEntitlement, id: string) {
  return inWorkspace(entitlement, async (client, context) => {
    await expireJobs(client, context.workspaceId);
    const result = await client.query<VideoRow>(`${jobSelection} where j.id = $1 and j.workspace_id = $2`, [id, context.workspaceId]);
    if (!result.rows[0]) throw new VideoRequestError("Videoauftrag nicht gefunden.", 404);
    return publicJob(result.rows[0]);
  });
}

export async function cancelVideoJob(entitlement: SubscriptionEntitlement, id: string) {
  return inWorkspace(entitlement, async (client, context) => {
    assertCanCreate(context);
    await client.query(`update video_job set status = 'canceled', encrypted_api_key = null,
      lease_token = null, lease_expires_at = null, updated_at = now()
      where id = $1 and workspace_id = $2 and status in ('queued','processing')`, [id, context.workspaceId]);
    const result = await client.query<VideoRow>(`${jobSelection} where j.id = $1 and j.workspace_id = $2`, [id, context.workspaceId]);
    if (!result.rows[0]) throw new VideoRequestError("Videoauftrag nicht gefunden.", 404);
    return publicJob(result.rows[0]);
  });
}

export async function getVideoSubtitles(entitlement: SubscriptionEntitlement, id: string) {
  return inWorkspace(entitlement, async (client, context) => {
    const result = await client.query<{ subtitle_srt: string }>(`select subtitle_srt from video_job
      where id = $1 and workspace_id = $2 and status = 'completed' and subtitle_srt is not null`, [id, context.workspaceId]);
    if (!result.rows[0]) throw new VideoRequestError("Untertitel nicht gefunden.", 404);
    return result.rows[0].subtitle_srt;
  });
}
