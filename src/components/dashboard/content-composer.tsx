"use client";

import Image from "next/image";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CloudUpload,
  FileImage,
  KeyRound,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { Channel } from "@/lib/data";

type GeneratedCopy = {
  caption: string;
  hashtags: string[];
};

const demoCopy: GeneratedCopy = {
  caption:
    "Ein Blick hinter die Kulissen von Nordlicht Studio: Aus einer ruhigen Idee wird Schritt für Schritt Content, der wirklich verbindet. Was möchtet ihr als Nächstes sehen?",
  hashtags: ["#behindthescenes", "#contentcreation", "#brandstory", "#kreativstudio", "#socialmedia"],
};

export function ContentComposer({
  mode,
  onClose,
  onCreate,
}: {
  mode: "workspace" | "demo";
  onClose: () => void;
  onCreate: (content: { title: string; channel: Channel; caption: string; date: string; time: string; file?: File }) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState(mode === "demo" ? "Behind-the-Scenes" : "");
  const [channel, setChannel] = useState<Channel>("Instagram");
  const [apiKey, setApiKey] = useState("");
  const [caption, setCaption] = useState(mode === "demo" ? demoCopy.caption : "");
  const [hashtags, setHashtags] = useState<string[]>(mode === "demo" ? demoCopy.hashtags : []);
  const [file, setFile] = useState<File>();
  const [saving, setSaving] = useState(false);
  const previewRef = useRef("");
  const [date, setDate] = useState(() => mode === "demo" ? "2026-08-26" : new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("11:00");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4_000_000) { setError("Bitte wähle ein Bild mit höchstens 4 MB aus."); return; }
    setError("");
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    const nextPreview = URL.createObjectURL(file);
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    setFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, "").replaceAll(/[-_]/g, " "));
  }

  async function generateCopy() {
    if (!apiKey) {
      if (mode === "demo") {
        setCaption(demoCopy.caption);
        setHashtags(demoCopy.hashtags);
        return;
      }
      setError("Bitte hinterlege deinen persönlichen KI API-Key.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-key": apiKey, "x-contentdock-mode": mode },
        body: JSON.stringify({ title, channel, tone: "klar, nahbar und professionell" }),
      });
      const data = (await response.json()) as GeneratedCopy & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Die Caption konnte nicht erzeugt werden.");
      setCaption(data.caption);
      setHashtags(data.hashtags);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unbekannter Fehler");
    } finally {
      setGenerating(false);
    }
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onCreate({ title, channel, caption: `${caption}${hashtags.length ? `\n\n${hashtags.join(" ")}` : ""}`, date, time, file }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Der Entwurf konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten."); }
    finally { setSaving(false); }
  }

  return (
    <DashboardDialog labelledBy="composer-title" onClose={close}>
      <section className="composer">
        <header className="composer__header">
          <div><span>Neuer Beitrag · Schritt {step} von 3</span><h2 id="composer-title">{step === 1 ? "Idee festhalten" : step === 2 ? "Beitragstext schreiben" : "Entwurf prüfen"}</h2></div>
          <button onClick={close} disabled={saving} aria-label="Dialog schließen"><X /></button>
        </header>
        <div className="composer__steps" aria-label={`Schritt ${step} von 3`}>
          {["Medien", "KI-Text", "Planung"].map((label, index) => (
            <span className={step > index ? "is-current" : ""} aria-current={step === index + 1 ? "step" : undefined} key={label}><i>{step > index + 1 ? <Check size={13} /> : index + 1}</i>{label}</span>
          ))}
        </div>

        <div className="composer__body">
          {step === 1 ? (
            <div className="composer-upload">
              <label className="composer-dropzone">
                <input type="file" accept="image/*" onChange={selectFile} aria-label="Bild zum Beitrag auswählen (optional, höchstens 4 MB)" />
                {preview ? <Image src={preview} alt="Ausgewähltes Beitragsbild" fill unoptimized sizes="560px" /> : <><CloudUpload aria-hidden="true" /><strong>Bild auswählen (optional)</strong><span>Das Bild wird mit deinem Entwurf gespeichert.</span><small>JPG, PNG oder WebP · höchstens 4 MB</small></>}
              </label>
              <label className="composer-field">Arbeitstitel (Pflichtfeld)<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required placeholder="Worum soll es in deinem Beitrag gehen?" /></label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="composer-copy">
              <div className="composer-key">
                <div><KeyRound aria-hidden="true" /><span><strong>Persönlicher OpenAI API-Key</strong><small>Wird für diese Anfrage weitergereicht und nicht gespeichert.</small></span></div>
                <input type="password" aria-label="OpenAI API-Schlüssel (optional, nur für KI-Vorschlag)" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" maxLength={1024} />
              </div>
              <label className="composer-field">Beitragstext (optional)<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={6} /></label>
              <div className="composer-hashtags"><span>Hashtags</span><div>{hashtags.map((tag) => <button key={tag} aria-label={`${tag} entfernen`} onClick={() => setHashtags((current) => current.filter((item) => item !== tag))}>{tag}<X size={12} aria-hidden="true" /></button>)}</div></div>
              <button className="secondary-button composer-generate" onClick={generateCopy} disabled={generating}>
                {generating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {generating ? "Vorschlag wird erstellt …" : apiKey ? "KI-Vorschlag erstellen" : mode === "demo" ? "Beispieltext einsetzen" : "KI-Vorschlag mit eigenem Schlüssel"}
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="composer-plan">
              <div className="composer-plan__summary">
                {preview ? <Image src={preview} alt="Beitragsbild" width={170} height={170} unoptimized sizes="170px" /> : <span className="media-placeholder"><FileImage aria-hidden="true" /> Ohne Bild</span>}
                <div><span>Entwurf</span><h3>{title || "Neuer Content"}</h3><p>{caption}</p></div>
              </div>
              <div className="composer-plan__fields">
                <label className="composer-field">Kanal<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>YouTube</option></select></label>
                <label className="composer-field">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label className="composer-field">Uhrzeit<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
              </div>
              <p className="composer-plan__notice"><CalendarDays aria-hidden="true" /> Du speicherst einen Entwurf mit Wunschtermin. Hier wird kein Beitrag automatisch veröffentlicht. Fertige Videos kannst du im Video-Studio auf deinen verbundenen Kanälen veröffentlichen.</p>
            </div>
          ) : null}
          {error ? <p className="composer-error" role="alert">{error}</p> : null}
        </div>

        <footer className="composer__footer">
          <button className="composer-back" disabled={saving} onClick={() => step === 1 ? close() : setStep((current) => current - 1)}><ArrowLeft size={17} aria-hidden="true" />{step === 1 ? "Abbrechen" : "Zurück"}</button>
          {step < 3 ? <button className="button" onClick={() => setStep((current) => current + 1)} disabled={generating || (step === 1 && !title.trim())}>Weiter <ArrowRight size={17} aria-hidden="true" /></button> : <button className="button" onClick={save} disabled={saving || !date || !time}>{saving ? "Entwurf wird gespeichert …" : "Entwurf speichern"} <Check size={17} aria-hidden="true" /></button>}
        </footer>
      </section>
    </DashboardDialog>
  );
}
