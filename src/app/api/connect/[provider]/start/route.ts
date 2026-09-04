import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { getOrCreateDemoSessionId } from "@/lib/integrations/demo-session";
import { createOAuthState, isOAuthStateConfigured, oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { isSocialConnectionStoreConfigured } from "@/lib/integrations/social-connection-store";
import {
  getSocialOAuthProvider,
  getSocialOAuthScopes,
  isSocialProviderId,
  type OAuthFlowMode,
} from "@/lib/integrations/social-oauth";

export const runtime = "nodejs";

function appOrigin(request: NextRequest) {
  const configuredOrigin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredOrigin) return request.nextUrl.origin;
  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

function connectorRedirect(request: NextRequest, mode: OAuthFlowMode, provider: string, status: string) {
  const url = new URL(mode === "demo" ? "/demo" : "/dashboard", appOrigin(request));
  url.searchParams.set("view", "integrations");
  url.searchParams.set("provider", provider);
  url.searchParams.set("connection_status", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const mode: OAuthFlowMode = request.nextUrl.searchParams.get("mode") === "demo" ? "demo" : "workspace";

  const { provider: providerParam } = await params;
  if (!isSocialProviderId(providerParam)) {
    return connectorRedirect(request, mode, providerParam, "unsupported");
  }

  const provider = getSocialOAuthProvider(providerParam);
  if (!provider.isConfigured() || !isOAuthStateConfigured() || !isSocialConnectionStoreConfigured()) {
    return connectorRedirect(request, mode, providerParam, "configuration_required");
  }

  const entitlement = mode === "workspace" ? await getSubscriptionEntitlement() : null;
  if (mode === "workspace" && !entitlement) {
    return NextResponse.redirect(new URL("/login?reason=subscription", appOrigin(request)));
  }

  const subject = mode === "demo"
    ? `demo:${await getOrCreateDemoSessionId()}`
    : `subscription:${entitlement!.paymentId}`;
  const scopes = getSocialOAuthScopes(providerParam, mode);

  const redirectUri = new URL(`/api/connect/${providerParam}/callback`, appOrigin(request)).toString();
  const state = createOAuthState({ provider: providerParam, mode, subject, scopes });
  const cookieStore = await cookies();
  cookieStore.set(oauthStateCookieName(providerParam), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/api/connect/${providerParam}/callback`,
    maxAge: 10 * 60,
    priority: "high",
  });

  const response = NextResponse.redirect(provider.createAuthorizationUrl({ redirectUri, state, scopes }));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
