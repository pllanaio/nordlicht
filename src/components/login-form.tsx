"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function LoginForm({ plan }: { plan?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => router.push("/dashboard"), 450);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {plan ? <div className="auth-form__plan">Ausgewählter Plan: <strong>{plan}</strong></div> : null}
      <label>
        E-Mail-Adresse
        <input type="email" required defaultValue="lea@nordlicht.studio" autoComplete="email" />
      </label>
      <label>
        Passwort
        <input type="password" required defaultValue="contentdock-demo" autoComplete="current-password" />
      </label>
      <div className="auth-form__meta"><label><input type="checkbox" /> Angemeldet bleiben</label><a href="#">Passwort vergessen?</a></div>
      <button className="button auth-form__submit" disabled={loading}>
        {loading ? "Workspace wird geöffnet …" : <>Anmelden <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
      <button type="button" className="auth-form__demo" onClick={() => router.push("/dashboard")}>Demo ohne Konto öffnen</button>
      <p>Noch kein Account? <a href="#">Workspace erstellen</a></p>
    </form>
  );
}
