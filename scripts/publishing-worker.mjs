import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { assertConnection, decryptState, encryptState, PublishingError, refreshConnection } from '../src/lib/publishing/core.mjs';
import { publishVideo } from './publishing/providers.mjs';

export async function claimPublication(pool) {
  // A worker death may happen after a remote side effect. Never requeue it.
  await pool.query(`update video_publication set status = 'unknown', error_message = 'Der Worker wurde unterbrochen. Bitte den Plattformstatus prüfen; nicht erneut posten.',
    lease_token = null, lease_expires_at = null, updated_at = now()
    where status = 'processing' and lease_expires_at < now()`);
  await pool.query(`update video_publication set status = 'failed', error_message = 'Der Auftrag ist abgelaufen. Bitte erneut bestätigen.', updated_at = now()
    where status = 'queued' and created_at < now() - interval '1 hour'`);
  const token = randomUUID();
  const result = await pool.query(`with candidate as (
      select id from video_publication where status = 'queued' order by created_at for update skip locked limit 1
    ) update video_publication p set status = 'processing', lease_token = $1, lease_expires_at = now() + interval '90 seconds', updated_at = now()
      from candidate c where p.id = c.id returning p.*`, [token]);
  return result.rows[0] || null;
}
async function loadPublication(pool, job) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const context = await client.query(`select m.content, coalesce(m.duration_ms / 1000.0, (v.input->>'durationSeconds')::numeric) as duration_seconds
      from video_job v join media_asset m on m.id = v.media_asset_id and m.workspace_id = v.workspace_id
      join workspace_member wm on wm.workspace_id = v.workspace_id and wm.user_id = $3
      join subscription s on s.workspace_id = v.workspace_id
      where v.id = $1 and v.workspace_id = $2 and v.status = 'completed' and m.content_type = 'video/mp4'
      and wm.role in ('owner','admin','editor') and s.status = 'active'
      and s.current_period_end > now()`, [job.video_job_id, job.workspace_id, job.created_by]);
    const media = context.rows[0];
    if (!media?.content) throw new PublishingError('Video, Workspace-Berechtigung oder aktives Abonnement fehlen.');
    const result = await client.query(`select id, encrypted_access_token from social_connection
      where workspace_id = $1 and provider = $2 and provider_account_id = $3 and status = 'connected' for update`, [job.workspace_id, job.provider, job.provider_account_id]);
    const row = result.rows[0]; if (!row) throw new PublishingError('Der Kanal wurde getrennt oder geändert.');
    const old = decryptState(row.encrypted_access_token);
    const connection = await refreshConnection(old);
    assertConnection(connection, job.provider);
    if (old.accessToken !== connection.accessToken) await client.query(`update social_connection set encrypted_access_token = $1, token_expires_at = $2,
      scopes = $3, updated_at = now() where id = $4 and workspace_id = $5`, [encryptState(connection), connection.tokenExpiresAt, connection.scopes, row.id, job.workspace_id]);
    await client.query('commit');
    return { connection, content: media.content, durationSeconds: Number(media.duration_seconds) };
  } catch (error) { await client.query('rollback').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function processPublication(pool, job, options = {}) {
  let leaseLost = false;
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const deadline = setTimeout(() => controller.abort(new Error('Publication deadline exceeded')), 15 * 60_000);
  const loseLease = () => { leaseLost = true; controller.abort(new Error('Publication lease lost')); };
  const heartbeat = setInterval(() => {
    pool.query(`update video_publication set lease_expires_at = now() + interval '90 seconds'
      where id = $1 and workspace_id = $2 and lease_token = $3 and status = 'processing' and lease_expires_at > now()`, [job.id, job.workspace_id, job.lease_token])
      .then(result => { if (result.rowCount !== 1) loseLease(); }).catch(loseLease);
  }, 20_000);
  try {
    const loaded = await loadPublication(pool, job);
    await publishVideo({ ...job, durationSeconds: loaded.durationSeconds }, loaded.connection, loaded.content, {
      ...options, signal,
      persist: async update => {
        if (leaseLost) throw new PublishingError('Veröffentlichungsstatus muss nach Verbindungsunterbrechung geprüft werden.', true);
        const result = await pool.query(`update video_publication set stage = $1, status = coalesce($2, status), external_id = coalesce($3, external_id),
          encrypted_state = case when $4 then $5 else encrypted_state end, updated_at = now(), lease_expires_at = now() + interval '90 seconds'
          where id = $6 and workspace_id = $7 and lease_token = $8 and status = 'processing' and lease_expires_at > now()`,
          [update.stage, update.status || null, update.externalId || null, Object.hasOwn(update, 'state'), update.state ? encryptState(update.state) : null, job.id, job.workspace_id, job.lease_token]);
        if (result.rowCount !== 1) { loseLease(); throw new PublishingError('Der Veröffentlichungsstatus muss geprüft werden.', true); }
      },
    });
  } catch (error) {
    const uncertain = !(error instanceof PublishingError) || error.uncertain;
    await pool.query(`update video_publication set status = $1, error_message = $2,
      encrypted_state = case when $1 = 'failed' then null else encrypted_state end, lease_token = null, lease_expires_at = null, updated_at = now()
      where id = $3 and workspace_id = $4 and lease_token = $5 and status = 'processing'`,
      [uncertain ? 'unknown' : 'failed', error instanceof PublishingError ? error.message : 'Der Veröffentlichungsstatus muss geprüft werden.', job.id, job.workspace_id, job.lease_token]);
  } finally { clearInterval(heartbeat); clearTimeout(deadline); }
}
export async function main() {
  if (process.env.PUBLISHING_ENABLED !== 'true') throw new Error('PUBLISHING_ENABLED=true is required');
  if (Buffer.from(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || '', 'base64').length !== 32) throw new Error('A 32-byte SOCIAL_TOKEN_ENCRYPTION_KEY is required');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, application_name: 'contentdock-publishing-worker' });
  const id = `${hostname()}:${process.pid}:${randomUUID()}`;
  let running = true;
  const shutdown = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { running = false; shutdown.abort(new Error('Worker shutting down')); });
  const beat = async () => { await pool.query('insert into publishing_worker(id,last_seen) values ($1,now()) on conflict(id) do update set last_seen = now()', [id]); };
  await beat();
  const heartbeat = setInterval(() => { beat().catch(() => { console.error('Publishing worker heartbeat failed'); }); }, 20_000);
  try {
    while (running) {
      try { const job = await claimPublication(pool); if (job) await processPublication(pool, job, { signal: shutdown.signal }); else await new Promise(resolve => setTimeout(resolve, 2000)); }
      catch { console.error('Publishing worker operation failed'); await new Promise(resolve => setTimeout(resolve, 5000)); }
    }
  } finally { clearInterval(heartbeat); await pool.query('delete from publishing_worker where id = $1', [id]).catch(() => {}); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Publishing worker could not start'); process.exitCode = 1; });
