import { NextResponse } from "next/server";
import { createFirstMolliePayment } from "@/lib/integrations/mollie";

const allowedPlans = new Set(["starter", "studio", "pro"]);

export async function POST(request: Request) {
  const body = (await request.json()) as { plan?: string; email?: string; name?: string };
  const plan = body.plan && allowedPlans.has(body.plan) ? body.plan : "studio";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!process.env.MOLLIE_API_KEY || !body.email) {
    return NextResponse.json({
      mode: "demo",
      demoUrl: `/login?plan=${plan}`,
      message: "Mollie wird nach Anmeldung und E-Mail-Erfassung gestartet.",
    });
  }

  try {
    const payment = await createFirstMolliePayment({
      plan,
      email: body.email,
      name: body.name ?? body.email.split("@")[0],
      redirectUrl: `${appUrl}/dashboard?checkout=complete`,
      webhookUrl: `${appUrl}/api/webhooks/mollie`,
    });
    return NextResponse.json({ checkoutUrl: payment.checkoutUrl, paymentId: payment.paymentId });
  } catch (cause) {
    console.error("Mollie checkout failed", cause);
    return NextResponse.json({ error: "Mollie Checkout konnte nicht erstellt werden." }, { status: 502 });
  }
}
