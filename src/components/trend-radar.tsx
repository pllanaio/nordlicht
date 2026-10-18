"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, KeyRound, LoaderCircle, LockKeyhole, Search, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { trendPlatforms } from "@/lib/trends";

type TrendMode = "public" | "demo" | "workspace";

type IndustryResult = { title: string; content: string; hashtags: string[] };

function demoIndustryResult(industry: string): IndustryResult {
  return {
    title: `5 Ideen für ${industry}`,
    content: `1. Zeige einen typischen Vorher-Nachher-Moment.\n2. Erkläre einen Branchenfehler in 20 Sekunden.\n3. Lass ein Teammitglied eine häufige Kundenfrage beantworten.\n4. Teile einen konkreten Prozessschritt hinter den Kulissen.\n5. Verwandle ein Kundenproblem in eine kompakte Checkliste.`,
    hashtags: ["#behindthescenes", "#expertentipp", "#kundennutzen", "#branche", "#contentidee"],
  };
}

export function TrendRadar({ mode, proAccess = false }: { mode: TrendMode; proAccess?: boolean }) {
  const fieldId = useId();
  const [copyMessage, setCopyMessage] = useState("");
  const [platform, setPlatform] = useState("all");
  const [industry, setIndustry] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<IndustryResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedTag, setCopiedTag] = useState("");
  const isDemo = mode === "demo";
  const canAnalyze = isDemo || (mode === "workspace" && proAccess);
  const visiblePlatforms = platform === "all" ? trendPlatforms : trendPlatforms.filter((item) => item.id === platform);

  async function copyTag(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      setCopyMessage(`${tag} wurde kopiert.`);
    } catch {
      setCopyMessage(`Kopieren nicht möglich. Markiere ${tag} und kopiere den Text manuell.`);
    }
  }

  async function analyzeIndustry() {
    if (!industry.trim()) { setError("Beschreibe zuerst deine Branche und Zielgruppe."); return; }
    if (!isDemo && !apiKey.trim()) {
      setError("Für die KI-Branchenanalyse ist dein OpenAI-Schlüssel erforderlich.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      if (isDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        setResult(demoIndustryResult(industry.trim()));
        return;
      }
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-key": apiKey },
        body: JSON.stringify({ tool: "industry_ideas", prompt: industry, channel: platform === "all" ? "plattformübergreifend" : platform, tone: "konkret, zielgruppenorientiert und umsetzbar" }),
      });
      const data = (await response.json()) as IndustryResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Die Branchenanalyse ist fehlgeschlagen.");
      setResult(data);
      setApiKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Branchenanalyse ist fehlgeschlagen.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="trend-board">
      <section className="trend-board__public">
        <div className="trend-board__intro"><div><span className="feature-kicker">Zur Inspiration</span><h2>Themen und Hashtag-Beispiele</h2><p>Wähle eine Plattform und kopiere passende Hashtags für deinen Entwurf. Die Beispiele sind redaktionell zusammengestellt und keine aktuellen Ranglisten.</p></div><span><ShieldCheck aria-hidden="true" /> Quellen transparent</span></div>
        <div className="trend-board__tabs" role="group" aria-label="Plattform filtern"><button className={platform === "all" ? "is-active" : ""} aria-pressed={platform === "all"} type="button" onClick={() => setPlatform("all")}>Alle Plattformen</button>{trendPlatforms.map((item) => <button className={platform === item.id ? "is-active" : ""} aria-pressed={platform === item.id} type="button" onClick={() => setPlatform(item.id)} key={item.id}>{item.name}</button>)}</div>
        <div className="trend-platform-grid">
          {visiblePlatforms.map((item) => (
            <article className={`trend-platform trend-platform--${item.id}`} key={item.id}>
              <header><div><span>{item.name}</span><strong>Themenbeispiele</strong></div><TrendingUp aria-hidden="true" /></header>
              <div className="trend-platform__tags">{item.hashtags.map((hashtag) => <button type="button" aria-label={`${hashtag.tag} kopieren`} onClick={() => copyTag(hashtag.tag)} key={hashtag.tag}><span><strong>{hashtag.tag}</strong><small>{hashtag.signal} · {hashtag.fit}</small></span>{copiedTag === hashtag.tag ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</button>)}</div>
              <p>{item.note}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Quelle: {item.sourceLabel} <ExternalLink aria-hidden="true" /></a>
            </article>
          ))}
        </div>
        <p className="form-status" role="status" aria-live="polite">{copyMessage}</p><p className="trend-board__disclaimer">Die Quellen öffnen sich in einem neuen Tab. Die Auswahl hier enthält keine gemessenen Reichweiten oder Live-Trenddaten.</p>
      </section>

      {mode === "public" ? (
        <section className="trend-board__public-cta"><Target aria-hidden="true" /><div><span className="feature-kicker">Pro-Analyse</span><h2>Ideen passend zu Branche und Zielgruppe</h2><p>In der Demo siehst du, wie aus einer Branchenbeschreibung konkrete Content-Ideen werden. Die Ergebnisse sind Beispiele.</p></div><Link className="button" href="/demo?view=trends">Demo öffnen <ArrowRight aria-hidden="true" /></Link></section>
      ) : canAnalyze ? (
        <section className="industry-search">
          <div className="industry-search__head"><div><span className="feature-kicker">{isDemo ? "Demo · Beispieldaten" : "Pro-Feature"}</span><h2>Branchen- und Zielgruppenideen</h2><p>Beschreibe dein Angebot und deine Zielgruppe. Du erhältst Vorschläge für Formate, Einstiege und Hashtags.</p></div><Sparkles aria-hidden="true" /></div>
          <form className="industry-search__form" onSubmit={(event) => { event.preventDefault(); void analyzeIndustry(); }} aria-busy={generating}>
            <label className="composer-field" htmlFor={`${fieldId}-industry`}>Branche, Angebot und Zielgruppe <span className="auth-form__hint">Pflichtangabe</span><div><Search aria-hidden="true" /><input id={`${fieldId}-industry`} name="industry" required maxLength={2000} value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="z. B. Physiotherapiepraxis für Läufer" /></div></label>
            {!isDemo ? <label className="composer-field" htmlFor={`${fieldId}-key`}>OpenAI-Schlüssel <span className="auth-form__hint">Pflichtangabe · Kosten entstehen bei OpenAI.</span><div><KeyRound aria-hidden="true" /><input id={`${fieldId}-key`} name="apiKey" type="password" required maxLength={1024} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" /></div></label> : null}
            {error ? <p className="composer-error" role="alert">{error}</p> : null}
            <button className="button" type="submit" disabled={generating}>{generating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{generating ? "Analyse läuft …" : "Ideen finden"}</button>
          </form>
          <div className={`industry-search__result${result ? " has-result" : ""}`} aria-live="polite">{result ? <><span>{isDemo ? "Beispielergebnis" : "Deine Content-Ideen"}</span><h3>{result.title}</h3><p>{result.content}</p><div>{result.hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div></> : <><Target aria-hidden="true" /><strong>Deine Ideen erscheinen hier</strong><span>Beschreibe deine Zielgruppe und wähle „Ideen finden“.</span></>}</div>
        </section>
      ) : (
        <section className="industry-search industry-search--locked"><LockKeyhole aria-hidden="true" /><div><span className="feature-kicker">Pro-Feature</span><h2>KI-Branchenanalyse freischalten</h2><p>Die öffentlichen Hashtag-Signale bleiben sichtbar. Die individuelle Suche nach Branche und Zielgruppe ist im Pro-Tarif enthalten.</p><Link className="button" href="/#preise">Pro ansehen <ArrowRight aria-hidden="true" /></Link></div></section>
      )}
    </div>
  );
}
