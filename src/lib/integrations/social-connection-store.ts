import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabasePool } from "@/lib/database";
import type { SubscriptionEntitlement } from "@/lib/subscription-access";
import { ensureWorkspaceContext } from "@/lib/workspace-store";
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
  storage: { mode: "demo" } | { mode: "workspace"; entitlement: SubscriptionEntitlement },
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
  if (storage.mode === "demo") {
    const cookieStore = await cookies();
    cookieStore.set(connectionCookieName(provider), encrypt(connection), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      priority: "high",
    });
    return;
  }

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, storage.entitlement);
    await client.query(
      `insert into social_connection
        (workspace_id, provider, provider_account_id, display_name, profile_image_url,
         encrypted_access_token, token_expires_at, scopes, last_verified_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now())
       on conflict (workspace_id, provider) do update set
         provider_account_id = excluded.provider_account_id,
         display_name = excluded.display_name,
         profile_image_url = excluded.profile_image_url,
         encrypted_access_token = excluded.encrypted_access_token,
         token_expires_at = excluded.token_expires_at,
         scopes = excluded.scopes,
         status = 'connected',
         last_verified_at = now(),
         updated_at = now()`,
      [context.workspaceId, provider, profile.accountId, profile.displayName, profile.profileImageUrl ?? null, Buffer.from(encrypt(connection)), tokens.expiresAt ? new Date(tokens.expiresAt) : null, tokens.scopes],
    );
    await client.query("commit");
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

export async function getSocialConnection(provider: SocialProviderId, storage: { mode: "demo" } | { mode: "workspace"; entitlement: SubscriptionEntitlement }) {
  if (storage.mode === "workspace") {
    const connections = await getSocialConnectionSummaries([provider], storage);
    return connections.get(provider) ?? null;
  }
  const value = (await cookies()).get(connectionCookieName(provider))?.value;
  return value ? decrypt(value) : null;
}

export async function getSocialConnectionSummaries(
  providers: readonly SocialProviderId[],
  storage: { mode: "demo" } | { mode: "workspace"; entitlement: SubscriptionEntitlement },
) {
  const summaries = new Map<SocialProviderId, SocialConnectionSummary>();
  if (storage.mode === "demo") {
    const cookieStore = await cookies();
    for (const provider of providers) {
      const value = cookieStore.get(connectionCookieName(provider))?.value;
      const connection = value ? decrypt(value) : null;
      if (connection) summaries.set(provider, connection);
    }
    return summaries;
  }

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, storage.entitlement);
    const result = await client.query<{ provider: SocialProviderId; encryptedConnection: Buffer }>(
      `select provider, encrypted_access_token as "encryptedConnection"
         from social_connection where workspace_id = $1 and provider = any($2::text[]) and status = 'connected'`,
      [context.workspaceId, providers],
    );
    await client.query("commit");
    for (const row of result.rows) {
      const connection = decrypt(row.encryptedConnection.toString("utf8"));
      if (connection) summaries.set(row.provider, connection);
    }
    return summaries;
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

export async function deleteSocialConnection(provider: SocialProviderId, storage: { mode: "demo" } | { mode: "workspace"; entitlement: SubscriptionEntitlement }) {
  if (storage.mode === "demo") {
    (await cookies()).delete(connectionCookieName(provider));
    return;
  }
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const context = await ensureWorkspaceContext(client, storage.entitlement);
    await client.query("delete from social_connection where workspace_id = $1 and provider = $2", [context.workspaceId, provider]);
    await client.query("commit");
  } catch (cause) {
    await client.query("rollback").catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}
