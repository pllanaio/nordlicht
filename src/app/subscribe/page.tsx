import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CheckoutForm } from "@/components/checkout-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPlanId, planCatalog } from "@/lib/plans";

export const metadata: Metadata = { title: "Zugang auswählen" };

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: requestedPlan } = await searchParams;
  const plan = isPlanId(requestedPlan) ? requestedPlan : "starter";
  const selected = planCatalog[plan];
  const checkoutConfigured = Boolean(process.env.MOLLIE_API_KEY && process.env.SUBSCRIPTION_SESSION_SECRET);
  return (
    <main className="auth-page" id="main-content" tabIndex={-1}>
      <section className="auth-page__panel">
        <div className="auth-page__utility"><Link href="/#preise" className="auth-page__back"><ArrowLeft size={17} aria-hidden="true" /> Tarife vergleichen</Link><ThemeToggle /></div>
        <BrandMark />
        <div className="auth-page__intro"><span className="feature-kicker">ContentDock Vorabversion</span><h1>Dein Zugang zu {selected.label}.</h1><p>Prüfe deinen Tarif und deine Angaben. Anschließend wählst du auf der Zahlungsseite eine Zahlungsmethode.</p></div>
        <CheckoutForm plan={plan} planLabel={selected.label} price={selected.price} configured={checkoutConfigured} />
      </section>
      <aside className="auth-page__aside"><div><span className="auth-page__aside-label">Das passiert als Nächstes</span><h2>Ein klarer Start.</h2><ul><li><Check aria-hidden="true" /> Angaben prüfen</li><li><Check aria-hidden="true" /> Zahlung bei Mollie abschließen</li><li><Check aria-hidden="true" /> Bestätigung und Workspace öffnen</li></ul></div><p>Der erste Zugangszeitraum beträgt 30 Tage. Automatische Verlängerung und reguläre Kundenanmeldung sind noch nicht verfügbar.</p></aside>
    </main>
  );
}
