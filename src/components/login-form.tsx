"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loginInternalTestAccount, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm({ plan, testAccessConfigured }: { plan?: string; testAccessConfigured: boolean }) {
  const [state, action, pending] = useActionState(loginInternalTestAccount, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!testAccessConfigured) return <div className="auth-form"><div className="form-status" role="status"><strong>Anmeldung noch nicht verfügbar</strong><p>Du kannst ContentDock ohne Konto in der Demo kennenlernen.</p></div><Link className="button auth-form__submit" href="/demo">Demo öffnen <ArrowRight size={17} aria-hidden="true" /></Link></div>;
  function validate(event: React.FocusEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const message = field.validity.valueMissing ? (field.name === "email" ? "Gib deine E-Mail-Adresse ein." : "Gib dein Passwort ein.") : field.validity.typeMismatch ? "Gib eine gültige E-Mail-Adresse ein." : field.validity.tooShort ? "Das Passwort muss mindestens 12 Zeichen enthalten." : "";
    setErrors((current) => ({ ...current, [field.name]: message }));
  }
  return (
    <form className="auth-form" action={action} aria-busy={pending} aria-describedby="login-help">
      {plan ? <div className="auth-form__plan">Ausgewählter Tarif: <strong>{plan}</strong></div> : null}
      <p id="login-help" className="auth-form__hint">Nur für freigeschaltete Testkonten. Beide Angaben sind erforderlich.</p>
      <label htmlFor="login-email">E-Mail-Adresse</label>
      <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required maxLength={254} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} onBlur={validate} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "login-email-error" : undefined} />
      {errors.email ? <p className="auth-field-error" id="login-email-error">{errors.email}</p> : null}
      <label htmlFor="login-password">Passwort</label>
      <input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" minLength={12} maxLength={256} required autoComplete="current-password" onBlur={validate} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "login-password-error" : undefined} />
      {errors.password ? <p className="auth-field-error" id="login-password-error">{errors.password}</p> : null}
      {state.error ? <p className="checkout-error" role="alert">{state.error} Prüfe beide Angaben und versuche es erneut.</p> : null}
      <button className="button auth-form__submit" type="submit" disabled={pending}>{pending ? "Anmeldung wird geprüft …" : <>Anmelden <ArrowRight size={17} aria-hidden="true" /></>}</button>
      <span className="visually-hidden" role="status">{pending ? "Anmeldung wird geprüft." : ""}</span>
      <Link className="auth-form__demo" href="/demo">Demo ohne Anmeldung öffnen</Link>
      <p className="auth-form__hint">Zugangsdaten fehlen? Wende dich an die Person, die deinen Testzugang eingerichtet hat.</p>
    </form>
  );
}
