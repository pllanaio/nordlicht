import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { parseRange, verifyAssetSignature, verifyPublicationSignature } from '../src/lib/media-delivery/core.mjs';

const chunkBytes = 256 * 1024;
export function createMediaServer({ pool, env = process.env, maxConcurrent = 8, requestTimeoutMs = 120_000 }) {
  let active = 0;
  const server = createServer(async (request, response) => {
    const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
    const finish = (status, extra = {}) => { if (!response.headersSent && !response.destroyed) response.writeHead(status, { ...headers, ...extra }).end(); };
    if (!['GET', 'HEAD'].includes(request.method)) { finish(405, { Allow: 'GET, HEAD' }); return; }
    let target;
    try {
      const url = new URL(request.url, 'http://media.internal');
      const match = /^\/api\/(media|publishing\/media)\/([^/]+)$/.exec(url.pathname);
      if (!match) { finish(404); return; }
      const [, kind, id] = match, expires = url.searchParams.get('expires') || '', signature = url.searchParams.get('signature') || '';
      const workspaceId = url.searchParams.get('workspace') || '', download = url.searchParams.get('download') === '1';
      const valid = kind === 'media' ? verifyAssetSignature(id, workspaceId, expires, download, signature, env) : verifyPublicationSignature(id, expires, signature, env);
      if (!valid) { finish(404); return; }
      target = { kind, id, workspaceId, download: kind === 'media' && download };
    } catch { finish(404); return; }
    // Signature checks happen before consuming a database connection.
    if (active >= maxConcurrent) { finish(503, { 'Retry-After': '2' }); return; }
    active++;
    const controller = new AbortController();
    const close = () => controller.abort();
    const deadline = setTimeout(() => { controller.abort(); response.destroy(); }, requestTimeoutMs);
    response.once('close', close);
    let client;
    try {
      client = await pool.connect(); controller.signal.throwIfAborted();
      await client.query('begin isolation level repeatable read read only');
      await client.query("set local statement_timeout = '5s'");
      const result = target.kind === 'media' ? await client.query(`select id, workspace_id, octet_length(content) as size, content_type
        from media_asset where id = $1 and workspace_id = $2 and content is not null`, [target.id, target.workspaceId]) :
        await client.query(`select m.id, m.workspace_id, octet_length(m.content) as size, m.content_type from video_publication p
          join video_job j on j.id = p.video_job_id and j.workspace_id = p.workspace_id
          join media_asset m on m.id = j.media_asset_id and m.workspace_id = p.workspace_id
          where p.id = $1 and p.provider = 'instagram' and p.status = 'processing' and j.status = 'completed'
          and m.content_type = 'video/mp4' and m.content is not null`, [target.id]);
      controller.signal.throwIfAborted();
      const asset = result.rows[0];
      if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0) { finish(404); return; }
      const range = parseRange(request.headers.range || null, asset.size);
      if (range === false) { finish(416, { 'Content-Range': `bytes */${asset.size}` }); return; }
      const start = range?.start ?? 0, end = range?.end ?? asset.size - 1;
      const contentType = ['video/mp4', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(asset.content_type) ? asset.content_type : 'application/octet-stream';
      const extension = { 'video/mp4': 'mp4', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[contentType] || 'bin';
      response.writeHead(range ? 206 : 200, { ...headers, 'Content-Type': contentType, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${asset.size}` } : {}),
        ...(target.download ? { 'Content-Disposition': `attachment; filename="contentdock-${asset.id}.${extension}"` } : {}) });
      if (request.method === 'HEAD') { response.end(); return; }
      for (let position = start; position <= end; position += chunkBytes) {
        controller.signal.throwIfAborted();
        const length = Math.min(chunkBytes, end - position + 1);
        const piece = await client.query(`select substring(content from $3::integer for $4::integer) as content
          from media_asset where id = $1 and workspace_id = $2`, [asset.id, asset.workspace_id, position + 1, length]);
        controller.signal.throwIfAborted();
        const data = piece.rows[0]?.content;
        if (!data || data.length !== length) throw new Error('Media content unavailable');
        if (!response.write(data)) await once(response, 'drain', { signal: controller.signal });
      }
      response.end();
    } catch {
      if (!response.headersSent) finish(503); else response.destroy();
    } finally {
      clearTimeout(deadline); response.removeListener('close', close);
      if (client) { let broken = false; try { await client.query('rollback'); } catch { broken = true; } client.release(broken); }
      active--;
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  server.maxConnections = Math.max(16, maxConcurrent * 4);
  return server;
}
export async function main() {
  if ((process.env.PUBLISHING_MEDIA_SECRET || '').length < 32) throw new Error('Media signing secret is missing');
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000,
    application_name: 'contentdock-media-delivery', options: '-c default_transaction_read_only=on -c statement_timeout=5000' });
  const server = createMediaServer({ pool });
  server.listen(port, '0.0.0.0');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(() => { pool.end().catch(() => {}); });
    server.closeAllConnections();
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Media delivery service could not start'); process.exitCode = 1; });
