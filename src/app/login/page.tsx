import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { hasInternalTestAccounts } from "@/lib/internal-test-accounts";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; reason?: string }>;
}) {
  const { plan, reason } = await searchParams;
  const testAccessConfigured = hasInternalTestAccounts();
  return (
    <main className="auth-page">
      <section className="auth-page__panel">
        <Link href="/" className="auth-page__back"><ArrowLeft size={17} aria-hidden="true" /> Zurück</Link>
        <BrandMark />
        <div className="auth-page__intro">
          <h1>Willkommen zurück.</h1>
          <p>Der Workspace steht ausschließlich Kunden mit aktivem Abonnement zur Verfügung.</p>
        </div>
        {reason === "subscription" ? (
          <div className="subscription-required" role="status">
            <strong>Aktives Abo erforderlich</strong>
            <span>Zum Kennenlernen kannst du die Live-Demo öffnen oder direkt einen Plan auswählen.</span>
            <div><Link href="/demo">Live-Demo</Link><Link href="/#preise">Abo auswählen</Link></div>
          </div>
        ) : null}
        <LoginForm plan={plan} testAccessConfigured={testAccessConfigured} />
      </section>
      <aside className="auth-page__aside">
        <div>
          <span className="auth-page__aside-label">Nordlicht Studio</span>
          <h2>Diese Woche ist fast bereit.</h2>
          <ul>
            <li><Check aria-hidden="true" /> 6 Inhalte geplant</li>
            <li><Check aria-hidden="true" /> 1 Freigabe offen</li>
            <li><Check aria-hidden="true" /> 3 Kanäle verbunden</li>
          </ul>
        </div>
        <p>Die Live-Demo ist öffentlich. Abos und interne Testkonten werden ausschließlich serverseitig freigeschaltet.</p>
      </aside>
    </main>
  );
}
