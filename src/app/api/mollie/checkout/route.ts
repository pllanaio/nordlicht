import { NextResponse } from "next/server";
import { createFirstMolliePayment } from "@/lib/integrations/mollie";
import { createCheckoutState } from "@/lib/subscription-access";

const allowedPlans = new Set(["starter", "studio", "pro"]);

export async function POST(request: Request) {
  const body = (await request.json()) as { plan?: string; email?: string; name?: string };
  const plan = body.plan && allowedPlans.has(body.plan) ? body.plan : "studio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!process.env.MOLLIE_API_KEY || !process.env.SUBSCRIPTION_SESSION_SECRET) {
    return NextResponse.json({ error: "Der Checkout ist noch nicht konfiguriert. Nutze solange die Live-Demo." }, { status: 503 });
  }
  if (!body.email || !body.name) {
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
    return NextResponse.json({
      checkoutUrl: payment.checkoutUrl,
      paymentId: payment.paymentId,
      state: createCheckoutState(payment.paymentId),
    });
  } catch (cause) {
    console.error("Mollie checkout failed", cause);
    return NextResponse.json({ error: "Mollie Checkout konnte nicht erstellt werden." }, { status: 502 });
  }
}
