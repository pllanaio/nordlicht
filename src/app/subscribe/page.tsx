import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = { title: "Abo abschließen" };

const planNames: Record<string, string> = {
  starter: "Starter · 39 € / Monat",
  studio: "Studio · 89 € / Monat",
  pro: "Pro · 179 € / Monat",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: requestedPlan } = await searchParams;
  const plan = requestedPlan && planNames[requestedPlan] ? requestedPlan : "pro";

  return (
    <main className="auth-page">
      <section className="auth-page__panel">
        <Link href="/#preise" className="auth-page__back"><ArrowLeft size={17} aria-hidden="true" /> Zu den Preisen</Link>
        <BrandMark />
        <div className="auth-page__intro">
          <h1>Abo aktivieren.</h1>
          <p>Nach bestätigter Mollie-Zahlung wird dein Workspace freigeschaltet.</p>
        </div>
        <CheckoutForm plan={plan} planLabel={planNames[plan]} />
      </section>
      <aside className="auth-page__aside">
        <div>
          <span className="auth-page__aside-label">Zugriff mit aktivem Abo</span>
          <h2>Erst bezahlen. Dann automatisieren.</h2>
          <ul>
            <li><Check aria-hidden="true" /> Kein kostenloser Workspace-Zugang</li>
            <li><Check aria-hidden="true" /> Monatlich kündbares Abonnement</li>
            <li><Check aria-hidden="true" /> Öffentliche Live-Demo zum Kennenlernen</li>
          </ul>
        </div>
        <p>Zahlungsstatus und Workspace-Berechtigung werden serverseitig geprüft.</p>
      </aside>
    </main>
  );
}
