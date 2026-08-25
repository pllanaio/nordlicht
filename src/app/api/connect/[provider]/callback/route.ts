import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { oauthStateCookieName, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { saveSocialConnection } from "@/lib/integrations/social-connection-store";
import { getSocialOAuthProvider, isSocialProviderId } from "@/lib/integrations/social-oauth";

export const runtime = "nodejs";

function appOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredOrigin) return request.nextUrl.origin;
  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

function dashboardRedirect(request: NextRequest, provider: string, status: string) {
  const url = new URL("/dashboard", appOrigin(request));
  url.searchParams.set("view", "integrations");
  url.searchParams.set("provider", provider);
  url.searchParams.set("connection_status", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const entitlement = await getSubscriptionEntitlement();
  if (!entitlement) {
    return NextResponse.redirect(new URL("/login?reason=subscription", appOrigin(request)));
  }

  const { provider: providerParam } = await params;
  if (!isSocialProviderId(providerParam)) {
    return dashboardRedirect(request, providerParam, "unsupported");
  }

  const cookieStore = await cookies();
  const stateCookieName = oauthStateCookieName(providerParam);
  const cookieState = cookieStore.get(stateCookieName)?.value;
  cookieStore.delete(stateCookieName);

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return dashboardRedirect(request, providerParam, "denied");
  if (!state || !code || !cookieState || cookieState !== state) {
    return dashboardRedirect(request, providerParam, "invalid_state");
  }
  if (!verifyOAuthState(state, providerParam, entitlement.paymentId)) {
    return dashboardRedirect(request, providerParam, "invalid_state");
  }

  const provider = getSocialOAuthProvider(providerParam);
  if (!provider.isConfigured()) return dashboardRedirect(request, providerParam, "configuration_required");

  const redirectUri = new URL(`/api/connect/${providerParam}/callback`, appOrigin(request)).toString();
  try {
    const tokens = await provider.exchangeCode({ code, redirectUri });
    const profile = await provider.getProfile(tokens.accessToken);
    await saveSocialConnection(providerParam, profile, tokens);
  } catch (error) {
    console.error(`OAuth callback failed for ${providerParam}`, error instanceof Error ? error.message : "Unknown error");
    return dashboardRedirect(request, providerParam, "failed");
  }

  return dashboardRedirect(request, providerParam, "connected");
}
