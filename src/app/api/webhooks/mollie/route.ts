import { NextResponse } from "next/server";
import { getMolliePayment } from "@/lib/integrations/mollie";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return NextResponse.json({ error: "Missing payment id" }, { status: 400 });

  // Mollie webhooks contain only an ID. Always fetch the authoritative payment state.
  const payment = await getMolliePayment(id);
  console.info("Mollie payment update", { id: payment.id, status: payment.status });

  // Production: persist idempotently, verify metadata/user mapping, and create the
  // subscription only after the first payment has produced a valid mandate.
  return new NextResponse(null, { status: 200 });
}
