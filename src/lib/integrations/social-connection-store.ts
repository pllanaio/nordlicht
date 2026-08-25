import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SocialConnectionSummary, SocialProviderId } from "./contracts";
import type { SocialOAuthProfile, SocialOAuthTokens } from "./social-oauth";

const cookiePrefix = "contentdock_social_connection_";
const cookiePayloadVersion = "v1";
const maximumCookieValueLength = 3_700;

type StoredSocialConnection = SocialConnectionSummary & {
  accessToken: string;
  refreshToken?: string;
};

function connectionCookieName(provider: SocialProviderId) {
  return `${cookiePrefix}${provider}`;
}

function getEncryptionKey() {
  const encoded = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!encoded) return null;
  try {
    const key = Buffer.from(encoded, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

function encrypt(connection: StoredSocialConnection) {
  const key = getEncryptionKey();
  if (!key) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(connection), "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  const value = [
    cookiePayloadVersion,
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");

  if (value.length > maximumCookieValueLength) {
    throw new Error("Encrypted provider token exceeds the temporary cookie store limit");
  }
  return value;
}

function decrypt(value: string): StoredSocialConnection | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const [version, ivValue, authenticationTagValue, ciphertextValue] = value.split(".");
  if (version !== cookiePayloadVersion || !ivValue || !authenticationTagValue || !ciphertextValue) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(authenticationTagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as StoredSocialConnection;
  } catch {
    return null;
  }
}

export function isSocialConnectionStoreConfigured() {
  return Boolean(getEncryptionKey());
}

export async function saveSocialConnection(
  provider: SocialProviderId,
  profile: SocialOAuthProfile,
  tokens: SocialOAuthTokens,
) {
  const connection: StoredSocialConnection = {
    provider,
    accountId: profile.accountId,
    displayName: profile.displayName,
    profileImageUrl: profile.profileImageUrl,
    scopes: tokens.scopes,
    connectedAt: new Date().toISOString(),
    tokenExpiresAt: tokens.expiresAt,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
  const cookieStore = await cookies();
  cookieStore.set(connectionCookieName(provider), encrypt(connection), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });
}

export async function getSocialConnection(provider: SocialProviderId) {
  const value = (await cookies()).get(connectionCookieName(provider))?.value;
  return value ? decrypt(value) : null;
}

export async function getSocialConnectionSummaries(providers: readonly SocialProviderId[]) {
  const cookieStore = await cookies();
  const summaries = new Map<SocialProviderId, SocialConnectionSummary>();
  for (const provider of providers) {
    const value = cookieStore.get(connectionCookieName(provider))?.value;
    const connection = value ? decrypt(value) : null;
    if (!connection) continue;
    summaries.set(provider, {
      provider: connection.provider,
      accountId: connection.accountId,
      displayName: connection.displayName,
      profileImageUrl: connection.profileImageUrl,
      scopes: connection.scopes,
      connectedAt: connection.connectedAt,
      tokenExpiresAt: connection.tokenExpiresAt,
    });
  }
  return summaries;
}

export async function deleteSocialConnection(provider: SocialProviderId) {
  (await cookies()).delete(connectionCookieName(provider));
}
