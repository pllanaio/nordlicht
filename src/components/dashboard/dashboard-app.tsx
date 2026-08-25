"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ExternalLink,
  FileImage,
  Home,
  ImageIcon,
  Instagram,
  LayoutGrid,
  Link2,
  Linkedin,
  LockKeyhole,
  LogOut,
  Menu,
  Music2,
  Plug,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unplug,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ContentComposer } from "@/components/dashboard/content-composer";
import { logout } from "@/app/actions/auth";
import { scheduleItems as initialScheduleItems, weekdays, type Channel, type ScheduleItem } from "@/lib/data";
import type { SocialConnectorCard, SocialProviderId } from "@/lib/integrations/contracts";
import { minimumPlanFor, planCatalog, planIds, planIncludes, type PlanFeature, type PlanId } from "@/lib/plans";

export type DashboardView = "Übersicht" | "Kalender" | "Freigaben" | "Mediathek" | "KI-Studio" | "Trends" | "Integrationen" | "Abrechnung";

type ConnectorFeedback = { provider?: string; status: string };

const navItems: Array<{ name: DashboardView; icon: typeof Home; feature?: PlanFeature }> = [
  { name: "Übersicht", icon: Home },
  { name: "Kalender", icon: CalendarDays },
  { name: "Freigaben", icon: UsersRound, feature: "team_approvals" },
  { name: "Mediathek", icon: ImageIcon },
  { name: "KI-Studio", icon: WandSparkles },
  { name: "Trends", icon: TrendingUp, feature: "trend_radar" },
  { name: "Integrationen", icon: Plug },
  { name: "Abrechnung", icon: CircleDollarSign },
];

const channelClass: Record<Channel, string> = {
  Instagram: "instagram",
  TikTok: "tiktok",
  LinkedIn: "linkedin",
  YouTube: "youtube",
};

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === "LinkedIn") return <Linkedin aria-hidden="true" size={15} />;
  return <span aria-hidden="true">{channel === "Instagram" ? "◎" : channel === "TikTok" ? "♪" : "▶"}</span>;
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
  return (
    <article className="schedule-card">
      <Image src={item.image} alt="" width={72} height={62} sizes="72px" />
      <div>
        <small><span className={`channel-icon channel-icon--${channelClass[item.channel]}`}><ChannelIcon channel={item.channel} /></span>{item.time}</small>
        <strong>{item.title}</strong>
        <em className={`status status--${item.status.toLowerCase()}`}>{item.status}</em>
      </div>
    </article>
  );
}

function WeekPlanner({ items }: { items: ScheduleItem[] }) {
  return (
    <section className="week-planner">
      <div className="week-planner__head">
        <h2>Diese Woche</h2>
        <span>24.–30. August</span>
      </div>
      <div className="week-planner__days">
        <div className="week-planner__time-space" />
        {weekdays.map((day) => (
          <div className={day.day === 26 ? "is-selected" : ""} key={day.day}><span>{day.short}</span><strong>{day.day}</strong></div>
        ))}
      </div>
      <div className="week-planner__body">
        <div className="week-planner__times"><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span></div>
        <div className="week-planner__columns">
          {weekdays.map((day) => (
            <div className={`week-column${day.day === 26 ? " is-selected" : ""}`} key={day.day}>
              {items.filter((item) => item.day === day.day).map((item) => (
                <div className={`schedule-slot schedule-slot--${item.time.slice(0, 2)}`} key={item.id}><ScheduleCard item={item} /></div>
              ))}
              {day.day === 26 ? <div className="current-time" aria-label="Aktuelle Zeit"><span /></div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Overview({
  items,
  onCreate,
  demo,
  displayName,
  trendAccess,
}: {
  items: ScheduleItem[];
  onCreate: () => void;
  demo: boolean;
  displayName: string;
  trendAccess: boolean;
}) {
  return (
    <>
      <header className="dashboard-heading">
        <div><h1>{demo ? "Live-Demo: Nordlicht Studio" : `Guten Morgen, ${displayName}.`}</h1><p>{demo ? "Erstelle und plane Content – nur das Veröffentlichen bleibt gesperrt." : "Dein Content für diese Woche ist fast bereit."}</p></div>
        <button className="button dashboard-heading__button" onClick={onCreate}>Content erstellen <Plus size={17} aria-hidden="true" /></button>
      </header>
      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <WeekPlanner items={items} />
          <div className="dashboard-lower">
            <section className="channel-table">
              <h2>Kanäle</h2>
              <div className="channel-table__labels"><span>Kanal</span><span>Status</span><span>Nächste Veröffentlichung</span></div>
              {[
                ["Instagram", "@nordlicht.studio", "Mi, 26. Aug., 17:00"],
                ["TikTok", "@nordlicht.studio", "Mi, 26. Aug., 10:30"],
                ["LinkedIn", "Nordlicht Studio", "Fr, 28. Aug., 12:00"],
              ].map(([channel, handle, next]) => (
                <div className="channel-row" key={channel}>
                  <span className={`channel-icon channel-icon--${channel.toLowerCase()}`}><ChannelIcon channel={channel as Channel} /></span>
                  <span><strong>{channel}</strong><small>{handle}</small></span>
                  <span className="channel-row__status"><i /> Verbunden</span><span>{next}</span><ChevronRight size={16} aria-hidden="true" />
                </div>
              ))}
            </section>
            <section className="reminders">
              <h2>Erinnerungen</h2>
              <button><span><CalendarDays aria-hidden="true" /></span><span><strong>Freigabe ausstehend</strong><small>1 Inhalt wartet auf deine Freigabe.</small></span><ChevronRight aria-hidden="true" /></button>
              <button><span><Bell aria-hidden="true" /></span><span><strong>Verbindung prüfen</strong><small>1 Integration benötigt Aufmerksamkeit.</small></span><ChevronRight aria-hidden="true" /></button>
            </section>
          </div>
        </div>
        <aside className="dashboard-grid__aside">
          <section className="next-step">
            <div className="panel-title"><h2>Nächster Schritt</h2><span>•••</span></div>
            <h3>TikTok-Reel finalisieren</h3>
            <p>Bring dein Reel auf den letzten Stand.</p>
            <div className="progress-steps"><span className="is-done">1<small>Bearbeiten</small></span><span className="is-active">2<small>Review</small></span><span>3<small>Planen</small></span></div>
            <div className="next-step__media">
              <Image src="/media/creator-studio.webp" alt="Vorschau des TikTok-Reels" width={92} height={128} sizes="92px" />
              <div><strong>Caption (Auszug)</strong><p>Ein Blick hinter die Kulissen von Nordlicht Studio. So entsteht Content, der verbindet.</p></div>
            </div>
            <button className="button" onClick={onCreate}>Weiter bearbeiten <ArrowRight size={17} aria-hidden="true" /></button>
          </section>
          {trendAccess ? (
            <section className="trend-radar">
              <div className="panel-title"><h2>Trendradar</h2><TrendingUp size={18} aria-hidden="true" /></div>
              <div className="trend-radar__signal">
                <TrendingUp aria-hidden="true" />
                <div><strong>Behind-the-scenes Formate gewinnen an Tempo</strong><p>Mehr Marken setzen auf authentische Einblicke. Engagement steigt.</p></div>
                <button>Analyse öffnen <ArrowRight size={15} aria-hidden="true" /></button>
              </div>
            </section>
          ) : (
            <section className="trend-radar trend-radar--locked">
              <LockKeyhole aria-hidden="true" />
              <div><span className="feature-kicker">Pro-Feature</span><h2>Trendradar</h2><p>Trend- und Algorithmus-Signale sind im Pro-Tarif verfügbar.</p></div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

const socialProviderIcons: Record<SocialProviderId, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
};

function IntegrationsView({
  connectors,
  demo,
}: {
  connectors: SocialConnectorCard[];
  demo: boolean;
}) {
  return (
    <div className="integrations-panel">
      <div className="integrations-panel__intro">
        <div>
          <span className="feature-kicker">Social Publishing</span>
          <h2>Deine Accounts. Sicher verbunden.</h2>
          <p>ContentDock erhält nur die freigegebenen OAuth-Berechtigungen. Deine Plattform-Passwörter bleiben immer beim jeweiligen Anbieter.</p>
        </div>
        <span className="integrations-panel__security"><ShieldCheck aria-hidden="true" /> OAuth 2.0 · verschlüsselte Tokens</span>
      </div>

      <div className="social-connector-grid">
        {connectors.map((connector) => {
          const Icon = socialProviderIcons[connector.provider];
          const connected = Boolean(connector.connection);
          return (
            <article className={`social-connector social-connector--${connector.provider}`} key={connector.provider}>
              <div className="social-connector__head">
                <span className="social-connector__icon"><Icon aria-hidden="true" /></span>
                <span className={`social-connector__status ${connected ? "is-connected" : connector.configured ? "is-ready" : "is-missing"}`}>
                  {connected ? <><i /> Verbunden</> : connector.configured ? "Bereit" : "Konfiguration fehlt"}
                </span>
              </div>
              <h3>{connector.label}</h3>
              <p>{connector.description}</p>
              {connector.connection ? (
                <div className="social-connector__account">
                  <span>{connector.connection.displayName.slice(0, 1).toLocaleUpperCase("de")}</span>
                  <div><strong>{connector.connection.displayName}</strong><small>{connector.publishingReady ? "Publishing freigegeben" : "Account erfolgreich hinterlegt"}</small></div>
                </div>
              ) : (
                <div className="social-connector__notice">
                  {connector.configured ? <Link2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                  <span>{connector.configured ? "Bereit für den offiziellen Login-Dialog." : demo ? "Dieser Connector wird aktuell eingerichtet." : "App-ID, Secret und Token-Schlüssel in Vercel hinterlegen."}</span>
                </div>
              )}
              <div className="social-connector__actions">
                {connector.connection && demo ? (
                  <form action={`/api/connect/${connector.provider}/disconnect?mode=demo`} method="post">
                    <button className="secondary-button" type="submit"><Unplug size={15} aria-hidden="true" /> Verbindung trennen</button>
                  </form>
                ) : connector.connection && !connector.publishingReady ? (
                  <a className="button" href={`/api/connect/${connector.provider}/start`}>Publishing freigeben <ArrowRight size={15} aria-hidden="true" /></a>
                ) : connector.connection ? (
                  <form action={`/api/connect/${connector.provider}/disconnect`} method="post">
                    <button className="secondary-button" type="submit"><Unplug size={15} aria-hidden="true" /> Trennen</button>
                  </form>
                ) : connector.configured ? (
                  <a className="button" href={`/api/connect/${connector.provider}/start${demo ? "?mode=demo" : ""}`}>Mit {connector.label} verbinden <ArrowRight size={15} aria-hidden="true" /></a>
                ) : (
                  <span className="social-connector__disabled">Noch nicht konfiguriert</span>
                )}
                <a className="social-connector__docs" href={connector.docsUrl} target="_blank" rel="noreferrer" aria-label={`${connector.label} Dokumentation öffnen`}><ExternalLink aria-hidden="true" /></a>
              </div>
            </article>
          );
        })}
      </div>

      {demo ? <p className="integrations-panel__paywall"><LockKeyhole aria-hidden="true" /> Account-Verbindung, Content-Erstellung und Planung funktionieren in der Demo. Erst die tatsächliche Veröffentlichung benötigt ein aktives Abo und zusätzliche Publishing-Freigaben.</p> : null}

      <section className="connector-architecture">
        <div><span>1</span><strong>Verbinden</strong><small>Offizieller Login beim Anbieter</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>2</span><strong>Freigeben</strong><small>Nur benötigte Berechtigungen</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>3</span><strong>Automatisieren</strong><small>Planen, prüfen und veröffentlichen</small></div>
      </section>

      <div className="connector-grid connector-grid--secondary">
        {["Mollie", "Odoo", "CapCut", "PhotoAI"].map((name, index) => (
          <div key={name}><span><LayoutGrid aria-hidden="true" /></span><strong>{name}</strong><small>{index < 2 ? "Konfigurierbar" : "Partnerzugang / Übergabe"}</small><ChevronRight aria-hidden="true" /></div>
        ))}
      </div>
    </div>
  );
}

function LockedFeature({ plan, feature }: { plan: PlanId; feature: PlanFeature }) {
  const requiredPlan = minimumPlanFor(feature);
  const featureLabel = feature === "team_approvals" ? "Teamfreigaben" : "Trendradar";
  return (
    <div className="feature-view__locked">
      <span><LockKeyhole aria-hidden="true" /></span>
      <div>
        <span className="feature-kicker">In deinem Testtarif gesperrt</span>
        <h2>{featureLabel} ist ein {planCatalog[requiredPlan].label}-Feature.</h2>
        <p>Du testest gerade {planCatalog[plan].label}. Melde dich mit einem {planCatalog[requiredPlan].label}-Testkonto{requiredPlan === "studio" ? " oder Pro-Testkonto" : ""} an, um diesen Bereich zu prüfen.</p>
        <Link className="button" href="/login">Anderes Testkonto verwenden <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

function BillingView({ plan, internalTest }: { plan: PlanId; internalTest: boolean }) {
  return (
    <div className="plan-overview">
      <section className="plan-overview__current">
        <div>
          <span className="feature-kicker">Aktiver Tarif</span>
          <h2>{planCatalog[plan].label}</h2>
          <p>{planCatalog[plan].summary}</p>
        </div>
        <div className="plan-overview__price"><strong>{planCatalog[plan].price}</strong><span>/ Monat</span></div>
        {internalTest ? <p className="plan-overview__test"><ShieldCheck aria-hidden="true" /> Interne Abo-Simulation – keine Mollie-Zahlung und keine Rechnung.</p> : null}
      </section>
      <section className="plan-overview__matrix" aria-labelledby="plan-matrix-title">
        <div><span className="feature-kicker">Stufentest</span><h2 id="plan-matrix-title">Feature-Zugriff je Tarif</h2></div>
        <div className="plan-overview__plans">
          {planIds.map((planId) => (
            <article className={planId === plan ? "is-current" : ""} key={planId}>
              <header><strong>{planCatalog[planId].label}</strong>{planId === plan ? <span>Aktiv</span> : null}</header>
              <ul>{planCatalog[planId].features.map((feature) => <li key={feature}><CheckCircle2 aria-hidden="true" /> {feature}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureView({
  view,
  onCreate,
  demo,
  connectors,
  plan,
  internalTest,
}: {
  view: Exclude<DashboardView, "Übersicht">;
  onCreate: () => void;
  demo: boolean;
  connectors: SocialConnectorCard[];
  plan: PlanId;
  internalTest: boolean;
}) {
  const featureCopy: Record<Exclude<DashboardView, "Übersicht">, { title: string; text: string; icon: typeof Home }> = {
    Kalender: { title: "Content-Kalender", text: "Plane Beiträge kanalübergreifend und behalte Freigaben im Blick.", icon: CalendarDays },
    Freigaben: { title: "Teamfreigaben", text: "Prüfe Inhalte gemeinsam, sammle Feedback und dokumentiere Entscheidungen.", icon: UsersRound },
    Mediathek: { title: "Mediathek", text: "Rohmaterial, Entwürfe und veröffentlichte Assets an einem Ort.", icon: FileImage },
    "KI-Studio": { title: "KI-Studio", text: "Erzeuge Captions und Hashtags mit deinem eigenen API-Key — ohne dauerhafte Speicherung.", icon: Sparkles },
    Trends: { title: "Trendradar & Zielgruppenqualität", text: "Quellenbasierte Format-Signale und eine faire, manuelle Prüfung verdächtiger Profile.", icon: TrendingUp },
    Integrationen: { title: "Integrationen", text: "Verwalte Plattformfreigaben, Provider-Status und sichere Verbindungstests.", icon: Plug },
    Abrechnung: { title: "Abrechnung", text: "Mollie-Abonnement, Rechnungen und Planwechsel zentral verwalten.", icon: CircleDollarSign },
  };
  const feature = featureCopy[view];
  const Icon = feature.icon;
  const restrictedFeature = view === "Trends" ? "trend_radar" : view === "Freigaben" ? "team_approvals" : null;
  const restricted = !demo && Boolean(restrictedFeature && !planIncludes(plan, restrictedFeature));

  return (
    <div className="feature-view">
      <header><span><Icon aria-hidden="true" /></span><div><h1>{feature.title}</h1><p>{feature.text}</p></div></header>
      {restricted && restrictedFeature ? (
        <LockedFeature plan={plan} feature={restrictedFeature} />
      ) : view === "Trends" ? (
        <div className="feature-view__split">
          <section><span className="feature-kicker">Format-Signal · 7 Tage</span><h2>Behind-the-scenes beschleunigt.</h2><p>Deine Kurzvideos mit Produktions-Einblicken halten Zuschauer 18 % länger als dein Median. Teste drei neue Einstiege, ohne fremde Inhalte zu kopieren.</p><button className="button">Test erstellen</button></section>
          <section><span className="feature-kicker">Zielgruppenqualität</span><h2>12 Profile prüfen</h2><p>Die Review-Liste nutzt Aktivitätsmuster, Accountalter und Engagement-Anomalien. Namen, Sprache oder Herkunft werden nicht bewertet.</p><button className="secondary-button"><UsersRound size={17} aria-hidden="true" /> Review öffnen</button></section>
        </div>
      ) : view === "Freigaben" ? (
        <div className="feature-view__split">
          <section><span className="feature-kicker">Freigabe offen</span><h2>TikTok-Reel final prüfen</h2><p>Caption, Format und Veröffentlichungszeit warten auf die Entscheidung des Teams.</p><button className="button">Review öffnen</button></section>
          <section><span className="feature-kicker">Teamaktivität</span><h2>3 Entscheidungen diese Woche</h2><p>Alle Kommentare, Änderungen und Freigaben bleiben nachvollziehbar im Content-Verlauf dokumentiert.</p><button className="secondary-button"><UsersRound size={17} aria-hidden="true" /> Verlauf ansehen</button></section>
        </div>
      ) : view === "Integrationen" ? (
        <IntegrationsView connectors={connectors} demo={demo} />
      ) : view === "Abrechnung" ? (
        <BillingView plan={plan} internalTest={internalTest} />
      ) : (
        <div className="feature-view__empty">
          <Icon aria-hidden="true" /><h2>Für den MVP vorbereitet.</h2><p>Die Oberfläche und Adaptergrenzen sind angelegt. Verbinde die Provider-Credentials, um den Live-Flow zu aktivieren.</p>
          <button className="button" onClick={onCreate}>Content erstellen <Plus size={17} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

function connectorFeedbackMessage(feedback?: ConnectorFeedback) {
  if (!feedback) return "";
  const provider = feedback.provider ? `${feedback.provider.slice(0, 1).toLocaleUpperCase("de")}${feedback.provider.slice(1)}` : "Der Connector";
  const messages: Record<string, string> = {
    connected: `${provider} wurde erfolgreich verbunden.`,
    disconnected: `${provider} wurde getrennt.`,
    denied: `Die Verbindung mit ${provider} wurde abgebrochen.`,
    invalid_state: "Die Verbindungsanfrage ist abgelaufen. Bitte starte sie erneut.",
    configuration_required: `${provider} ist noch nicht vollständig konfiguriert.`,
    failed: `${provider} konnte nicht verbunden werden. Bitte versuche es erneut.`,
    unsupported: "Dieser Connector wird nicht unterstützt.",
  };
  return messages[feedback.status] ?? "Der Connector-Status wurde aktualisiert.";
}

export function DashboardApp({
  mode = "workspace",
  connectors = [],
  displayName = "Lea",
  internalTest = false,
  plan = "pro",
  initialView = "Übersicht",
  connectorFeedback,
}: {
  mode?: "workspace" | "demo";
  connectors?: SocialConnectorCard[];
  displayName?: string;
  internalTest?: boolean;
  plan?: PlanId;
  initialView?: DashboardView;
  connectorFeedback?: ConnectorFeedback;
}) {
  const [activeView, setActiveView] = useState<DashboardView>(initialView);
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState(initialScheduleItems);
  const [toast, setToast] = useState(() => connectorFeedbackMessage(connectorFeedback));
  const isDemo = mode === "demo";
  const activePlan = planCatalog[plan];
  const profileInitial = isDemo ? "D" : (displayName.trim().slice(0, 1).toLocaleUpperCase("de") || "T");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4_200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (!normalized) return items;
    return items.filter((item) => `${item.title} ${item.channel} ${item.status}`.toLocaleLowerCase("de").includes(normalized));
  }, [items, query]);

  function addContent(content: { title: string; channel: Channel; caption: string }) {
    const nextItem: ScheduleItem = {
      id: `new-${Date.now()}`,
      day: 30,
      weekday: "So",
      time: "11:00",
      title: content.title || "Neuer Content",
      channel: content.channel,
      status: "Entwurf",
      image: "/media/design-studio.webp",
    };
    setItems((current) => [...current, nextItem]);
    setComposerOpen(false);
    setToast("Entwurf wurde für Sonntag angelegt.");
  }

  function openCreate() {
    setComposerOpen(true);
  }

  return (
    <main className={`dashboard-app${isDemo ? " dashboard-app--demo" : ""}`}>
      <aside className={`dashboard-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="dashboard-sidebar__brand"><Link href="/"><BrandMark compact /></Link><button onClick={() => setSidebarOpen(false)} aria-label="Menü schließen"><X /></button></div>
        <nav aria-label="Workspace-Navigation">
          {navItems.map(({ name, icon: Icon, feature }) => {
            const locked = !isDemo && Boolean(feature && !planIncludes(plan, feature));
            return (
              <button className={`${activeView === name ? "is-active" : ""}${locked ? " is-locked" : ""}`} onClick={() => { setActiveView(name); setSidebarOpen(false); }} key={name}>
                <Icon aria-hidden="true" /><span>{name}</span>{locked ? <LockKeyhole className="dashboard-sidebar__lock" aria-label="In diesem Tarif gesperrt" /> : null}
              </button>
            );
          })}
        </nav>
        <button className="dashboard-sidebar__collapse"><ChevronRight aria-hidden="true" /><span>Menü reduzieren</span></button>
      </aside>

      <section className="dashboard-shell">
        {isDemo ? (
          <div className="demo-banner">
            <span><LockKeyhole aria-hidden="true" /> Live-Demo · Veröffentlichung gesperrt</span>
            <Link href="/#preise">Abo auswählen <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        ) : null}
        <header className="dashboard-topbar">
          <button className="dashboard-topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Menü öffnen"><Menu /></button>
          <button className="workspace-switcher"><LayoutGrid aria-hidden="true" /><span>Nordlicht Studio</span>{!isDemo ? <em>{activePlan.label}{internalTest ? " · Test" : ""}</em> : null}<ChevronRight aria-hidden="true" /></button>
          <label className="dashboard-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen (z. B. Inhalte, Kanäle, Vorlagen)" aria-label="Workspace durchsuchen" />{query ? <button onClick={() => setQuery("")} aria-label="Suche löschen"><X /></button> : null}</label>
          <div className="dashboard-profile">
            <button aria-label="Benachrichtigungen"><Bell aria-hidden="true" /><i /></button>
            <span>{profileInitial}</span>
            <div><strong>{isDemo ? "Demo" : displayName}</strong>{!isDemo ? <small>{activePlan.label}{internalTest ? " · Testkonto" : ""}</small> : null}</div>
            {!isDemo ? <form action={logout}><button type="submit" aria-label="Abmelden" title="Abmelden"><LogOut aria-hidden="true" /></button></form> : null}
          </div>
        </header>
        <div className="dashboard-content">
          {query && filteredItems.length !== items.length ? <div className="search-result-note">{filteredItems.length} Inhalte passen zu „{query}“.</div> : null}
          {activeView === "Übersicht" ? (
            <Overview
              items={filteredItems}
              onCreate={openCreate}
              demo={isDemo}
              displayName={displayName}
              trendAccess={isDemo || planIncludes(plan, "trend_radar")}
            />
          ) : (
            <FeatureView
              view={activeView}
              onCreate={openCreate}
              demo={isDemo}
              connectors={connectors}
              plan={plan}
              internalTest={internalTest}
            />
          )}
        </div>
      </section>
      {composerOpen ? <ContentComposer mode={mode} onClose={() => setComposerOpen(false)} onCreate={addContent} /> : null}
      {toast ? <div className="app-toast"><CheckCircle2 aria-hidden="true" /> {toast}</div> : null}
    </main>
  );
}
