import type { Metadata } from "next";
import { CheckoutComplete } from "@/components/checkout-complete";

export const metadata: Metadata = { title: "Zahlung wird geprüft" };

export default function CheckoutCompletePage() {
  return <CheckoutComplete />;
}
