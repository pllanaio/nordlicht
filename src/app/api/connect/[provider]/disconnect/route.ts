import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { deleteSocialConnection } from "@/lib/integrations/social-connection-store";
import { isSocialProviderId } from "@/lib/integrations/social-oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const mode = request.nextUrl.searchParams.get("mode") === "demo" ? "demo" : "workspace";
  if (mode === "workspace" && !(await getSubscriptionEntitlement())) {
    return NextResponse.redirect(new URL("/login?reason=subscription", request.url), 303);
  }

  const { provider } = await params;
  if (!isSocialProviderId(provider)) {
    return Response.json({ error: "Unsupported social provider" }, { status: 404 });
  }

  await deleteSocialConnection(provider);
  const url = new URL(mode === "demo" ? "/demo" : "/dashboard", request.url);
  url.searchParams.set("view", "integrations");
  url.searchParams.set("provider", provider);
  url.searchParams.set("connection_status", "disconnected");
  return NextResponse.redirect(url, 303);
}
