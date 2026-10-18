"use client";

import Image from "next/image";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Mail, UserRound, X } from "lucide-react";
import type { UserProfile } from "@/lib/workspace-types";

export type { UserProfile } from "@/lib/workspace-types";

export function ProfileDialog({ profile, onClose, onSave }: { profile: UserProfile; onClose: () => void; onSave: (profile: UserProfile, avatarFile?: File) => Promise<void> }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [preview, setPreview] = useState(profile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const localPreview = useRef("");

  useEffect(() => () => {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
  }, []);

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4_000_000) { setError("Wähle ein Bild mit höchstens 4 MB aus."); return; }
    setError("");
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    const nextPreview = URL.createObjectURL(file);
    localPreview.current = nextPreview;
    setAvatarFile(file);
    setPreview(nextPreview);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onSave({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), avatarUrl: profile.avatarUrl }, avatarFile); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut."); }
    finally { setSaving(false); }
  }

  return (
    <DashboardDialog labelledBy="profile-dialog-title" onClose={() => { if (!saving) onClose(); }}>
      <form className="profile-dialog" onSubmit={submit}>
        <header><div><span>Dein Benutzerkonto</span><h2 id="profile-dialog-title">Profil bearbeiten</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Profil schließen"><X /></button></header>
        <div className="profile-dialog__body">
          <label className="profile-avatar">
            {preview ? <Image src={preview} alt="Profilbild-Vorschau" fill unoptimized={preview.startsWith("blob:") || preview.startsWith("/api/")} sizes="112px" /> : <UserRound aria-hidden="true" />}
            <span><Camera aria-hidden="true" /> Bild auswählen</span>
            <input type="file" accept="image/*" onChange={chooseAvatar} aria-label="Profilbild auswählen (optional, höchstens 4 MB)" disabled={saving} />
          </label>
          <div>
            <p>Alle Textfelder sind Pflichtfelder. Dein Profilbild ist optional.</p>
            <div className="profile-dialog__names"><label className="composer-field">Vorname<input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required disabled={saving} /></label><label className="composer-field">Nachname<input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required disabled={saving} /></label></div>
            <label className="composer-field">E-Mail-Adresse<div className="profile-dialog__email"><Mail aria-hidden="true" /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={saving} /></div></label>
            {error ? <p className="composer-error" role="alert">{error}</p> : null}
          </div>
        </div>
        <footer><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Abbrechen</button><button className="button" type="submit" disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}>{saving ? "Profil wird gespeichert …" : "Profil speichern"} <Check aria-hidden="true" /></button></footer>
      </form>
    </DashboardDialog>
  );
}
