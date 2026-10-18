import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { VideoError, publicError } from "./errors.mjs";
import { generateVideo } from "./pipeline.mjs";
import { createProviders } from "./providers.mjs";

export function decryptJobKey(encrypted, encodedKey) {
  if (!Buffer.isBuffer(encrypted) || typeof encodedKey !== "string") return null;
  const key = Buffer.from(encodedKey, "base64");
  const parts = encrypted.toString("utf8").split(".");
  if (key.length !== 32 || parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const [, ivText, tagText, ciphertext] = parts;
    const iv = Buffer.from(ivText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const value = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    return value.length > 0 && value.length <= 1024 ? value : null;
  } catch { return null; }
}

export class VideoQueue {
  constructor(client) { this.client = client; }

  async heartbeat(workerId) {
    await this.client.query("insert into video_worker (id, last_seen) values ($1, now()) on conflict (id) do update set last_seen = now()", [workerId]);
  }

  async expire() {
    await this.client.query(`update video_job set status = 'failed', encrypted_api_key = null, lease_token = null, lease_expires_at = null,
      error_code = case when status = 'queued' then 'key_expired' else 'worker_interrupted' end,
      error_message = case when status = 'queued' then 'Der Auftrag ist abgelaufen. Bitte starte ihn mit deinem API-Schlüssel erneut.' else 'Die Verarbeitung wurde unterbrochen. Bitte starte einen neuen Auftrag.' end,
      updated_at = now()
      where (status = 'queued' and expires_at <= now()) or (status = 'processing' and (expires_at <= now() or lease_expires_at is null or lease_expires_at <= now()))`);
    // Also erase any terminal credentials left by a historical client version.
    await this.client.query("update video_job set encrypted_api_key = null where status in ('completed', 'failed', 'canceled') and encrypted_api_key is not null");
  }

  async claim() {
    const token = randomUUID();
    const result = await this.client.query(`with next_job as (
      select id from video_job where status = 'queued' and expires_at > now() and encrypted_api_key is not null
      order by created_at for update skip locked limit 1
    ) update video_job j set status = 'processing', stage = 'script', progress = 1, lease_token = $1,
      lease_expires_at = now() + interval '2 minutes', attempts = attempts + 1, updated_at = now()
      from next_job where j.id = next_job.id returning j.*`, [token]);
    return result.rows[0] ?? null;
  }

  async renew(job) {
    const result = await this.client.query(`update video_job set lease_expires_at = now() + interval '2 minutes', updated_at = now()
      where id = $1 and lease_token = $2 and status = 'processing' and lease_expires_at > now() and expires_at > now() returning id`, [job.id, job.lease_token]);
    return result.rowCount === 1;
  }

  async progress(job, stage, progress, details) {
    const result = await this.client.query(`update video_job set stage = $3, progress = $4,
      script = coalesce($5, script), search_terms = coalesce($6::jsonb, search_terms),
      sources = coalesce($7::jsonb, sources), subtitle_srt = coalesce($8, subtitle_srt), updated_at = now()
      where id = $1 and lease_token = $2 and status = 'processing' and lease_expires_at > now() and expires_at > now() returning id`,
    [job.id, job.lease_token, stage, progress, details.script ?? null, details.searchTerms ? JSON.stringify(details.searchTerms) : null, details.sources ? JSON.stringify(details.sources) : null, details.subtitleSrt ?? null]);
    if (result.rowCount !== 1) throw new VideoError("lease_lost", "Der Auftrag wurde abgebrochen oder wird nicht mehr von diesem Worker verarbeitet.");
  }

  async fail(job, error) {
    const safe = publicError(error);
    await this.client.query(`update video_job set status = 'failed', error_code = $3, error_message = $4,
      encrypted_api_key = null, lease_token = null, lease_expires_at = null, updated_at = now()
      where id = $1 and lease_token = $2 and status = 'processing'`, [job.id, job.lease_token, safe.code, safe.message]);
  }

  async complete(job, output) {
    await this.client.query("begin");
    try {
      const ownership = await this.client.query(`select id from video_job where id = $1 and lease_token = $2 and status = 'processing' and lease_expires_at > now() and expires_at > now() for update`, [job.id, job.lease_token]);
      if (ownership.rowCount !== 1) throw new VideoError("lease_lost", "Der Auftrag wurde abgebrochen oder wird nicht mehr von diesem Worker verarbeitet.");
      const assetId = randomUUID();
      const name = job.input.topic.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, 150) || "KI-Kurzvideo";
      await this.client.query(`insert into media_asset
        (id, workspace_id, storage_key, name, content_type, content, bytes, checksum_sha256, width, height, duration_ms, scan_status, created_by)
        values ($1, $2, $3, $4, 'video/mp4', $5, $6, $7, $8, $9, $10, 'accepted', $11)`,
      [assetId, job.workspace_id, `database:${assetId}`, name, output.content, output.content.length, createHash("sha256").update(output.content).digest("hex"), output.width, output.height, Math.round(output.duration * 1000), job.created_by]);
      await this.client.query(`update video_job set status = 'completed', stage = 'complete', progress = 100, media_asset_id = $3,
        script = $4, search_terms = $5::jsonb, sources = $6::jsonb, subtitle_srt = $7,
        encrypted_api_key = null, lease_token = null, lease_expires_at = null, error_code = null, error_message = null, updated_at = now()
        where id = $1 and lease_token = $2 and status = 'processing'`,
      [job.id, job.lease_token, assetId, output.script, JSON.stringify(output.searchTerms), JSON.stringify(output.sources), output.subtitleSrt]);
      await this.client.query("commit");
      return assetId;
    } catch (error) {
      await this.client.query("rollback").catch(() => undefined);
      throw error;
    }
  }
}

export async function processJob(queue, job, { encryptionKey, pexelsKey, signal, pipeline = generateVideo, providerFactory = createProviders, leaseIntervalMs = 15_000, timeoutMs = 15 * 60_000 } = {}) {
  const controller = new AbortController();
  const keyLifetimeMs = new Date(job.expires_at).getTime() - Date.now();
  const deadlineMs = Math.max(1, Math.min(timeoutMs, Number.isFinite(keyLifetimeMs) ? keyLifetimeMs : 1));
  const scopedSignal = AbortSignal.any([controller.signal, signal ?? new AbortController().signal, AbortSignal.timeout(deadlineMs)]);
  let renewing = false;
  const timer = setInterval(async () => {
    if (renewing || scopedSignal.aborted) return;
    renewing = true;
    try {
      if (!await queue.renew(job)) controller.abort(new VideoError("lease_lost", "Der Auftrag wurde abgebrochen oder seine Verarbeitung unterbrochen."));
    } catch { controller.abort(new VideoError("queue_unavailable", "Die Verbindung zur Auftragsverwaltung wurde unterbrochen.")); }
    finally { renewing = false; }
  }, leaseIntervalMs);
  try {
    if (!Number.isFinite(keyLifetimeMs) || keyLifetimeMs <= 0) throw new VideoError("key_expired", "Der Auftrag ist abgelaufen. Bitte starte ihn mit deinem API-Schlüssel erneut.");
    const apiKey = decryptJobKey(job.encrypted_api_key, encryptionKey);
    // The database retains the encrypted value only until a terminal state.
    job.encrypted_api_key = null;
    if (!apiKey) throw new VideoError("key_unavailable", "Der API-Schlüssel konnte nicht entschlüsselt werden. Bitte starte einen neuen Auftrag.");
    const result = await pipeline(job.input, { providers: providerFactory({ apiKey, pexelsKey }), signal: scopedSignal,
      onProgress: (stage, progress, details) => queue.progress(job, stage, progress, details),
    });
    scopedSignal.throwIfAborted();
    await queue.complete(job, result);
    return { status: "completed" };
  } catch (error) {
    await queue.fail(job, error);
    return { status: "failed", code: publicError(error).code };
  } finally {
    clearInterval(timer);
  }
}
