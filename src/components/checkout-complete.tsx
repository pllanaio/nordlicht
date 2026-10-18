"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, CircleCheck, Clock3, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

const checkoutStorageKey = "contentdock_checkout";
type Status = "checking" | "pending" | "success" | "error" | "missing" | "canceled" | "expired" | "failed";

export function CheckoutComplete() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("Der Zahlungsstatus wird abgerufen. Bitte lasse diese Seite geöffnet.");
  const [waitingFinished, setWaitingFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reference, setReference] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    const controller = new AbortController();
    async function confirmPayment() {
      try {
        const stored = window.sessionStorage.getItem(checkoutStorageKey);
        if (!stored) { setStatus("missing"); setMessage("Die Angaben zu deiner Zahlung fehlen in diesem Tab. Öffne die Bestätigung in dem Tab und Browser, in dem du die Zahlung begonnen hast."); return; }
        const checkout = JSON.parse(stored) as { paymentId?: string; state?: string };
        if (typeof checkout.paymentId !== "string" || typeof checkout.state !== "string") throw new Error("Die Zahlungsangaben konnten nicht gelesen werden. Öffne die Bestätigung im ursprünglichen Tab.");
        const response = await fetch("/api/mollie/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: checkout.paymentId, state: checkout.state }), signal: controller.signal });
        const result = (await response.json()) as { redirectUrl?: string; error?: string; paymentStatus?: string };
        if (!active) return;
        if (response.status === 409) {
          if (result.paymentStatus === "canceled" || result.paymentStatus === "expired" || result.paymentStatus === "failed") {
            setStatus(result.paymentStatus);
            setMessage(result.paymentStatus === "canceled" ? "Die Zahlung wurde abgebrochen. Dein Zugang wurde nicht freigeschaltet." : result.paymentStatus === "expired" ? "Die Zahlungsfrist ist abgelaufen. Dein Zugang wurde nicht freigeschaltet." : "Die Zahlung ist fehlgeschlagen. Dein Zugang wurde nicht freigeschaltet. Prüfe bei einer angezeigten Abbuchung zuerst die Angaben deines Zahlungsanbieters.");
            return;
          }
          setStatus("pending");
          polls += 1;
          setMessage(polls < 12 ? "Deine Zahlung ist noch nicht bestätigt. Der Status wird automatisch aktualisiert." : "Deine Zahlung ist noch offen. Du kannst den Status später erneut prüfen. Starte keine weitere Zahlung, wenn du bereits bezahlt hast.");
          if (polls < 12) timer = setTimeout(() => void confirmPayment(), 5000);
          else setWaitingFinished(true);
          return;
        }
        if (!response.ok || result.redirectUrl !== "/dashboard") throw new Error(response.status === 403 ? "Der Zugang konnte nicht bestätigt werden. Öffne die Bestätigung im ursprünglichen Browser. Wenn du bereits bezahlt hast, starte keine neue Zahlung." : "Der Zahlungsstatus ist gerade nicht verfügbar. Prüfe ihn erneut, ohne eine neue Zahlung zu starten.");
        setReference(checkout.paymentId);
        setStatus("success");
        setMessage("Deine Zahlung wurde bestätigt und der Zugang ist freigeschaltet. Du kannst jetzt deinen Workspace öffnen.");
        try { window.sessionStorage.removeItem(checkoutStorageKey); } catch { /* Confirmation is complete even if storage cleanup is unavailable. */ }
      } catch (cause) {
        if (!active) return;
        setStatus("error");
        setMessage(cause instanceof Error && cause.name !== "TypeError" ? cause.message : "Der Zahlungsstatus konnte nicht abgerufen werden. Prüfe deine Verbindung und versuche es erneut.");
      }
    }
    timer = setTimeout(() => void confirmPayment(), 0);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [attempt]);

  return (
    <main className="checkout-complete" id="main-content" tabIndex={-1}>
      <div className="auth-page__utility"><Link href="/" aria-label="ContentDock Startseite"><BrandMark /></Link><ThemeToggle /></div>
      <div className="checkout-complete__icon">{status === "checking" ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : status === "success" ? <CircleCheck aria-hidden="true" /> : status === "pending" ? <Clock3 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}</div>
      <h1>{status === "checking" ? "Zahlung wird geprüft." : status === "success" ? "Dein Zugang ist bereit." : status === "pending" ? "Zahlung noch offen." : status === "canceled" ? "Zahlung abgebrochen." : status === "expired" ? "Zahlungsfrist abgelaufen." : status === "failed" ? "Zahlung fehlgeschlagen." : "Bestätigung ausstehend."}</h1>
      <p role="status" aria-live="polite">{message}</p>
      {reference ? <p className="checkout-complete__reference">Zahlungsreferenz: <strong>{reference}</strong></p> : null}
      {status === "success" ? <Link className="button" href="/dashboard">Workspace öffnen <ArrowRight aria-hidden="true" /></Link> : null}
      {status === "error" || (status === "pending" && waitingFinished) ? <button className="button" type="button" onClick={() => { setStatus("checking"); setWaitingFinished(false); setMessage("Der Zahlungsstatus wird erneut abgerufen."); setAttempt((value) => value + 1); }}>Zahlungsstatus erneut prüfen</button> : null}
      {status === "pending" ? <p className="auth-form__hint">Die Verarbeitung kann einige Minuten dauern. Bei Fragen halte deine Zahlungsbestätigung bereit.</p> : null}
      {status === "missing" ? <Link className="button" href="/dashboard">Bestehenden Zugang prüfen <ArrowRight aria-hidden="true" /></Link> : null}
      <Link className="text-link" href="/">Zur Startseite</Link>
    </main>
  );
}
