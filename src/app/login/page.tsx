import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSubscriptionEntitlement } from "@/lib/subscription-access";
import { hasInternalTestAccounts } from "@/lib/internal-test-accounts";
import { isPlanId, planCatalog } from "@/lib/plans";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ plan?: string; reason?: string }> }) {
  const [query, entitlement] = await Promise.all([searchParams, getSubscriptionEntitlement()]);
  if (entitlement) redirect("/dashboard");
  const { plan, reason } = query;
  return (
    <main className="auth-page" id="main-content" tabIndex={-1}>
      <section className="auth-page__panel">
        <div className="auth-page__utility"><Link href="/" className="auth-page__back"><ArrowLeft size={17} aria-hidden="true" /> Zur Startseite</Link><ThemeToggle /></div>
        <BrandMark />
        <div className="auth-page__intro"><span className="feature-kicker">ContentDock Vorabversion</span><h1>Willkommen zurück.</h1><p>Melde dich mit deinem freigeschalteten Testkonto an.</p></div>
        {reason === "subscription" ? <div className="subscription-required" role="status"><strong>Dein Zugang konnte nicht bestätigt werden.</strong><span>Melde dich mit einem Testkonto an oder öffne die öffentliche Demo.</span></div> : null}
        <LoginForm plan={isPlanId(plan) ? planCatalog[plan].label : undefined} testAccessConfigured={hasInternalTestAccounts()} />
      </section>
      <aside className="auth-page__aside"><div><span className="auth-page__aside-label">Ideen werden Videos</span><h2>Alles bereit für deinen nächsten Beitrag.</h2><ul><li><Check aria-hidden="true" /> Inhalte an einem Ort sammeln</li><li><Check aria-hidden="true" /> Kurzvideos mit KI erstellen</li><li><Check aria-hidden="true" /> Gemeinsam prüfen und veröffentlichen</li></ul></div><p>Die Demo zeigt Beispieldaten und benötigt kein Konto.</p></aside>
    </main>
  );
}
