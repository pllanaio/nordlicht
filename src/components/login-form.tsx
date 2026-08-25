"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loginInternalTestAccount, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm({ plan, testAccessConfigured }: { plan?: string; testAccessConfigured: boolean }) {
  const [state, action, pending] = useActionState(loginInternalTestAccount, initialState);
  return (
    <form className="auth-form" action={action}>
      {plan ? <div className="auth-form__plan">Ausgewählter Plan: <strong>{plan}</strong></div> : null}
      {testAccessConfigured ? <div className="auth-form__test-mode">Interner Testzugang aktiv · Tarif wird serverseitig dem Konto zugeordnet</div> : null}
      <label>
        E-Mail-Adresse
        <input name="email" type="email" required placeholder="name@studio.de" autoComplete="email" />
      </label>
      <label>
        Passwort
        <input name="password" type="password" minLength={12} required placeholder="••••••••••••" autoComplete="current-password" />
      </label>
      <div className="auth-form__meta"><label><input type="checkbox" /> Angemeldet bleiben</label><a href="#">Passwort vergessen?</a></div>
      {state.error ? <p className="checkout-error" role="alert">{state.error}</p> : null}
      <button className="button auth-form__submit" disabled={pending}>
        {pending ? "Zugang wird geprüft …" : <>Anmelden <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
      <Link className="auth-form__demo" href="/demo">Live-Demo ansehen</Link>
      <p>Noch kein Abo? <Link href="/#preise">Plan auswählen</Link></p>
    </form>
  );
}
