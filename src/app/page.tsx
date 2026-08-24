import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  CloudUpload,
  Hash,
  Linkedin,
  Play,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CheckoutButton } from "@/components/checkout-button";

const pricing = [
  {
    name: "Starter",
    price: "39 €",
    features: ["1 Marke", "30 Posts/Monat", "KI-Texte mit eigenem API-Key"],
    cta: "Starter wählen",
    plan: "starter",
  },
  {
    name: "Studio",
    price: "89 €",
    features: ["3 Marken", "Unbegrenzte Planung", "Teamfreigaben"],
    cta: "Studio wählen",
    plan: "studio",
  },
  {
    name: "Pro",
    price: "179 €",
    features: ["10 Marken", "Trend- und Viralanalyse", "Algorithmus-Signale", "Priorisierter Support"],
    cta: "Pro testen",
    plan: "pro",
    featured: true,
  },
];

function HeroCalendar() {
  return (
    <div className="hero-calendar" aria-label="Vorschau des Content-Kalenders">
      <div className="hero-calendar__toolbar">
        <div className="hero-calendar__tabs">
          <span>Heute</span>
          <strong>24. – 30. Aug.</strong>
        </div>
        <Link href="/login" className="mini-button">+ Beitrag erstellen</Link>
      </div>
      <div className="hero-calendar__days" aria-hidden="true">
        {[
          ["Mo", "24"], ["Di", "25"], ["Mi", "26"], ["Do", "27"], ["Fr", "28"]
        ].map(([day, date], index) => (
          <span className={index === 2 ? "is-current" : ""} key={day}>
            {day}<b>{date}</b>
          </span>
        ))}
      </div>
      <div className="hero-calendar__grid">
        <div className="hero-calendar__channel">
          <span className="channel-dot channel-dot--instagram">◎</span>
          <span><b>Instagram</b><small>@nordlicht.studio</small></span>
        </div>
        <article className="hero-calendar__post hero-calendar__post--one">
          <Image src="/media/design-studio.webp" alt="Designstudio" width={92} height={92} sizes="92px" />
          <span><small>09:00</small><b>Behind the Scenes</b><em>Geplant</em></span>
        </article>
        <div className="hero-calendar__channel">
          <span className="channel-dot channel-dot--tiktok">♪</span>
          <span><b>TikTok</b><small>@nordlicht.studio</small></span>
        </div>
        <article className="hero-calendar__post hero-calendar__post--two">
          <Image src="/media/creator-studio.webp" alt="Creatorin bei einer Aufnahme" width={92} height={92} sizes="92px" />
          <span><small>15:30</small><b>3 Tipps für mehr Reichweite</b><em>Geplant</em></span>
        </article>
        <div className="hero-calendar__channel">
          <Linkedin aria-hidden="true" size={24} />
          <span><b>LinkedIn</b><small>Nordlicht Studio</small></span>
        </div>
        <article className="hero-calendar__post hero-calendar__post--three">
          <Image src="/media/team-studio.webp" alt="Kreativteam im Studio" width={92} height={92} sizes="92px" />
          <span><small>12:00</small><b>Team-Update</b><em>Geplant</em></span>
        </article>
        <div className="hero-calendar__today" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}

function WorkflowSection() {
  return (
    <section className="workflow section" id="produkt">
      <div className="section-heading">
        <h2>Ein Workflow. Von Rohmaterial bis Reichweite.</h2>
        <p>Wirf Fotos und Videos hinein. ContentDock übernimmt Struktur, Texte, Freigaben und den richtigen Zeitpunkt.</p>
      </div>
      <div className="workflow__rail">
        <article className="workflow-step">
          <header><span>01</span><h3>Sammeln</h3></header>
          <div className="drop-preview">
            <CloudUpload aria-hidden="true" />
            <strong>Dateien hierher ziehen</strong>
            <small>Bilder & Videos · bis 20 GB</small>
            <div className="media-strip">
              <Image src="/media/alpine-lake.webp" alt="Bergsee" width={86} height={72} sizes="86px" />
              <Image src="/media/creator-studio.webp" alt="Creator-Studio" width={86} height={72} sizes="86px" />
              <Image src="/media/team-studio.webp" alt="Team-Meeting" width={86} height={72} sizes="86px" />
            </div>
          </div>
        </article>
        <ArrowRight className="workflow__arrow" aria-hidden="true" />
        <article className="workflow-step workflow-step--active">
          <header><span>02</span><h3>Verfeinern</h3></header>
          <div className="caption-preview">
            <div><strong>Content Caption</strong><Sparkles aria-hidden="true" size={16} /></div>
            <p>Neuer Look, gleiche Mission. Ein Blick hinter die Kulissen unseres heutigen Shootings.</p>
            <div className="hashtag-label"><Hash aria-hidden="true" size={14} /> Vorschläge</div>
            <div className="hashtag-row"><span>#behindthescenes</span><span>#contentcreation</span><span>#brandstory</span></div>
          </div>
        </article>
        <ArrowRight className="workflow__arrow" aria-hidden="true" />
        <article className="workflow-step">
          <header><span>03</span><h3>Planen</h3></header>
          <div className="timeline-preview">
            <div className="timeline-preview__head"><CalendarDays size={17} aria-hidden="true" /><strong>Diese Woche</strong></div>
            <div className="timeline-preview__line"><span>09:00</span><b>Behind the Scenes</b></div>
            <div className="timeline-preview__line"><span>12:30</span><b>Produkt-Highlight</b></div>
            <div className="timeline-preview__line"><span>18:00</span><b>Tutorial Clip</b></div>
          </div>
        </article>
        <ArrowRight className="workflow__arrow" aria-hidden="true" />
        <article className="workflow-step">
          <header><span>04</span><h3>Veröffentlichen</h3></header>
          <div className="publish-preview">
            {["Meta", "TikTok", "YouTube", "LinkedIn"].map((network) => (
              <div key={network}><strong>{network}</strong><span><CircleCheck size={15} aria-hidden="true" /> Geplant</span></div>
            ))}
          </div>
        </article>
      </div>
      <div className="integration-band" id="integrationen">
        <div className="integration-band__intro">
          <h3>Passt in deinen Stack.</h3>
          <p>Verbinde die Tools, die du schon nutzt. Alles an einem Ort.</p>
          <Link href="/login">Alle Integrationen <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="integration-list">
          {[
            ["mollie", "Zahlungen & Abos synchronisieren.", "Bereit"],
            ["odoo", "Kunden und Projekte verknüpfen.", "In Prüfung"],
            ["CapCut", "Passende Video-Vorlagen empfehlen.", "Vorlagen"],
            ["PhotoAI", "Bildideen und Übergabe vorbereiten.", "Partnerzugang"],
          ].map(([name, description, status]) => (
            <div className="integration-row" key={name}>
              <strong>{name}</strong><span>{description}</span><em>{status}</em><ArrowRight size={16} aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <header className="site-header">
        <Link href="/" aria-label="ContentDock Startseite"><BrandMark /></Link>
        <nav aria-label="Hauptnavigation">
          <a href="#produkt">Produkt</a>
          <a href="#integrationen">Integrationen</a>
          <a href="#preise">Preise</a>
          <a href="#ressourcen">Ressourcen</a>
        </nav>
        <div className="site-header__actions">
          <Link href="/login" className="text-link">Anmelden</Link>
          <Link href="/login" className="button button--small">Kostenlos starten</Link>
        </div>
      </header>

      <section className="hero section">
        <div className="hero__copy">
          <h1>Aus Content wird Kontinuität.</h1>
          <p>Plane, verfeinere und veröffentliche deinen Content für alle Kanäle — in einem fokussierten Workflow.</p>
          <div className="hero__actions">
            <Link href="/login" className="button">Workspace erstellen</Link>
            <Link href="/dashboard" className="text-link text-link--arrow"><Play size={16} fill="currentColor" aria-hidden="true" /> Live-Demo ansehen</Link>
          </div>
        </div>
        <HeroCalendar />
      </section>

      <div className="logo-rail" aria-label="Unterstützte Plattformen">
        <span>Meta</span><span>TikTok</span><span>YouTube</span><span>odoo</span><span>mollie</span>
      </div>

      <WorkflowSection />

      <section className="signal-section section" id="ressourcen">
        <div className="signal-section__visual">
          <div className="trend-story">
            <span>Trendradar</span>
            <h3>Behind-the-scenes Formate gewinnen an Tempo.</h3>
            <p>Signal aus deinen verbundenen Kanälen · letzte 7 Tage</p>
            <div className="trend-story__line"><span /><span /><span /><span /><span /></div>
          </div>
          <div className="quality-review">
            <span>Zielgruppenqualität</span>
            <strong>12 Profile zur manuellen Prüfung</strong>
            <p>Verdacht basiert auf Aktivität, Accountalter und Interaktionsmuster — nie auf Namen oder Herkunft.</p>
          </div>
        </div>
        <div className="signal-section__copy">
          <h2>Signale statt Algorithmus-Mythen.</h2>
          <p>ContentDock verbindet deine eigenen Performance-Daten mit aktuellen Format- und Themenbewegungen. Du siehst, was sich verändert, warum es relevant sein könnte und was du als Nächstes testen kannst.</p>
          <ul>
            <li><Check aria-hidden="true" /> Quellen und Zeitraum pro Signal</li>
            <li><Check aria-hidden="true" /> Vorschläge statt blindem Kopieren</li>
            <li><Check aria-hidden="true" /> Manuelle Freigabe vor jeder Aktion</li>
          </ul>
          <Link href="/dashboard" className="text-link text-link--arrow">Trendradar öffnen <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="pricing section" id="preise">
        <div className="section-heading section-heading--center">
          <h2>Ein Plan, der mit deinem Output wächst.</h2>
          <p>Monatlich kündbar. Keine Plattform-Passwörter. Dein KI-Key bleibt unter deiner Kontrolle.</p>
        </div>
        <div className="pricing__grid">
          {pricing.map((plan) => (
            <article className={`price-plan${plan.featured ? " price-plan--featured" : ""}`} key={plan.name}>
              <h3>{plan.name}</h3>
              <p><strong>{plan.price}</strong><span>/ Monat</span></p>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <CheckoutButton plan={plan.plan} featured={plan.featured}>{plan.cta}</CheckoutButton>
            </article>
          ))}
        </div>
        <p className="pricing__note">Plattformzugriffe und Veröffentlichungen hängen von der Freigabe der jeweiligen API ab.</p>
      </section>

      <section className="faq section" aria-label="Häufige Fragen">
        {[
          ["Kann ich meinen eigenen KI-Key nutzen?", "Ja. Der Schlüssel wird nur für deine jeweilige Anfrage verwendet und im Demo-MVP nicht gespeichert."],
          ["Welche Netzwerke werden unterstützt?", "Der MVP bereitet Meta, TikTok und LinkedIn vor. Live-Veröffentlichungen benötigen jeweils App-Review und Nutzerfreigabe."],
          ["Kann ich monatlich kündigen?", "Ja. Die Mollie-Abos sind monatlich angelegt und können zum Ende des laufenden Abrechnungszeitraums beendet werden."],
        ].map(([question, answer]) => (
          <details key={question}>
            <summary>{question}<ChevronDown aria-hidden="true" /></summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <footer className="site-footer">
        <BrandMark inverse />
        <nav><a href="#">Datenschutz</a><a href="#">Impressum</a><a href="#">Status</a><a href="mailto:hallo@contentdock.app">Kontakt</a></nav>
        <strong>Mehr veröffentlichen. Weniger verwalten.</strong>
      </footer>
    </main>
  );
}
