import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-page__panel">
        <Link href="/" className="auth-page__back"><ArrowLeft size={17} aria-hidden="true" /> Zurück</Link>
        <BrandMark />
        <div className="auth-page__intro">
          <h1>Willkommen zurück.</h1>
          <p>Melde dich an und bring deinen Content in den nächsten ruhigen Workflow.</p>
        </div>
        <LoginForm plan={plan} />
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
        <p>Demo-MVP · Authentifizierung wird vor Produktion an einen Identity Provider angebunden.</p>
      </aside>
    </main>
  );
}
