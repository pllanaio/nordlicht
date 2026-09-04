import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { getDemoSessionId } from "@/lib/integrations/demo-session";
import { oauthStateCookieName, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { saveSocialConnection } from "@/lib/integrations/social-connection-store";
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
  const { provider: providerParam } = await params;
  if (!isSocialProviderId(providerParam)) {
    return connectorRedirect(request, "demo", providerParam, "unsupported");
  }

  const cookieStore = await cookies();
  const stateCookieName = oauthStateCookieName(providerParam);
  const cookieState = cookieStore.get(stateCookieName)?.value;
  cookieStore.delete(stateCookieName);

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  if (!state || !cookieState || cookieState !== state) {
    return connectorRedirect(request, "demo", providerParam, "invalid_state");
  }

  const oauthState = verifyOAuthState(state, providerParam);
  if (!oauthState) return connectorRedirect(request, "demo", providerParam, "invalid_state");

  const expectedScopes = getSocialOAuthScopes(providerParam, oauthState.mode);
  if (expectedScopes.length !== oauthState.scopes.length || expectedScopes.some((scope) => !oauthState.scopes.includes(scope))) {
    return connectorRedirect(request, oauthState.mode, providerParam, "invalid_state");
  }

  let workspaceEntitlement = null;
  if (oauthState.mode === "demo") {
    const demoSessionId = await getDemoSessionId();
    if (!demoSessionId || oauthState.subject !== `demo:${demoSessionId}`) {
      return connectorRedirect(request, "demo", providerParam, "invalid_state");
    }
  } else {
    workspaceEntitlement = await getSubscriptionEntitlement();
    if (!workspaceEntitlement) return NextResponse.redirect(new URL("/login?reason=subscription", appOrigin(request)));
    if (oauthState.subject !== `subscription:${workspaceEntitlement.paymentId}`) {
      return connectorRedirect(request, "workspace", providerParam, "invalid_state");
    }
  }

  if (providerError) return connectorRedirect(request, oauthState.mode, providerParam, "denied");
  if (!code) return connectorRedirect(request, oauthState.mode, providerParam, "failed");

  const provider = getSocialOAuthProvider(providerParam);
  if (!provider.isConfigured()) return connectorRedirect(request, oauthState.mode, providerParam, "configuration_required");

  const redirectUri = new URL(`/api/connect/${providerParam}/callback`, appOrigin(request)).toString();
  try {
    const tokens = await provider.exchangeCode({ code, redirectUri, requestedScopes: oauthState.scopes });
    const profile = await provider.getProfile(tokens.accessToken);
    await saveSocialConnection(
      providerParam,
      profile,
      tokens,
      oauthState.mode === "demo" ? { mode: "demo" } : { mode: "workspace", entitlement: workspaceEntitlement! },
    );
  } catch (error) {
    console.error(`OAuth callback failed for ${providerParam}`, error instanceof Error ? error.message : "Unknown error");
    return connectorRedirect(request, oauthState.mode, providerParam, "failed");
  }

  return connectorRedirect(request, oauthState.mode, providerParam, "connected");
}
