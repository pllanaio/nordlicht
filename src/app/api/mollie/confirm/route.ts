import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMolliePayment } from "@/lib/integrations/mollie";
import {
  createSubscriptionToken,
  subscriptionCookieName,
  verifyCheckoutState,
} from "@/lib/subscription-access";

const allowedPlans = new Set(["starter", "studio", "pro"]);

export async function POST(request: Request) {
  const body = (await request.json()) as { paymentId?: string; state?: string };
  if (!body.paymentId || !body.state || !verifyCheckoutState(body.paymentId, body.state)) {
    return NextResponse.json({ error: "Ungültige Checkout-Sitzung." }, { status: 400 });
  }

  try {
    const payment = await getMolliePayment(body.paymentId);
    const plan = payment.metadata?.plan;
    if (payment.status !== "paid") {
      return NextResponse.json({ error: "Die Zahlung ist noch nicht bestätigt." }, { status: 409 });
    }
    if (typeof plan !== "string" || !allowedPlans.has(plan)) {
      return NextResponse.json({ error: "Der Zahlungsplan konnte nicht zugeordnet werden." }, { status: 422 });
    }

    const token = createSubscriptionToken({ paymentId: payment.id, plan });
    (await cookies()).set(subscriptionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({ redirectUrl: "/dashboard" });
  } catch (cause) {
    console.error("Mollie confirmation failed", cause);
    return NextResponse.json({ error: "Zahlung konnte nicht verifiziert werden." }, { status: 502 });
  }
}
