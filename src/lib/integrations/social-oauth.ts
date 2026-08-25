import "server-only";

import type { SocialProviderId } from "./contracts";

const requestTimeoutMs = 20_000;

export type SocialOAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
};

export type SocialOAuthProfile = {
  accountId: string;
  displayName: string;
  profileImageUrl?: string;
};

export type OAuthFlowMode = "demo" | "workspace";

type OAuthProvider = {
  id: SocialProviderId;
  label: string;
  description: string;
  docsUrl: string;
  identityScopes: string[];
  publishingScopes: string[];
  isConfigured(): boolean;
  createAuthorizationUrl(input: { redirectUri: string; state: string; scopes: string[] }): URL;
  exchangeCode(input: { code: string; redirectUri: string; requestedScopes: string[] }): Promise<SocialOAuthTokens>;
  getProfile(accessToken: string): Promise<SocialOAuthProfile>;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & { error?: unknown; error_description?: string }) | null;
  if (!response.ok || !data) {
    throw new Error(data?.error_description ?? fallbackMessage);
  }
  return data;
}

function requireAccessToken(data: TokenResponse, fallbackMessage: string) {
  if (!data.access_token) throw new Error(data.error_description ?? data.error ?? fallbackMessage);
  return data.access_token;
}

function expiresAtFromSeconds(expiresIn?: number) {
  return typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1_000).toISOString() : undefined;
}

function parseScopes(scope: string | undefined, fallback: string[]) {
  if (!scope) return fallback;
  return scope.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

const instagram: OAuthProvider = {
  id: "instagram",
  label: "Instagram",
  description: "Professional Account für Posts, Reels und Insights verbinden.",
  docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
  identityScopes: ["instagram_business_basic"],
  publishingScopes: ["instagram_business_content_publish"],
  isConfigured() {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  },
  createAuthorizationUrl({ redirectUri, state, scopes }) {
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", process.env.META_APP_ID!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", state);
    url.searchParams.set("force_authentication", "1");
    return url;
  },
  async exchangeCode({ code, redirectUri, requestedScopes }) {
    const body = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const response = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const shortLived = await readJson<TokenResponse>(response, "Instagram token exchange failed");
    const shortAccessToken = requireAccessToken(shortLived, "Instagram returned no access token");

    const exchangeUrl = new URL("https://graph.instagram.com/access_token");
    exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
    exchangeUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    exchangeUrl.searchParams.set("access_token", shortAccessToken);
    const longLivedResponse = await fetch(exchangeUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const longLived = await readJson<TokenResponse>(longLivedResponse, "Instagram long-lived token exchange failed");
    const accessToken = requireAccessToken(longLived, "Instagram returned no long-lived access token");

    return {
      accessToken,
      expiresAt: expiresAtFromSeconds(longLived.expires_in),
      scopes: requestedScopes,
    };
  },
  async getProfile(accessToken) {
    const url = new URL("https://graph.instagram.com/me");
    url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const data = await readJson<{
      id?: string;
      user_id?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    }>(response, "Instagram profile request failed");
    const accountId = data.user_id ?? data.id;
    if (!accountId) throw new Error("Instagram returned no account identifier");
    return {
      accountId,
      displayName: data.name || (data.username ? `@${data.username}` : "Instagram Account"),
      profileImageUrl: data.profile_picture_url,
    };
  },
};

const linkedin: OAuthProvider = {
  id: "linkedin",
  label: "LinkedIn",
  description: "Persönliches Profil für geplante LinkedIn-Beiträge verbinden.",
  docsUrl: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication",
  identityScopes: ["openid", "profile", "email"],
  publishingScopes: ["w_member_social"],
  isConfigured() {
    return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  },
  createAuthorizationUrl({ redirectUri, state, scopes }) {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    return url;
  },
  async exchangeCode({ code, redirectUri, requestedScopes }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    });
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const data = await readJson<TokenResponse>(response, "LinkedIn token exchange failed");
    return {
      accessToken: requireAccessToken(data, "LinkedIn returned no access token"),
      refreshToken: data.refresh_token,
      expiresAt: expiresAtFromSeconds(data.expires_in),
      scopes: parseScopes(data.scope, requestedScopes),
    };
  },
  async getProfile(accessToken) {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const data = await readJson<{ sub?: string; name?: string; picture?: string }>(response, "LinkedIn profile request failed");
    if (!data.sub) throw new Error("LinkedIn returned no account identifier");
    return {
      accountId: data.sub,
      displayName: data.name || "LinkedIn Profil",
      profileImageUrl: data.picture,
    };
  },
};

const tiktok: OAuthProvider = {
  id: "tiktok",
  label: "TikTok",
  description: "TikTok-Konto für geprüfte Direct Posts und Video-Uploads verbinden.",
  docsUrl: "https://developers.tiktok.com/doc/login-kit-web",
  identityScopes: ["user.info.basic"],
  publishingScopes: ["video.publish"],
  isConfigured() {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  },
  createAuthorizationUrl({ redirectUri, state, scopes }) {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", state);
    return url;
  },
  async exchangeCode({ code, redirectUri, requestedScopes }) {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const data = await readJson<TokenResponse>(response, "TikTok token exchange failed");
    return {
      accessToken: requireAccessToken(data, "TikTok returned no access token"),
      refreshToken: data.refresh_token,
      expiresAt: expiresAtFromSeconds(data.expires_in),
      scopes: parseScopes(data.scope, requestedScopes),
    };
  },
  async getProfile(accessToken) {
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set("fields", "open_id,display_name,avatar_url");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const data = await readJson<{
      data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
      error?: { message?: string };
    }>(response, "TikTok profile request failed");
    const user = data.data?.user;
    if (!user?.open_id) throw new Error(data.error?.message ?? "TikTok returned no account identifier");
    return {
      accountId: user.open_id,
      displayName: user.display_name || "TikTok Account",
      profileImageUrl: user.avatar_url,
    };
  },
};

const providers: Record<SocialProviderId, OAuthProvider> = { instagram, linkedin, tiktok };

export const socialProviderIds = Object.freeze(Object.keys(providers) as SocialProviderId[]);

export function isSocialProviderId(value: string): value is SocialProviderId {
  return socialProviderIds.includes(value as SocialProviderId);
}

export function getSocialOAuthProvider(provider: SocialProviderId) {
  return providers[provider];
}

export function getSocialOAuthScopes(provider: SocialProviderId, mode: OAuthFlowMode) {
  const definition = providers[provider];
  return mode === "demo"
    ? [...definition.identityScopes]
    : [...definition.identityScopes, ...definition.publishingScopes];
}

export function getSocialPublishingScopes(provider: SocialProviderId) {
  return [...providers[provider].publishingScopes];
}
