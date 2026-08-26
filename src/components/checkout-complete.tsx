"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const checkoutStorageKey = "contentdock_checkout";

export function CheckoutComplete() {
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [message, setMessage] = useState("Zahlung wird sicher bestätigt …");

  useEffect(() => {
    async function confirmPayment() {
      const stored = window.sessionStorage.getItem(checkoutStorageKey);
      if (!stored) {
        await Promise.resolve();
        setStatus("error");
        setMessage("Die Checkout-Sitzung fehlt. Bitte starte den Vorgang erneut.");
        return;
      }

      try {
        const checkout = JSON.parse(stored) as { paymentId?: string; state?: string };
        const response = await fetch("/api/mollie/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkout),
        });
        const result = (await response.json()) as { redirectUrl?: string; error?: string };
        if (!response.ok || !result.redirectUrl) throw new Error(result.error ?? "Zahlung konnte nicht bestätigt werden.");

        window.sessionStorage.removeItem(checkoutStorageKey);
        window.location.replace(result.redirectUrl);
      } catch (cause) {
        setStatus("error");
        setMessage(cause instanceof Error ? cause.message : "Zahlung konnte nicht bestätigt werden.");
      }
    }

    void confirmPayment();
  }, []);

  return (
    <main className="checkout-complete">
      <BrandMark />
      <div className="checkout-complete__icon">
        {status === "checking" ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
      </div>
      <h1>{status === "checking" ? "Zahlung wird geprüft." : "Noch nicht freigeschaltet."}</h1>
      <p>{message}</p>
      {status === "error" ? <Link className="button" href="/#preise">Abo erneut auswählen</Link> : null}
    </main>
  );
}
