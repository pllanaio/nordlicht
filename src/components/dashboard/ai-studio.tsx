"use client";

import { useState } from "react";
import { Check, Copy, Hash, KeyRound, Lightbulb, LoaderCircle, MessageSquareText, Recycle, Sparkles } from "lucide-react";
import type { Channel } from "@/lib/data";

type AiToolId = "caption" | "hashtags" | "hooks" | "repurpose";

type AiResult = {
  title: string;
  content: string;
  hashtags: string[];
};

const tools: Array<{ id: AiToolId; label: string; description: string; icon: typeof Sparkles }> = [
  { id: "caption", label: "Caption & Hashtags", description: "Plattformgerechte Caption inklusive Hashtag-Set.", icon: MessageSquareText },
  { id: "hashtags", label: "Hashtag-Mix", description: "Breite, Nischen- und Marken-Hashtags kombinieren.", icon: Hash },
  { id: "hooks", label: "Hook-Ideen", description: "Mehrere Einstiege für Reels, Posts und Videos.", icon: Lightbulb },
  { id: "repurpose", label: "Content recyceln", description: "Aus einer Idee mehrere Plattformformate entwickeln.", icon: Recycle },
];

function getDemoResult(tool: AiToolId, prompt: string, channel: Channel): AiResult {
  const subject = prompt.trim() || "unseren kreativen Prozess";
  if (tool === "hashtags") {
    return { title: `Hashtag-Mix für ${channel}`, content: `Ein ausgewogener Mix aus breiten Themen, konkretem Format und Markenbezug für „${subject}“.`, hashtags: ["#contentcreation", "#behindthescenes", "#socialmediatips", "#brandstory", "#kreativprozess", "#nordlichtstudio"] };
  }
  if (tool === "hooks") {
    return { title: "5 Hook-Ideen", content: `1. Das sieht am Ende einfach aus – aber so entsteht ${subject}.\n2. Drei Fehler, die wir dabei nie wieder machen würden.\n3. Was passiert, bevor die Kamera läuft?\n4. Diesen Schritt überspringen die meisten.\n5. Von der ersten Idee bis zum fertigen Post in 20 Sekunden.`, hashtags: [] };
  }
  if (tool === "repurpose") {
    return { title: "Content-Paket aus einer Idee", content: `Instagram: Carousel mit fünf Prozessschritten.\nTikTok: 20-Sekunden-BTS mit schnellem Hook.\nLinkedIn: Lernmoment mit konkretem Ergebnis.\nStory: Umfrage plus Vorher-Nachher-Sequenz zu ${subject}.`, hashtags: ["#contentworkflow", "#contentrepurposing", "#brandcontent"] };
  }
  return { title: `Caption für ${channel}`, content: `Ein Blick hinter die Kulissen: Heute zeigen wir, wie aus ${subject} Schritt für Schritt Content wird, der nicht nur gut aussieht, sondern eine klare Geschichte erzählt. Welchen Teil sollen wir als Nächstes genauer zeigen?`, hashtags: ["#behindthescenes", "#contentcreation", "#brandstory", "#socialmedia", "#kreativstudio"] };
}

export function AiStudio({ mode }: { mode: "workspace" | "demo" }) {
  const [activeTool, setActiveTool] = useState<AiToolId>("caption");
  const [prompt, setPrompt] = useState("Behind-the-Scenes eines kreativen Fotoshootings");
  const [channel, setChannel] = useState<Channel>("Instagram");
  const [tone, setTone] = useState("Klar, nahbar und professionell");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const isDemo = mode === "demo";

  async function generate() {
    if (!prompt.trim()) return;
    if (!isDemo && !apiKey.trim()) {
      setError("Bitte hinterlege zuerst deinen persönlichen KI API-Key.");
      return;
    }
    setGenerating(true);
    setError("");
    setCopied(false);
    try {
      if (isDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setResult(getDemoResult(activeTool, prompt, channel));
        return;
      }
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-key": apiKey },
        body: JSON.stringify({ tool: activeTool, prompt, channel, tone }),
      });
      const data = (await response.json()) as AiResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Die KI-Anfrage ist fehlgeschlagen.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die KI-Anfrage ist fehlgeschlagen.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.content}${result.hashtags.length ? `\n\n${result.hashtags.join(" ")}` : ""}`);
    setCopied(true);
  }

  return (
    <div className="ai-studio">
      <div className="ai-studio__tools" aria-label="KI-Werkzeug auswählen">
        {tools.map(({ id, label, description, icon: Icon }) => (
          <button className={activeTool === id ? "is-active" : ""} type="button" onClick={() => { setActiveTool(id); setResult(null); }} key={id}><span><Icon aria-hidden="true" /></span><strong>{label}</strong><small>{description}</small></button>
        ))}
      </div>

      <div className="ai-studio__workspace">
        <section className="ai-studio__form">
          <div className={`ai-studio__mode${isDemo ? " is-demo" : ""}`}><Sparkles aria-hidden="true" /><div><strong>{isDemo ? "Tech-Demo aktiv" : "Eigener API-Key erforderlich"}</strong><span>{isDemo ? "Die Demo erzeugt lokale Beispielresultate und verbraucht keine API-Credits." : "Der Schlüssel wird nur für diese Anfrage an den KI-Provider weitergereicht und nicht gespeichert."}</span></div></div>
          {!isDemo ? <label className="composer-field ai-studio__key">Persönlicher KI API-Key<div><KeyRound aria-hidden="true" /><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" /></div></label> : null}
          <label className="composer-field">Worum geht es?<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} placeholder="Produkt, Thema oder Ausgangsidee beschreiben" /></label>
          <div className="ai-studio__options"><label className="composer-field">Plattform<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>YouTube</option></select></label><label className="composer-field">Tonalität<select value={tone} onChange={(event) => setTone(event.target.value)}><option>Klar, nahbar und professionell</option><option>Locker und direkt</option><option>Mutig und pointiert</option><option>Sachlich und kompetent</option></select></label></div>
          {error ? <p className="composer-error">{error}</p> : null}
          <button className="button ai-studio__generate" type="button" onClick={generate} disabled={generating || !prompt.trim() || (!isDemo && !apiKey.trim())}>{generating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{generating ? "Wird erstellt …" : "Ergebnis generieren"}</button>
        </section>

        <section className={`ai-studio__result${result ? " has-result" : ""}`} aria-live="polite">
          {result ? <><header><div><span>KI-Ergebnis</span><h2>{result.title}</h2></div><button type="button" onClick={copyResult}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Kopiert" : "Kopieren"}</button></header><p>{result.content}</p>{result.hashtags.length ? <div>{result.hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</> : <div className="ai-studio__placeholder"><Sparkles aria-hidden="true" /><strong>Dein Ergebnis erscheint hier</strong><span>Wähle ein Werkzeug, beschreibe deinen Inhalt und starte die Generierung.</span></div>}
        </section>
      </div>
    </div>
  );
}
