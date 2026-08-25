import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { createOAuthState, isOAuthStateConfigured, oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { isSocialConnectionStoreConfigured } from "@/lib/integrations/social-connection-store";
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

  const provider = getSocialOAuthProvider(providerParam);
  if (!provider.isConfigured() || !isOAuthStateConfigured() || !isSocialConnectionStoreConfigured()) {
    return dashboardRedirect(request, providerParam, "configuration_required");
  }

  const redirectUri = new URL(`/api/connect/${providerParam}/callback`, appOrigin(request)).toString();
  const state = createOAuthState(providerParam, entitlement.paymentId);
  const cookieStore = await cookies();
  cookieStore.set(oauthStateCookieName(providerParam), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/api/connect/${providerParam}/callback`,
    maxAge: 10 * 60,
    priority: "high",
  });

  const response = NextResponse.redirect(provider.createAuthorizationUrl({ redirectUri, state }));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
