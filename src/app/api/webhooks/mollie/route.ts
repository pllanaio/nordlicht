import { NextResponse } from "next/server";
import { getMolliePayment } from "@/lib/integrations/mollie";
import { firstPaymentAccessUntil } from "@/lib/billing-policy";
import { getDatabasePool } from "@/lib/database";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string" || !/^tr_[A-Za-z0-9]{1,100}$/.test(id)) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });

  // Mollie webhooks contain only an ID. Always fetch the authoritative payment state.
  try {
    const payment = await getMolliePayment(id);
    const accessUntil = firstPaymentAccessUntil(payment);
    // Repeated delivery is harmless. Only an already bound payment can affect a workspace.
    await getDatabasePool().query(`update subscription set status = $2, current_period_end = $3,
      access_checked_at = now(), updated_at = now() where mollie_first_payment_id = $1`,
    [payment.id, accessUntil ? "active" : "canceled", accessUntil ? new Date(accessUntil) : new Date()]);
    return new NextResponse(null, { status: 200 });
  } catch {
    console.error("Mollie webhook verification failed");
    return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 });
  }
}
