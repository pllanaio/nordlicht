"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CloudUpload,
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
  onCreate: (content: { title: string; channel: Channel; caption: string; date: string; time: string }) => void;
}) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState("Behind-the-Scenes");
  const [channel, setChannel] = useState<Channel>("Instagram");
  const [apiKey, setApiKey] = useState("");
  const [caption, setCaption] = useState(demoCopy.caption);
  const [hashtags, setHashtags] = useState(demoCopy.hashtags);
  const [date, setDate] = useState("2026-08-26");
  const [time, setTime] = useState("11:00");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
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
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    onClose();
  }

  return (
    <div className="composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <header className="composer__header">
          <div><span>Neuer Content</span><h2 id="composer-title">{step === 1 ? "Rohmaterial auswählen" : step === 2 ? "Text verfeinern" : "Planung abschließen"}</h2></div>
          <button onClick={close} aria-label="Dialog schließen"><X /></button>
        </header>
        <div className="composer__steps" aria-label={`Schritt ${step} von 3`}>
          {["Medien", "KI-Text", "Planung"].map((label, index) => (
            <span className={step > index ? "is-current" : ""} key={label}><i>{step > index + 1 ? <Check size={13} /> : index + 1}</i>{label}</span>
          ))}
        </div>

        <div className="composer__body">
          {step === 1 ? (
            <div className="composer-upload">
              <label className="composer-dropzone">
                <input type="file" accept="image/*,video/*" onChange={selectFile} />
                {preview ? <Image src={preview} alt="Ausgewähltes Medium" fill unoptimized sizes="560px" /> : <><CloudUpload aria-hidden="true" /><strong>Foto oder Video hineinziehen</strong><span>oder klicken, um eine Datei auszuwählen</span><small>JPG, PNG, MP4 · im MVP lokal als Vorschau</small></>}
              </label>
              <label className="composer-field">Arbeitstitel<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="composer-copy">
              <div className="composer-key">
                <div><KeyRound aria-hidden="true" /><span><strong>Persönlicher OpenAI API-Key</strong><small>Wird für diese Anfrage weitergereicht und nicht gespeichert.</small></span></div>
                <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-… (optional für Demo)" autoComplete="off" />
              </div>
              <label className="composer-field">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={6} /></label>
              <div className="composer-hashtags"><span>Hashtags</span><div>{hashtags.map((tag) => <button key={tag} onClick={() => setHashtags((current) => current.filter((item) => item !== tag))}>{tag}<X size={12} /></button>)}</div></div>
              {error ? <p className="composer-error">{error}</p> : null}
              <button className="secondary-button composer-generate" onClick={generateCopy} disabled={generating}>
                {generating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {apiKey ? "Mit eigenem Key neu erzeugen" : mode === "demo" ? "Demo-Vorschlag erzeugen" : "API-Key erforderlich"}
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="composer-plan">
              <div className="composer-plan__summary">
                <Image src={preview || "/media/design-studio.webp"} alt="Content-Vorschau" width={170} height={170} unoptimized={Boolean(preview)} sizes="170px" />
                <div><span>Entwurf</span><h3>{title || "Neuer Content"}</h3><p>{caption}</p></div>
              </div>
              <div className="composer-plan__fields">
                <label className="composer-field">Kanal<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>YouTube</option></select></label>
                <label className="composer-field">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label className="composer-field">Uhrzeit<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
              </div>
              <p className="composer-plan__notice"><CalendarDays aria-hidden="true" /> Entwurf und Planung funktionieren auch in der Demo. Ein Live-Upload startet erst mit aktivem Abo, Provider-Freigabe und deiner finalen Bestätigung.</p>
            </div>
          ) : null}
        </div>

        <footer className="composer__footer">
          <button className="composer-back" onClick={() => step === 1 ? close() : setStep((current) => current - 1)}><ArrowLeft size={17} aria-hidden="true" />{step === 1 ? "Abbrechen" : "Zurück"}</button>
          {step < 3 ? <button className="button" onClick={() => setStep((current) => current + 1)} disabled={step === 1 && !title.trim()}>Weiter <ArrowRight size={17} aria-hidden="true" /></button> : <button className="button" onClick={() => onCreate({ title, channel, caption, date, time })} disabled={!date || !time}>Entwurf anlegen <Check size={17} aria-hidden="true" /></button>}
        </footer>
      </section>
    </div>
  );
}
