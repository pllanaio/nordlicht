import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Film, Menu, Mic, Play, Send, Sparkles, Subtitles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CheckoutButton } from "@/components/checkout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { planCatalog, planIds } from "@/lib/plans";

function VideoPreview() {
  return (
    <figure className="hero-video" aria-label="Beispiel für ein Kurzvideo mit Sprecherstimme und Untertiteln">
      <div className="hero-video__screen">
        <Image src="/media/creator-studio.webp" alt="Creatorin bei der Vorbereitung einer Videoaufnahme" width={500} height={680} priority sizes="(max-width: 600px) 75vw, 340px" />
        <span className="hero-video__label">Beispielvorschau · 9:16</span>
        <div className="hero-video__caption"><span>Deine nächste Geschichte</span><strong>beginnt mit einer Idee.</strong></div>
      </div>
      <figcaption>
        <span className="feature-kicker">Video-Studio</span>
        <h2>Ein Thema. Alle Schritte.</h2>
        <ol className="hero-video__steps">
          <li><Sparkles aria-hidden="true" /><span>Skript entwickeln</span></li>
          <li><Mic aria-hidden="true" /><span>Sprecherstimme erzeugen</span></li>
          <li><Film aria-hidden="true" /><span>Stockclips zusammenstellen</span></li>
          <li><Subtitles aria-hidden="true" /><span>Untertitel hinzufügen</span></li>
          <li><Send aria-hidden="true" /><span>Prüfen und veröffentlichen</span></li>
        </ol>
      </figcaption>
    </figure>
  );
}

const workflow = [
  ["01", "Idee beschreiben", "Thema, Sprache und Format wählen. Ein eigenes Skript kannst du direkt mitbringen."],
  ["02", "Video erstellen", "KI-Skript, Sprecherstimme, passende Stockclips und Untertitel ergeben dein Kurzvideo."],
  ["03", "Ergebnis prüfen", "Video ansehen, herunterladen und gemeinsam mit deinen übrigen Medien organisieren."],
  ["04", "Direkt posten", "Konto und Sichtbarkeit bewusst auswählen. Den Veröffentlichungsstatus siehst du am Video."],
];

export default function Home() {
  return (
    <div className="landing-page">
      <header className="site-header">
        <Link href="/" aria-label="ContentDock Startseite"><BrandMark /></Link>
        <nav aria-label="Hauptnavigation"><a href="#produkt">Produkt</a><a href="#integrationen">Kanäle</a><a href="#preise">Tarife</a><Link href="/trends">Trendradar</Link></nav>
        <div className="site-header__actions">
          <Link href="/login" className="text-link">Anmelden</Link><ThemeToggle />
          <details className="site-header__mobile-menu"><summary aria-label="Navigation öffnen"><Menu aria-hidden="true" /><span>Menü</span></summary><nav aria-label="Mobile Navigation"><a href="#produkt">Produkt</a><a href="#integrationen">Kanäle</a><a href="#preise">Tarife</a><Link href="/trends">Trendradar</Link><Link href="/login">Anmelden</Link></nav></details>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="hero section">
          <div className="hero__copy">
            <span className="landing-hero__eyebrow">Ein Ort für deinen Content</span>
            <h1>Von der Idee zum fertigen Kurzvideo.</h1>
            <p>Erstelle Videos mit KI, behalte deine Inhalte im Blick und veröffentliche auf Instagram, TikTok und YouTube.</p>
            <div className="hero__actions"><Link href="/demo?view=video-studio" className="button"><Play size={17} aria-hidden="true" /> Demo ausprobieren</Link><a href="#produkt" className="text-link text-link--arrow">So funktioniert’s <ArrowRight size={17} aria-hidden="true" /></a></div>
            <p className="hero__note">Kostenlose Vorschau mit Beispieldaten. Es wird nichts veröffentlicht.</p>
          </div>
          <VideoPreview />
        </section>
        <div className="logo-rail" aria-label="Videokanäle"><span>Instagram Reels</span><span>TikTok</span><span>YouTube</span></div>
        <section className="workflow section" id="produkt" aria-labelledby="workflow-heading">
          <div className="section-heading"><span className="feature-kicker">Vom Entwurf zur Veröffentlichung</span><h2 id="workflow-heading">Dein nächstes Video, Schritt für Schritt.</h2><p>Eine klare Abfolge mit sichtbarem Fortschritt. Du entscheidest, wann dein Video bereit für die Öffentlichkeit ist.</p></div>
          <div className="workflow-steps">{workflow.map(([number, title, description]) => <article className="workflow-step" key={number}><header><span>{number}</span><h3>{title}</h3></header><p>{description}</p></article>)}</div>
          <div className="integration-band" id="integrationen">
            <div className="integration-band__intro"><h3>Drei Kanäle.<br />Eine Übersicht.</h3><p>Verbinde deine Konten und prüfe die Angaben für jeden Kanal vor dem Posten.</p><Link href="/demo?view=video-studio">Video-Studio ansehen <ArrowRight size={17} aria-hidden="true" /></Link></div>
            <div className="integration-list">{[
              ["Instagram", "Kurzvideos als Reels veröffentlichen.", "Professionelles Konto"],
              ["TikTok", "Videobeitrag mit gewählter Sichtbarkeit posten.", "Freigabe erforderlich"],
              ["YouTube", "Video hochladen und Sichtbarkeit festlegen.", "YouTube-Kanal"],
            ].map(([name, description, requirement]) => <div className="integration-row" key={name}><strong>{name}</strong><span>{description}</span><em>{requirement}</em></div>)}</div>
          </div>
          <p className="launch-note">Die Veröffentlichung setzt verbundene Konten und die Freigaben der jeweiligen Plattform voraus. Welche Kanäle verfügbar sind, siehst du direkt am fertigen Video.</p>
        </section>
        <section className="signal-section section" id="ressourcen">
          <div className="signal-section__visual"><div className="trend-story"><span>Inspiration</span><h3>Was möchtest du als Nächstes erzählen?</h3><p>Ein Blick hinter die Kulissen. Eine hilfreiche Antwort. Ein neuer Gedanke.</p><div className="hashtag-row"><span>#behindthescenes</span><span>#brandstory</span></div></div></div>
          <div className="signal-section__copy"><h2>Gute Ideen beginnen mit Orientierung.</h2><p>Der Trendradar sammelt Themenbeispiele und verlinkt die Quellen der Plattformen. So findest du einen Ausgangspunkt für deinen eigenen Content.</p><ul><li><Check aria-hidden="true" /> Themen nach Plattform filtern</li><li><Check aria-hidden="true" /> Hashtags mit einem Klick kopieren</li><li><Check aria-hidden="true" /> Quellen selbst nachvollziehen</li></ul><Link href="/trends" className="text-link text-link--arrow">Trendradar öffnen <ArrowRight size={17} aria-hidden="true" /></Link></div>
        </section>
        <section className="pricing section" id="preise" aria-labelledby="pricing-heading">
          <div className="section-heading section-heading--center"><span className="feature-kicker">Tarifübersicht</span><h2 id="pricing-heading">Passend zu deinem Team.</h2><p>Die aktuelle Vorabversion bietet einen ersten Zugangszeitraum von 30 Tagen. Eine automatische Verlängerung ist noch nicht verfügbar.</p></div>
          <div className="pricing__grid">{planIds.map((id) => { const plan = planCatalog[id]; return <article className={`price-plan${id === "studio" ? " price-plan--featured" : ""}`} key={id}><h3>{plan.label}</h3><p><strong>{plan.price}</strong><span>/ erste 30 Tage</span></p><ul>{(id === "pro" ? ["10 Marken", "KI-Ideen für deine Branche", "Trendradar mit Themenbeispielen"] : plan.features).map((feature) => <li key={feature}>{feature}</li>)}</ul><CheckoutButton plan={id} featured={id === "studio"}>{plan.label} ansehen</CheckoutButton></article>; })}</div>
          <p className="pricing__note">Für KI-Videos nutzt du deinen eigenen OpenAI-Schlüssel. Dabei fallen zusätzlich Kosten bei OpenAI an. Die Demo benötigt keinen Schlüssel.</p>
        </section>
        <section className="faq section" aria-labelledby="faq-heading"><h2 id="faq-heading">Gut zu wissen</h2>{[
          ["Was kann ich in der Demo ausprobieren?", "Navigation, Planung und die Eingaben im Video-Studio. Die Demo zeigt Beispieldaten. Sie erstellt keine echten Videos und veröffentlicht keine Beiträge."],
          ["Wie wird mein KI-Schlüssel verwendet?", "Für Textanfragen wird er direkt verwendet. Bei Videoaufträgen wird er mit deiner Einwilligung vorübergehend verschlüsselt gespeichert. Er wird nach Abschluss entfernt und kann höchstens eine Stunde für den Auftrag verwendet werden."],
          ["Wird mein Video automatisch veröffentlicht?", "Du wählst am fertigen Video den Kanal und die Veröffentlichungsoptionen aus und bestätigst den Auftrag. Der Status zeigt, ob der Kanal den Beitrag noch verarbeitet oder bereits veröffentlicht hat."],
          ["Ist ContentDock bereits vollständig verfügbar?", "ContentDock ist in der Vorabversion. Videos und Direktveröffentlichung benötigen freigeschaltete Dienste und verbundene Konten. Reguläre Kundenanmeldung und automatische Aboverlängerung sind noch nicht verfügbar."],
        ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" /></summary><p>{answer}</p></details>)}</section>
      </main>
      <footer className="site-footer"><BrandMark inverse /><nav aria-label="Weitere Seiten"><Link href="/demo">Demo</Link><Link href="/trends">Trendradar</Link><Link href="/login">Anmelden</Link></nav><strong>Raum für deine nächste Idee.</strong></footer>
    </div>
  );
}
