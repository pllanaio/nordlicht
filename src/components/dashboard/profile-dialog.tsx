"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Mail, UserRound, X } from "lucide-react";

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string;
};

export function ProfileDialog({ profile, onClose, onSave }: { profile: UserProfile; onClose: () => void; onSave: (profile: UserProfile, avatarFile?: File) => void }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [preview, setPreview] = useState(profile.avatarUrl);
  const localPreview = useRef("");

  useEffect(() => () => {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
  }, []);

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    const nextPreview = URL.createObjectURL(file);
    localPreview.current = nextPreview;
    setAvatarFile(file);
    setPreview(nextPreview);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), avatarUrl: profile.avatarUrl }, avatarFile);
  }

  return (
    <div className="composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onSubmit={submit}>
        <header><div><span>Eigenes Benutzerkonto</span><h2 id="profile-dialog-title">Profil bearbeiten</h2></div><button type="button" onClick={onClose} aria-label="Profil schließen"><X /></button></header>
        <div className="profile-dialog__body">
          <label className="profile-avatar">
            {preview ? <Image src={preview} alt="Profilbild-Vorschau" fill unoptimized={preview.startsWith("blob:")} sizes="112px" /> : <UserRound aria-hidden="true" />}
            <span><Camera aria-hidden="true" /> Bild auswählen</span>
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
          <div>
            <div className="profile-dialog__names"><label className="composer-field">Vorname<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label className="composer-field">Nachname<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label></div>
            <label className="composer-field">E-Mail-Adresse<div className="profile-dialog__email"><Mail aria-hidden="true" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
          </div>
        </div>
        <footer><button className="secondary-button" type="button" onClick={onClose}>Abbrechen</button><button className="button" type="submit" disabled={!firstName.trim() || !lastName.trim() || !email.trim()}>Profil speichern <Check aria-hidden="true" /></button></footer>
      </form>
    </div>
  );
}
