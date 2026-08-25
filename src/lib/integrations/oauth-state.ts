import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SocialProviderId } from "./contracts";
import type { OAuthFlowMode } from "./social-oauth";

const stateLifetimeMs = 10 * 60 * 1_000;

export type OAuthStatePayload = {
  provider: SocialProviderId;
  mode: OAuthFlowMode;
  subject: string;
  scopes: string[];
  nonce: string;
  issuedAt: number;
};

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.SUBSCRIPTION_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(payload: string) {
  const secret = getStateSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isOAuthStateConfigured() {
  return Boolean(getStateSecret());
}

export function oauthStateCookieName(provider: SocialProviderId) {
  return `contentdock_oauth_state_${provider}`;
}

export function createOAuthState(input: {
  provider: SocialProviderId;
  mode: OAuthFlowMode;
  subject: string;
  scopes: string[];
}) {
  const state: OAuthStatePayload = {
    provider: input.provider,
    mode: input.mode,
    subject: input.subject,
    scopes: input.scopes,
    nonce: randomBytes(24).toString("base64url"),
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(token: string, provider: SocialProviderId): OAuthStatePayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!signaturesMatch(expected, signature)) return null;

  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthStatePayload;
    const valid =
      state.provider === provider &&
      (state.mode === "demo" || state.mode === "workspace") &&
      typeof state.subject === "string" &&
      state.subject.length >= 16 &&
      Array.isArray(state.scopes) &&
      state.scopes.every((scope) => typeof scope === "string") &&
      typeof state.nonce === "string" &&
      state.nonce.length >= 24 &&
      typeof state.issuedAt === "number" &&
      state.issuedAt <= Date.now() &&
      Date.now() - state.issuedAt <= stateLifetimeMs;
    return valid ? state : null;
  } catch {
    return null;
  }
}
