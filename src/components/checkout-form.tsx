"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

const checkoutStorageKey = "contentdock_checkout";

export function CheckoutForm({ plan, planLabel }: { plan: string; planLabel: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/mollie/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          name: form.get("name"),
          email: form.get("email"),
        }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        paymentId?: string;
        state?: string;
        error?: string;
      };

      if (!response.ok || !result.checkoutUrl || !result.paymentId || !result.state) {
        throw new Error(result.error ?? "Checkout konnte nicht gestartet werden.");
      }

      window.sessionStorage.setItem(checkoutStorageKey, JSON.stringify({ paymentId: result.paymentId, state: result.state }));
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout konnte nicht gestartet werden.");
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form__plan">Ausgewähltes Abo: <strong>{planLabel}</strong></div>
      <label>
        Name
        <input name="name" required autoComplete="name" placeholder="Lea Nordlicht" />
      </label>
      <label>
        E-Mail-Adresse
        <input name="email" type="email" required autoComplete="email" placeholder="lea@studio.de" />
      </label>
      {error ? <p className="checkout-error" role="alert">{error}</p> : null}
      <button className="button auth-form__submit" disabled={loading}>
        {loading ? "Sichere Zahlungsseite wird geöffnet …" : <>Zahlungspflichtig abonnieren <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
      <Link className="auth-form__demo" href="/demo">Erst die Live-Demo ansehen</Link>
      <p>Mit Abschluss beginnt dein monatliches Abonnement.</p>
    </form>
  );
}
