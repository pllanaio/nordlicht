"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const checkoutStorageKey = "contentdock_checkout";

export function CheckoutForm({ plan, planLabel, price, configured }: { plan: string; planLabel: string; price: string; configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);

  function validate(field: HTMLInputElement) {
    const message = field.name === "name" && !field.value.trim() ? "Gib deinen Namen ein." : field.name === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) ? "Gib eine gültige E-Mail-Adresse ein." : "";
    setErrors((current) => ({ ...current, [field.name]: message }));
    return !message;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = Array.from(event.currentTarget.querySelectorAll("input"));
    const invalid = fields.filter((field) => !validate(field));
    if (invalid.length) { invalid[0].focus(); return; }
    submitting.current = true;
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      // Check persistence before creating a payment: the return page needs this state.
      try { window.sessionStorage.setItem("contentdock_checkout_storage_check", "1"); window.sessionStorage.removeItem("contentdock_checkout_storage_check"); }
      catch { throw new Error("Dein Browser blockiert den Sitzungsspeicher. Erlaube ihn für diese Seite, damit deine Zahlung zugeordnet werden kann."); }
      const response = await fetch("/api/mollie/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, name: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim() }),
      });
      const result = (await response.json()) as { checkoutUrl?: string; paymentId?: string; state?: string; error?: string };
      if (!response.ok || !result.checkoutUrl || !result.paymentId || !result.state) throw new Error("Die Zahlungsseite konnte nicht geöffnet werden. Deine Angaben bleiben erhalten. Versuche es später erneut.");
      window.sessionStorage.setItem(checkoutStorageKey, JSON.stringify({ paymentId: result.paymentId, state: result.state, planLabel, price }));
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Zahlungsseite konnte nicht geöffnet werden. Versuche es später erneut.");
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={loading} aria-describedby="checkout-terms">
      <div className="checkout-summary"><div><span>Tarif</span><strong>{planLabel}</strong></div><div><span>Erste 30 Tage</span><strong>{price}</strong></div><Link href="/#preise">Tarif ändern</Link></div>
      <p id="checkout-terms" className="auth-form__hint">Zugang für 30 Tage ab bestätigter Zahlung. Aktuell erfolgt keine automatische Verlängerung. Die reguläre Kundenanmeldung ist noch nicht verfügbar.</p>
      {configured ? <>
        <p className="auth-form__hint">Beide Angaben sind erforderlich.</p>
        <label htmlFor="checkout-name">Name</label><input id="checkout-name" name="name" required maxLength={160} autoComplete="name" onBlur={(event) => validate(event.currentTarget)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "checkout-name-error" : undefined} />
        {errors.name ? <p className="auth-field-error" id="checkout-name-error">{errors.name}</p> : null}
        <label htmlFor="checkout-email">E-Mail-Adresse</label><input id="checkout-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} onBlur={(event) => validate(event.currentTarget)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "checkout-email-error" : "checkout-email-hint"} />
        {errors.email ? <p className="auth-field-error" id="checkout-email-error">{errors.email}</p> : <p id="checkout-email-hint" className="auth-form__hint">Damit deine Zahlung deinem Zugang zugeordnet werden kann.</p>}
        {error ? <p className="checkout-error" role="alert">{error}</p> : null}
        <button className="button auth-form__submit" type="submit" disabled={loading}>{loading ? "Zahlungsseite wird geöffnet …" : <>Zahlungspflichtig bestellen · {price} <ArrowRight size={17} aria-hidden="true" /></>}</button>
        <span className="visually-hidden" role="status">{loading ? "Die Zahlungsseite wird geöffnet." : ""}</span>
      </> : <div className="form-status" role="status"><strong>Zahlung derzeit nicht verfügbar</strong><p>Die Vorabversion kannst du bereits in der Demo kennenlernen.</p></div>}
      <Link className="auth-form__demo" href="/demo">Demo ausprobieren</Link>
    </form>
  );
}
