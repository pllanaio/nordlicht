import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SocialProviderId } from "./contracts";

const stateLifetimeMs = 10 * 60 * 1_000;

type OAuthStatePayload = {
  provider: SocialProviderId;
  paymentId: string;
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

export function createOAuthState(provider: SocialProviderId, paymentId: string) {
  const state: OAuthStatePayload = {
    provider,
    paymentId,
    nonce: randomBytes(24).toString("base64url"),
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(token: string, provider: SocialProviderId, paymentId: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  if (!signaturesMatch(expected, signature)) return false;

  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthStatePayload;
    return (
      state.provider === provider &&
      state.paymentId === paymentId &&
      typeof state.nonce === "string" &&
      state.nonce.length >= 24 &&
      typeof state.issuedAt === "number" &&
      state.issuedAt <= Date.now() &&
      Date.now() - state.issuedAt <= stateLifetimeMs
    );
  } catch {
    return false;
  }
}
