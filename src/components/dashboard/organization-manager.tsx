"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Server, ShieldCheck, Trash2, UserPlus, UsersRound } from "lucide-react";
import type { Organization, OrganizationMember, OrganizationRole, SmtpSettings } from "@/lib/workspace-types";

export type { Organization, OrganizationMember, OrganizationRole, SmtpSettings } from "@/lib/workspace-types";

const emptySmtp: SmtpSettings = { host: "", port: "587", username: "", password: "", fromEmail: "", encryption: "STARTTLS" };

export const initialOrganization: Organization = {
  id: "org-nordlicht",
  name: "Nordlicht Studio",
  members: [
    { id: "member-demo-admin", firstName: "Lea", lastName: "Nordlicht", email: "lea@nordlicht.studio", role: "Administrator", status: "Aktiv" },
    { id: "member-demo-manager", firstName: "Mika", lastName: "Fischer", email: "mika@nordlicht.studio", role: "Manager", status: "Aktiv" },
  ],
  smtp: { host: "smtp.demo.contentdock.local", port: "587", username: "demo@nordlicht.studio", password: "demo-password", fromEmail: "team@nordlicht.studio", encryption: "STARTTLS" },
};

export function OrganizationManager({
  organization,
  demo,
  onChange,
  onDelete,
  onToast,
  currentUser,
  onBeforeInvite,
}: {
  organization: Organization | null;
  demo: boolean;
  onChange: (organization: Organization) => void;
  onDelete: () => void;
  onToast: (message: string) => void;
  currentUser: { firstName: string; lastName: string; email: string };
  onBeforeInvite?: () => Promise<void>;
}) {
  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("Manager");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const currentMember = organization?.members.find((member) => member.email.toLocaleLowerCase() === currentUser.email.toLocaleLowerCase());
  const canAdminister = !organization || organization.members.length === 0 || currentMember?.role === "Administrator";

  function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = organizationName.trim();
    if (!name) return;
    onChange({ id: `org-${Date.now()}`, name, members: [{ id: `member-owner-${Date.now()}`, firstName: currentUser.firstName, lastName: currentUser.lastName, email: currentUser.email, role: "Administrator", status: "Aktiv" }], smtp: emptySmtp });
    setOrganizationName("");
    onToast(`Organisation „${name}“ wurde angelegt.`);
  }

  function updateSmtp(field: keyof SmtpSettings, value: string) {
    if (!organization) return;
    onChange({ ...organization, smtp: { ...organization.smtp, [field]: value } });
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !firstName.trim() || !lastName.trim() || !email.trim()) return;
    const smtpReady = Boolean(organization.smtp.host && organization.smtp.port && organization.smtp.username && organization.smtp.password && organization.smtp.fromEmail);
    if (!smtpReady) {
      onToast("Bitte vervollständige zuerst die SMTP-Konfiguration.");
      return;
    }
    const member: OrganizationMember = {
      id: `member-${Date.now()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      role,
      status: "Eingeladen",
    };
    setSendingInvite(true);
    try {
      if (!demo) {
        await onBeforeInvite?.();
        const response = await fetch("/api/organization/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: organization.name, member }) });
        const result = (await response.json()) as { sent?: boolean; error?: string };
        if (!response.ok || !result.sent) throw new Error(result.error ?? "Die Einladung konnte nicht versendet werden.");
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 550));
      }
      onChange({ ...organization, members: [...organization.members, member] });
      setFirstName("");
      setLastName("");
      setEmail("");
      onToast(demo ? `Demo-Einladung an ${member.email} simuliert.` : `Einladung wurde an ${member.email} versendet.`);
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : "Die Einladung konnte nicht versendet werden.");
    } finally {
      setSendingInvite(false);
    }
  }

  function updateMemberRole(memberId: string, nextRole: OrganizationRole) {
    if (!organization || !canAdminister) return;
    const target = organization.members.find((member) => member.id === memberId);
    const adminCount = organization.members.filter((member) => member.role === "Administrator").length;
    if (target?.role === "Administrator" && nextRole !== "Administrator" && adminCount === 1) {
      onToast("Mindestens ein Administrator muss erhalten bleiben.");
      return;
    }
    onChange({ ...organization, members: organization.members.map((member) => member.id === memberId ? { ...member, role: nextRole } : member) });
    onToast("Rolle wurde aktualisiert.");
  }

  function removeMember(memberId: string) {
    if (!organization || !canAdminister) return;
    const target = organization.members.find((member) => member.id === memberId);
    if (target?.role === "Administrator" && organization.members.filter((member) => member.role === "Administrator").length === 1) {
      onToast("Der letzte Administrator kann nicht entfernt werden.");
      return;
    }
    onChange({ ...organization, members: organization.members.filter((member) => member.id !== memberId) });
    onToast("Mitglied wurde aus der Organisation entfernt.");
  }

  if (!organization) {
    return (
      <section className="organization-empty">
        <span><Building2 aria-hidden="true" /></span>
        <div><span className="feature-kicker">Neuer Workspace</span><h2>Organisation von Grund auf anlegen</h2><p>{demo ? "Die Demo-Organisation und ihre lokalen Inhalte wurden entfernt." : "Die bisherige Organisation und ihre Workspace-Daten wurden entfernt."} Lege jetzt einen leeren Workspace an.</p></div>
        <form onSubmit={createOrganization}><label className="composer-field">Name der Organisation<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="z. B. Nordlicht Media GmbH" required /></label><button className="button" type="submit" disabled={!organizationName.trim()}>Organisation anlegen</button></form>
      </section>
    );
  }

  return (
    <div className="organization-manager">
      <section className="organization-manager__summary">
        <div><span className="feature-kicker">Aktive Organisation</span><h2>{organization.name}</h2><p>{organization.members.length} Mitglieder · RBAC aktiviert</p></div>
        <div className="organization-manager__roles"><span><ShieldCheck aria-hidden="true" /><strong>Administrator</strong><small>Vollzugriff auf Organisation, Benutzer, Einstellungen und Content.</small></span><span><UsersRound aria-hidden="true" /><strong>Manager</strong><small>Kann Content erstellen, bearbeiten, hochladen und planen.</small></span></div>
        <div className="organization-manager__danger">{canAdminister ? (confirmDelete ? <><strong>Organisation und lokale Demo-Daten wirklich löschen?</strong><button type="button" onClick={onDelete}>Ja, neu beginnen</button><button type="button" onClick={() => setConfirmDelete(false)}>Abbrechen</button></> : <button type="button" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" /> Organisation löschen</button>) : <><strong>Manager-Zugriff</strong><span>Organisations-, Rollen- und SMTP-Einstellungen sind nur für Administratoren bearbeitbar.</span></>}</div>
      </section>

      <section className="organization-members">
        <header><div><span className="feature-kicker">Benutzer & Rollen</span><h2>Mitglieder verwalten</h2></div><span><UsersRound aria-hidden="true" /> {organization.members.length}</span></header>
        <div className="organization-members__list">
          {organization.members.length ? organization.members.map((member) => (
            <article key={member.id}>
              <span>{member.firstName.slice(0, 1)}{member.lastName.slice(0, 1)}</span>
              <div><strong>{member.firstName} {member.lastName}</strong><small>{member.email}</small></div>
              <em className={member.status === "Aktiv" ? "is-active" : ""}>{member.status}</em>
              <select value={member.role} onChange={(event) => updateMemberRole(member.id, event.target.value as OrganizationRole)} aria-label={`Rolle von ${member.firstName} ${member.lastName}`} disabled={!canAdminister}><option>Administrator</option><option>Manager</option></select>
              <button type="button" onClick={() => removeMember(member.id)} aria-label={`${member.firstName} ${member.lastName} entfernen`} disabled={!canAdminister}><Trash2 aria-hidden="true" /></button>
            </article>
          )) : <div className="organization-members__empty">Noch keine Mitglieder. Nutze das Einladungsformular.</div>}
        </div>
        {canAdminister ? <form className="organization-invite" onSubmit={inviteMember}>
          <div><label className="composer-field">Vorname<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label className="composer-field">Nachname<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label></div>
          <div><label className="composer-field">E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@unternehmen.de" required /></label><label className="composer-field">Rolle<select value={role} onChange={(event) => setRole(event.target.value as OrganizationRole)}><option>Manager</option><option>Administrator</option></select></label></div>
          <button className="button" type="submit" disabled={sendingInvite}><UserPlus aria-hidden="true" /> {sendingInvite ? "Einladung wird verarbeitet …" : "Benutzer einladen"}</button>
        </form> : <p className="organization-manager__manager-note"><ShieldCheck aria-hidden="true" /> Als Manager kannst du Content bearbeiten, erstellen, hochladen und planen. Benutzerverwaltung bleibt Administratoren vorbehalten.</p>}
      </section>

      <section className="smtp-settings">
        <header><div><span className="feature-kicker">Einladungsversand</span><h2>SMTP-Zugang hinterlegen</h2><p>{demo ? "Tech-Demo: Zugangsdaten bleiben nur in dieser Sitzung; es wird keine echte E-Mail gesendet." : "Das SMTP-Passwort wird verschlüsselt im Workspace gespeichert und bei Einladungen nicht wieder an den Browser übertragen."}</p></div><Server aria-hidden="true" /></header>
        <div className="smtp-settings__grid">
          <label className="composer-field">SMTP-Host<input value={organization.smtp.host} onChange={(event) => updateSmtp("host", event.target.value)} placeholder="smtp.example.com" disabled={!canAdminister} /></label>
          <label className="composer-field">Port<input inputMode="numeric" value={organization.smtp.port} onChange={(event) => updateSmtp("port", event.target.value)} disabled={!canAdminister} /></label>
          <label className="composer-field">Benutzername<input value={organization.smtp.username} onChange={(event) => updateSmtp("username", event.target.value)} autoComplete="off" disabled={!canAdminister} /></label>
          <label className="composer-field">Passwort<input type="password" value={organization.smtp.password} onChange={(event) => updateSmtp("password", event.target.value)} autoComplete="new-password" disabled={!canAdminister} /></label>
          <label className="composer-field">Absenderadresse<input type="email" value={organization.smtp.fromEmail} onChange={(event) => updateSmtp("fromEmail", event.target.value)} disabled={!canAdminister} /></label>
          <label className="composer-field">Verschlüsselung<select value={organization.smtp.encryption} onChange={(event) => updateSmtp("encryption", event.target.value)} disabled={!canAdminister}><option>STARTTLS</option><option>SSL/TLS</option></select></label>
        </div>
        <p className="smtp-settings__status"><CheckCircle2 aria-hidden="true" /> {organization.smtp.host && organization.smtp.password ? "SMTP-Konfiguration vollständig" : "SMTP-Konfiguration unvollständig"}</p>
      </section>
    </div>
  );
}
