import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/database";
import type { SubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext, type WorkspaceContext } from "@/lib/workspace-store";
import { VideoRequestError } from "@/lib/video/validation";
import { assertConnection, decryptState, encryptState, getTikTokCreator, publishingProviders, refreshConnection, signedMediaUrl, PublishingError, type StoredConnection } from "./core.mjs";
import type { Publication, PublicationInput, PublicationOptions, PublicationProvider } from "./types";

type PublicationRow = { id: string; provider: PublicationProvider; status: Publication["status"]; external_id: string | null; error_message: string | null; created_at: Date; updated_at: Date; request_hash?: string };
const selection = "select id, provider, status, external_id, error_message, created_at, updated_at, request_hash from video_publication";
const project = (row: PublicationRow): Publication => ({ id: row.id, provider: row.provider, status: row.status, externalId: row.external_id,
  errorMessage: row.error_message, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
async function inWorkspace<T>(entitlement: SubscriptionEntitlement, work: (client: PoolClient, context: WorkspaceContext) => Promise<T>) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${entitlement.source}:${entitlement.paymentId}`]);
    const context = await ensureWorkspaceContext(client, entitlement);
    const membership = await client.query<{ role: WorkspaceContext["role"] }>(`select wm.role from workspace_member wm
      join workspace w on w.id = wm.workspace_id where wm.workspace_id = $1 and wm.user_id = $2 for share of w, wm`, [context.workspaceId, context.userId]);
    if (!membership.rows[0]) throw new VideoRequestError("Workspace-Zugriff wurde entzogen.", 403);
    context.role = membership.rows[0].role;
    const result = await work(client, context); await client.query("commit"); return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error instanceof PublishingError) throw new VideoRequestError(error.message, 409);
    throw error;
  } finally { client.release(); }
}
async function serviceAvailable(client: PoolClient) {
  if (process.env.PUBLISHING_ENABLED !== "true" || Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "", "base64").length !== 32) return false;
  return (await client.query<{ ready: boolean }>("select exists(select 1 from publishing_worker where last_seen > now() - interval '90 seconds') as ready")).rows[0].ready;
}
async function requireVideo(client: PoolClient, workspaceId: string, jobId: string) {
  const result = await client.query<{ duration_seconds: number; status: string }>(`select j.status,
    coalesce(m.duration_ms / 1000.0, (j.input->>'durationSeconds')::numeric) as duration_seconds
    from video_job j left join media_asset m on m.id = j.media_asset_id and m.workspace_id = j.workspace_id
    where j.workspace_id = $1 and j.id = $2 and m.content is not null`, [workspaceId, jobId]);
  if (!result.rows[0]) throw new VideoRequestError("Fertiges Video nicht gefunden.", 404);
  if (result.rows[0].status !== "completed") throw new VideoRequestError("Das Video ist noch nicht fertig.", 409);
  return result.rows[0];
}
async function connection(client: PoolClient, workspaceId: string, provider: PublicationProvider): Promise<StoredConnection | null> {
  const result = await client.query<{ id: string; encrypted_access_token: Buffer }>(`select id, encrypted_access_token from social_connection
    where workspace_id = $1 and provider = $2 and status = 'connected' for update`, [workspaceId, provider]);
  const row = result.rows[0]; if (!row) return null;
  const stored = decryptState(row.encrypted_access_token);
  const refreshed = await refreshConnection(stored);
  assertConnection(refreshed, provider);
  if (stored.accessToken !== refreshed.accessToken) await client.query(`update social_connection set encrypted_access_token = $1,
    token_expires_at = $2, scopes = $3, updated_at = now() where id = $4 and workspace_id = $5`,
    [encryptState(refreshed), refreshed.tokenExpiresAt, refreshed.scopes, row.id, workspaceId]);
  return refreshed;
}
export function parsePublicationInput(value: unknown): PublicationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VideoRequestError("Ungültige Veröffentlichungsanfrage.");
  const input = value as Record<string, unknown>;
  if (!publishingProviders.includes(input.provider as PublicationProvider)) throw new VideoRequestError("Ungültige Plattform.");
  const provider = input.provider as PublicationProvider;
  const maxCaption = provider === "youtube" ? 5000 : 2200;
  if (typeof input.caption !== "string" || input.caption.length > maxCaption) throw new VideoRequestError(`Der Beitragstext darf höchstens ${maxCaption} Zeichen enthalten.`);
  if (input.consent !== true) throw new VideoRequestError("Bitte die Veröffentlichung ausdrücklich bestätigen.");
  const parsed: PublicationInput = { provider, caption: input.caption.trim(), consent: true };
  if (provider === "youtube") {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 100 || /[<>]/.test(input.title)) throw new VideoRequestError("Bitte einen YouTube-Titel mit maximal 100 Zeichen angeben.");
    if (!["private", "unlisted", "public"].includes(String(input.privacy))) throw new VideoRequestError("Bitte die YouTube-Sichtbarkeit auswählen.");
    if (typeof input.selfDeclaredMadeForKids !== "boolean") throw new VideoRequestError("Bitte die YouTube-Zielgruppe ausdrücklich auswählen.");
    Object.assign(parsed, { title: input.title.trim(), privacy: input.privacy, selfDeclaredMadeForKids: input.selfDeclaredMadeForKids });
  }
  if (provider === "tiktok") {
    if (typeof input.privacy !== "string" || !["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"].includes(input.privacy)) throw new VideoRequestError("Bitte die TikTok-Sichtbarkeit auswählen.");
    const settings = input.tiktok as Record<string, unknown> | undefined;
    if (!settings || ["disableComment", "disableDuet", "disableStitch", "brandContentToggle", "brandOrganicToggle"].some(key => typeof settings[key] !== "boolean") || settings.musicUsageConfirmed !== true) throw new VideoRequestError("Bitte TikTok-Inhaltsangaben und Musikrechte bestätigen.");
    if (settings.brandContentToggle && input.privacy === "SELF_ONLY") throw new VideoRequestError("Bezahlte Markeninhalte dürfen bei TikTok nicht privat veröffentlicht werden.");
    parsed.privacy = input.privacy;
    parsed.tiktok = { disableComment: settings.disableComment as boolean, disableDuet: settings.disableDuet as boolean, disableStitch: settings.disableStitch as boolean,
      brandContentToggle: settings.brandContentToggle as boolean, brandOrganicToggle: settings.brandOrganicToggle as boolean, musicUsageConfirmed: true };
  }
  return parsed;
}
export async function getPublicationOptions(entitlement: SubscriptionEntitlement, jobId: string): Promise<PublicationOptions> {
  return inWorkspace(entitlement, async (client, context) => {
    const video = await requireVideo(client, context.workspaceId, jobId);
    const allowed = ["owner", "admin", "editor"].includes(context.role);
    const available = allowed && await serviceAvailable(client);
    const channels: PublicationOptions["channels"] = [];
    for (const provider of publishingProviders) {
      const channel: PublicationOptions["channels"][number] = { provider, displayName: provider === "youtube" ? "YouTube" : provider === "tiktok" ? "TikTok" : "Instagram", connected: false, ready: false };
      try {
        const stored = await connection(client, context.workspaceId, provider);
        if (!stored) { channel.reason = "Kanal zuerst unter Integrationen verbinden."; }
        else {
          channel.connected = true; channel.displayName = stored.displayName; channel.ready = available;
          if (provider === "instagram") signedMediaUrl(jobId);
          if (provider === "tiktok") {
            channel.tiktok = await getTikTokCreator(stored);
            if (Number(video.duration_seconds) > channel.tiktok.maxVideoPostDurationSec) { channel.ready = false; channel.reason = "Das Video ist für dieses TikTok-Konto zu lang."; }
          }
        }
      } catch (error) { channel.ready = false; channel.reason = error instanceof PublishingError ? error.message : "Kanal konnte nicht geprüft werden. Bitte neu verbinden."; }
      channels.push(channel);
    }
    const rows = await client.query<PublicationRow>(`${selection} where workspace_id = $1 and video_job_id = $2 order by created_at desc limit 30`, [context.workspaceId, jobId]);
    return { available, ...(!available ? { reason: allowed ? "Der Veröffentlichungsdienst ist noch nicht eingerichtet oder nicht erreichbar." : "Deine Rolle darf keine Videos veröffentlichen." } : {}), channels, publications: rows.rows.map(project) };
  });
}
export async function getPublicationStatuses(entitlement: SubscriptionEntitlement, jobId: string) {
  return inWorkspace(entitlement, async (client, context) => {
    await requireVideo(client, context.workspaceId, jobId);
    const rows = await client.query<PublicationRow>(`${selection} where workspace_id = $1 and video_job_id = $2 order by created_at desc limit 30`, [context.workspaceId, jobId]);
    return { publications: rows.rows.map(project) };
  });
}
export async function enqueuePublication(entitlement: SubscriptionEntitlement, jobId: string, input: PublicationInput, idempotencyKey: string) {
  return inWorkspace(entitlement, async (client, context) => {
    if (!["owner", "admin", "editor"].includes(context.role)) throw new VideoRequestError("Deine Rolle darf keine Videos veröffentlichen.", 403);
    await client.query("select id from workspace where id = $1 for update", [context.workspaceId]);
    const hash = createHash("sha256").update(JSON.stringify({ jobId, input })).digest("hex");
    const previous = (await client.query<PublicationRow>(`${selection} where workspace_id = $1 and idempotency_key = $2`, [context.workspaceId, idempotencyKey])).rows[0];
    if (previous) {
      if (previous.request_hash !== hash) throw new VideoRequestError("Dieser Auftragsschlüssel wurde bereits verwendet.", 409);
      return project(previous);
    }
    const video = await requireVideo(client, context.workspaceId, jobId);
    if (!await serviceAvailable(client)) throw new VideoRequestError("Der Veröffentlichungsdienst ist gerade nicht erreichbar.", 503);
    const duplicate = await client.query("select id from video_publication where workspace_id = $1 and video_job_id = $2 and provider = $3 and status <> 'failed'", [context.workspaceId, jobId, input.provider]);
    if (duplicate.rows.length) throw new VideoRequestError("Für dieses Video gibt es bereits eine Veröffentlichung auf diesem Kanal. Bitte zuerst den Status prüfen.", 409);
    const recent = await client.query<{ count: number }>("select count(*)::integer as count from video_publication where workspace_id = $1 and created_at > now() - interval '24 hours'", [context.workspaceId]);
    if (recent.rows[0].count >= 50) throw new VideoRequestError("Maximal 50 Veröffentlichungsaufträge pro 24 Stunden sind möglich.", 429);
    const stored = await connection(client, context.workspaceId, input.provider);
    if (!stored) throw new VideoRequestError("Bitte den Kanal zuerst verbinden.", 409);
    if (input.provider === "instagram") signedMediaUrl(jobId);
    if (input.provider === "tiktok") {
      const creator = await getTikTokCreator(stored);
      if (!creator.privacyLevelOptions.includes(input.privacy!) || Number(video.duration_seconds) > creator.maxVideoPostDurationSec ||
        (creator.commentDisabled && !input.tiktok!.disableComment) || (creator.duetDisabled && !input.tiktok!.disableDuet) || (creator.stitchDisabled && !input.tiktok!.disableStitch)) {
        throw new VideoRequestError("Die TikTok-Einstellungen haben sich geändert. Bitte neu laden und erneut bestätigen.", 409);
      }
    }
    const id = randomUUID();
    await client.query(`insert into video_publication (id, workspace_id, video_job_id, created_by, provider, provider_account_id, idempotency_key, request_hash, input)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [id, context.workspaceId, jobId, context.userId, input.provider, stored.accountId, idempotencyKey, hash, JSON.stringify(input)]);
    return project((await client.query<PublicationRow>(`${selection} where id = $1 and workspace_id = $2`, [id, context.workspaceId])).rows[0]);
  });
}
