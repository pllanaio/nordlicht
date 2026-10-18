import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMolliePayment } from "@/lib/integrations/mollie";
import {
  createSubscriptionToken,
  subscriptionCookieName,
  verifyCheckoutState,
} from "@/lib/subscription-access";
import { isPlanId } from "@/lib/plans";
import { firstPaymentAccessUntil } from "@/lib/billing-policy";
import { assertSameOrigin, readBoundedJson } from "@/lib/video/validation";

export async function POST(request: Request) {
  let body: { paymentId?: unknown; state?: unknown };
  try {
    assertSameOrigin(request);
    const value = await readBoundedJson(request, 4096);
    if (!value || typeof value !== "object") throw new Error("Invalid input");
    body = value;
  } catch { return NextResponse.json({ error: "Ungültige Checkout-Sitzung." }, { status: 400 }); }
  if (typeof body.paymentId !== "string" || typeof body.state !== "string" || !verifyCheckoutState(body.paymentId, body.state)) {
    return NextResponse.json({ error: "Ungültige Checkout-Sitzung." }, { status: 400 });
  }
  const checkoutCookie = (await cookies()).get("contentdock_checkout")?.value;
  if (checkoutCookie !== `${body.paymentId}:${body.state}`) return NextResponse.json({ error: "Bitte bestätige die Zahlung in dem Browser, in dem du den Checkout begonnen hast." }, { status: 403 });

  try {
    const payment = await getMolliePayment(body.paymentId);
    const plan = payment.metadata?.plan;
    if (payment.status !== "paid") {
      const paymentStatus = ["open", "pending", "authorized", "canceled", "expired", "failed"].includes(payment.status) ? payment.status : "unknown";
      return NextResponse.json({ error: "Die Zahlung ist nicht abgeschlossen.", paymentStatus }, { status: paymentStatus === "unknown" ? 502 : 409 });
    }
    if (!isPlanId(plan)) {
      return NextResponse.json({ error: "Der Zahlungsplan konnte nicht zugeordnet werden." }, { status: 422 });
    }
    const accessUntil = firstPaymentAccessUntil(payment);
    if (!accessUntil) return NextResponse.json({ error: "Für diese Zahlung besteht kein aktiver Zugangszeitraum." }, { status: 403 });

    const token = createSubscriptionToken({
      paymentId: payment.id,
      plan,
      displayName: payment.metadata?.userName,
      email: payment.metadata?.userEmail,
      accessUntil,
    });
    (await cookies()).set(subscriptionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
    (await cookies()).set("contentdock_checkout", "", { path: "/api/mollie", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });

    return NextResponse.json({ redirectUrl: "/dashboard" });
  } catch {
    console.error("Mollie confirmation failed");
    return NextResponse.json({ error: "Zahlung konnte nicht verifiziert werden." }, { status: 502 });
  }
}
