import { createHmac, timingSafeEqual } from 'node:crypto';
export const mediaUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function secret(env) {
  const value = env.PUBLISHING_MEDIA_SECRET || '';
  if (value.length < 32) throw new Error('PUBLISHING_MEDIA_SECRET requires at least 32 characters');
  return value;
}
function sign(scope, env) { return createHmac('sha256', secret(env)).update(scope).digest('base64url'); }
function matches(expected, signature) {
  if (!/^[a-zA-Z0-9_-]{43}$/.test(signature || '')) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
function validExpiry(expires, maximumSeconds) {
  const now = Date.now() / 1000;
  return /^\d{10}$/.test(String(expires)) && Number(expires) > now && Number(expires) <= now + maximumSeconds + 60;
}
export function getMediaDeliveryOrigin(env = process.env) {
  if (!env.MEDIA_DELIVERY_URL) return null;
  const url = new URL(env.MEDIA_DELIVERY_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname === 'localhost') throw new Error('MEDIA_DELIVERY_URL must be a public HTTPS origin');
  return url.origin;
}
export function publicationSignature(id, expires, env = process.env) {
  return sign(`contentdock-publication-media:v1:${id}:${expires}`, env);
}
export function verifyPublicationSignature(id, expires, signature, env = process.env) {
  return mediaUuidPattern.test(id) && validExpiry(expires, 3600) && matches(publicationSignature(id, expires, env), signature);
}
export function assetSignature(id, workspaceId, expires, download, env = process.env) {
  return sign(`contentdock-private-asset:v1:${id}:${workspaceId}:${expires}:${download ? 'download' : 'preview'}`, env);
}
export function verifyAssetSignature(id, workspaceId, expires, download, signature, env = process.env) {
  return mediaUuidPattern.test(id) && mediaUuidPattern.test(workspaceId) && validExpiry(expires, 300) && matches(assetSignature(id, workspaceId, expires, download, env), signature);
}
export function signedAssetUrl(id, workspaceId, download = false, env = process.env) {
  const origin = getMediaDeliveryOrigin(env);
  if (!origin || !mediaUuidPattern.test(id) || !mediaUuidPattern.test(workspaceId)) throw new Error('Media delivery is not configured');
  const expires = Math.floor(Date.now() / 1000) + 300;
  const url = new URL(`/api/media/${id}`, origin);
  url.searchParams.set('workspace', workspaceId); url.searchParams.set('expires', String(expires));
  if (download) url.searchParams.set('download', '1');
  url.searchParams.set('signature', assetSignature(id, workspaceId, expires, download, env)); return url.toString();
}
export function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix); end = size - 1;
  } else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return false;
  return { start, end };
}
