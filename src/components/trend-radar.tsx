"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [platform, setPlatform] = useState("all");
  const [industry, setIndustry] = useState("Kreativagentur für nachhaltige Marken");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<IndustryResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedTag, setCopiedTag] = useState("");
  const isDemo = mode === "demo";
  const canAnalyze = isDemo || (mode === "workspace" && proAccess);
  const visiblePlatforms = platform === "all" ? trendPlatforms : trendPlatforms.filter((item) => item.id === platform);

  async function copyTag(tag: string) {
    await navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
  }

  async function analyzeIndustry() {
    if (!industry.trim()) return;
    if (!isDemo && !apiKey.trim()) {
      setError("Für die KI-Branchenanalyse ist dein persönlicher API-Key erforderlich.");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Branchenanalyse ist fehlgeschlagen.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="trend-board">
      <section className="trend-board__public">
        <div className="trend-board__intro"><div><span className="feature-kicker">Öffentlich einsehbar</span><h2>Hashtag- und Themen-Signale</h2><p>Plattformspezifische Hinweise mit sichtbarer Quelle. Wo eine Plattform keine öffentliche Rangliste anbietet, zeigt ContentDock bewusst keine erfundenen Reichweitenwerte.</p></div><span><ShieldCheck aria-hidden="true" /> Quellen transparent</span></div>
        <div className="trend-board__tabs" aria-label="Plattform filtern"><button className={platform === "all" ? "is-active" : ""} type="button" onClick={() => setPlatform("all")}>Alle Plattformen</button>{trendPlatforms.map((item) => <button className={platform === item.id ? "is-active" : ""} type="button" onClick={() => setPlatform(item.id)} key={item.id}>{item.name}</button>)}</div>
        <div className="trend-platform-grid">
          {visiblePlatforms.map((item) => (
            <article className={`trend-platform trend-platform--${item.id}`} key={item.id}>
              <header><div><span>{item.name}</span><strong>Öffentlicher Snapshot</strong></div><TrendingUp aria-hidden="true" /></header>
              <div className="trend-platform__tags">{item.hashtags.map((hashtag) => <button type="button" onClick={() => copyTag(hashtag.tag)} key={hashtag.tag}><span><strong>{hashtag.tag}</strong><small>{hashtag.signal} · {hashtag.fit}</small></span>{copiedTag === hashtag.tag ? <Check aria-label="Kopiert" /> : <Copy aria-label="Hashtag kopieren" />}</button>)}</div>
              <p>{item.note}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Quelle: {item.sourceLabel} <ExternalLink aria-hidden="true" /></a>
            </article>
          ))}
        </div>
        <p className="trend-board__disclaimer">Die angezeigten Hashtags sind ein transparenter Produkt- und Datenfluss-Prototyp, keine garantierte Live-Rangfolge. Spätere Live-Signale werden mit Region, Zeitraum und Abrufzeit gekennzeichnet.</p>
      </section>

      {mode === "public" ? (
        <section className="trend-board__public-cta"><Target aria-hidden="true" /><div><span className="feature-kicker">Pro-Analyse</span><h2>Ideen passend zu Branche und Zielgruppe</h2><p>In der Live-Demo kannst du die KI-gestützte Branchensuche ohne API-Verbrauch ausprobieren.</p></div><Link className="button" href="/demo?view=trends">Tech-Demo öffnen <ArrowRight aria-hidden="true" /></Link></section>
      ) : canAnalyze ? (
        <section className="industry-search">
          <div className="industry-search__head"><div><span className="feature-kicker">{isDemo ? "Premium Tech-Demo" : "Pro-Feature"}</span><h2>Branchen- und Zielgruppenideen</h2><p>Beschreibe dein Angebot und deine Zielgruppe. Die KI verbindet das Briefing mit den sichtbaren Plattformsignalen.</p></div><Sparkles aria-hidden="true" /></div>
          <div className="industry-search__form">
            <label className="composer-field">Branche, Angebot und Zielgruppe<div><Search aria-hidden="true" /><input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="z. B. Physiotherapiepraxis für Läufer" /></div></label>
            {!isDemo ? <label className="composer-field">Persönlicher KI API-Key<div><KeyRound aria-hidden="true" /><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" /></div></label> : null}
            {error ? <p className="composer-error">{error}</p> : null}
            <button className="button" type="button" onClick={analyzeIndustry} disabled={generating || !industry.trim() || (!isDemo && !apiKey.trim())}>{generating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{generating ? "Analyse läuft …" : "Ideen finden"}</button>
          </div>
          <div className={`industry-search__result${result ? " has-result" : ""}`} aria-live="polite">{result ? <><span>Analyse-Ergebnis</span><h3>{result.title}</h3><p>{result.content}</p><div>{result.hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div></> : <><Target aria-hidden="true" /><strong>Noch keine Branchenanalyse</strong><span>Starte eine Suche, um konkrete Formate, Hooks und Hashtags zu erhalten.</span></>}</div>
        </section>
      ) : (
        <section className="industry-search industry-search--locked"><LockKeyhole aria-hidden="true" /><div><span className="feature-kicker">Pro-Feature</span><h2>KI-Branchenanalyse freischalten</h2><p>Die öffentlichen Hashtag-Signale bleiben sichtbar. Die individuelle Suche nach Branche und Zielgruppe ist im Pro-Tarif enthalten.</p><Link className="button" href="/#preise">Pro ansehen <ArrowRight aria-hidden="true" /></Link></div></section>
      )}
    </div>
  );
}
