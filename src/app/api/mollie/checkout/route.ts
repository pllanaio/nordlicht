import { NextResponse } from "next/server";
import { createFirstMolliePayment } from "@/lib/integrations/mollie";
import { createCheckoutState } from "@/lib/subscription-access";
import { cookies } from "next/headers";
import { assertSameOrigin, readBoundedJson } from "@/lib/video/validation";

const allowedPlans = new Set(["starter", "studio", "pro"]);

export async function POST(request: Request) {
  let body: { plan?: string; email?: string; name?: string };
  try {
    assertSameOrigin(request);
    const value = await readBoundedJson(request, 4096);
    if (!value || typeof value !== "object") throw new Error("Invalid request");
    body = value;
  } catch { return NextResponse.json({ error: "Ungültige Checkout-Anfrage." }, { status: 400 }); }
  if (typeof body.plan !== "string" || !allowedPlans.has(body.plan)) return NextResponse.json({ error: "Bitte einen gültigen Tarif auswählen." }, { status: 400 });
  const plan = body.plan;
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!process.env.MOLLIE_API_KEY || (process.env.SUBSCRIPTION_SESSION_SECRET?.length ?? 0) < 32) {
    return NextResponse.json({ error: "Der Checkout ist noch nicht konfiguriert. Nutze solange die Live-Demo." }, { status: 503 });
  }
  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || typeof body.name !== "string" || !body.name.trim() || body.name.length > 160) {
    return NextResponse.json({ error: "Name und E-Mail-Adresse sind erforderlich." }, { status: 400 });
  }

  try {
    const payment = await createFirstMolliePayment({
      plan,
      email: body.email,
      name: body.name,
      redirectUrl: `${appUrl}/checkout/complete`,
      webhookUrl: `${appUrl}/api/webhooks/mollie`,
    });
    const state = createCheckoutState(payment.paymentId);
    (await cookies()).set("contentdock_checkout", `${payment.paymentId}:${state}`, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/mollie", maxAge: 24 * 60 * 60,
    });
    return NextResponse.json({
      checkoutUrl: payment.checkoutUrl,
      paymentId: payment.paymentId,
      state,
    });
  } catch {
    console.error("Mollie checkout failed");
    return NextResponse.json({ error: "Mollie Checkout konnte nicht erstellt werden." }, { status: 502 });
  }
}
