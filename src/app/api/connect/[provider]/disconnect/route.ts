import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { deleteSocialConnection } from "@/lib/integrations/social-connection-store";
import { isSocialProviderId } from "@/lib/integrations/social-oauth";
import { assertSameOrigin } from "@/lib/video/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "Ungültiger Anfrageursprung." }, { status: 403 }); }
  const mode = request.nextUrl.searchParams.get("mode") === "demo" ? "demo" : "workspace";
  const entitlement = mode === "workspace" ? await getSubscriptionEntitlement() : null;
  if (mode === "workspace" && !entitlement) {
    return NextResponse.redirect(new URL("/login?reason=subscription", request.url), 303);
  }

  const { provider } = await params;
  if (!isSocialProviderId(provider)) {
    return Response.json({ error: "Unsupported social provider" }, { status: 404 });
  }

  try {
    await deleteSocialConnection(provider, mode === "demo" ? { mode: "demo" } : { mode: "workspace", entitlement: entitlement! });
  } catch {
    return NextResponse.json({ error: "Die Verbindung konnte mit deinen Berechtigungen nicht getrennt werden." }, { status: 403 });
  }
  const url = new URL(mode === "demo" ? "/demo" : "/dashboard", request.url);
  url.searchParams.set("view", "integrations");
  url.searchParams.set("provider", provider);
  url.searchParams.set("connection_status", "disconnected");
  return NextResponse.redirect(url, 303);
}
