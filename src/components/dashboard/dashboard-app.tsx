"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileImage,
  Home,
  ImageIcon,
  LayoutGrid,
  Linkedin,
  Menu,
  Plug,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ContentComposer } from "@/components/dashboard/content-composer";
import { scheduleItems as initialScheduleItems, weekdays, type Channel, type ScheduleItem } from "@/lib/data";

type View = "Übersicht" | "Kalender" | "Mediathek" | "KI-Studio" | "Trends" | "Integrationen" | "Abrechnung";

const navItems: Array<{ name: View; icon: typeof Home }> = [
  { name: "Übersicht", icon: Home },
  { name: "Kalender", icon: CalendarDays },
  { name: "Mediathek", icon: ImageIcon },
  { name: "KI-Studio", icon: WandSparkles },
  { name: "Trends", icon: TrendingUp },
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

function Overview({ items, onCreate }: { items: ScheduleItem[]; onCreate: () => void }) {
  return (
    <>
      <header className="dashboard-heading">
        <div><h1>Guten Morgen, Lea.</h1><p>Dein Content für diese Woche ist fast bereit.</p></div>
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
          <section className="trend-radar">
            <div className="panel-title"><h2>Trendradar</h2><TrendingUp size={18} aria-hidden="true" /></div>
            <div className="trend-radar__signal">
              <TrendingUp aria-hidden="true" />
              <div><strong>Behind-the-scenes Formate gewinnen an Tempo</strong><p>Mehr Marken setzen auf authentische Einblicke. Engagement steigt.</p></div>
              <button>Analyse öffnen <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function FeatureView({ view, onCreate }: { view: Exclude<View, "Übersicht">; onCreate: () => void }) {
  const featureCopy: Record<Exclude<View, "Übersicht">, { title: string; text: string; icon: typeof Home }> = {
    Kalender: { title: "Content-Kalender", text: "Plane Beiträge kanalübergreifend und behalte Freigaben im Blick.", icon: CalendarDays },
    Mediathek: { title: "Mediathek", text: "Rohmaterial, Entwürfe und veröffentlichte Assets an einem Ort.", icon: FileImage },
    "KI-Studio": { title: "KI-Studio", text: "Erzeuge Captions und Hashtags mit deinem eigenen API-Key — ohne dauerhafte Speicherung.", icon: Sparkles },
    Trends: { title: "Trendradar & Zielgruppenqualität", text: "Quellenbasierte Format-Signale und eine faire, manuelle Prüfung verdächtiger Profile.", icon: TrendingUp },
    Integrationen: { title: "Integrationen", text: "Verwalte Plattformfreigaben, Provider-Status und sichere Verbindungstests.", icon: Plug },
    Abrechnung: { title: "Abrechnung", text: "Mollie-Abonnement, Rechnungen und Planwechsel zentral verwalten.", icon: CircleDollarSign },
  };
  const feature = featureCopy[view];
  const Icon = feature.icon;

  return (
    <div className="feature-view">
      <header><span><Icon aria-hidden="true" /></span><div><h1>{feature.title}</h1><p>{feature.text}</p></div></header>
      {view === "Trends" ? (
        <div className="feature-view__split">
          <section><span className="feature-kicker">Format-Signal · 7 Tage</span><h2>Behind-the-scenes beschleunigt.</h2><p>Deine Kurzvideos mit Produktions-Einblicken halten Zuschauer 18 % länger als dein Median. Teste drei neue Einstiege, ohne fremde Inhalte zu kopieren.</p><button className="button">Test erstellen</button></section>
          <section><span className="feature-kicker">Zielgruppenqualität</span><h2>12 Profile prüfen</h2><p>Die Review-Liste nutzt Aktivitätsmuster, Accountalter und Engagement-Anomalien. Namen, Sprache oder Herkunft werden nicht bewertet.</p><button className="secondary-button"><UsersRound size={17} aria-hidden="true" /> Review öffnen</button></section>
        </div>
      ) : view === "Integrationen" ? (
        <div className="connector-grid">
          {["Meta", "TikTok", "Mollie", "Odoo", "CapCut", "PhotoAI"].map((name, index) => (
            <button key={name}><span><LayoutGrid aria-hidden="true" /></span><strong>{name}</strong><small>{index < 2 ? "App-Review erforderlich" : index < 4 ? "Konfigurierbar" : "Partnerzugang / Übergabe"}</small><ChevronRight aria-hidden="true" /></button>
          ))}
        </div>
      ) : (
        <div className="feature-view__empty">
          <Icon aria-hidden="true" /><h2>Für den MVP vorbereitet.</h2><p>Die Oberfläche und Adaptergrenzen sind angelegt. Verbinde die Provider-Credentials, um den Live-Flow zu aktivieren.</p>
          <button className="button" onClick={onCreate}>Content erstellen <Plus size={17} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

export function DashboardApp() {
  const [activeView, setActiveView] = useState<View>("Übersicht");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState(initialScheduleItems);
  const [toast, setToast] = useState("");

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
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <main className="dashboard-app">
      <aside className={`dashboard-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="dashboard-sidebar__brand"><Link href="/"><BrandMark compact /></Link><button onClick={() => setSidebarOpen(false)} aria-label="Menü schließen"><X /></button></div>
        <nav aria-label="Workspace-Navigation">
          {navItems.map(({ name, icon: Icon }) => (
            <button className={activeView === name ? "is-active" : ""} onClick={() => { setActiveView(name); setSidebarOpen(false); }} key={name}>
              <Icon aria-hidden="true" /><span>{name}</span>
            </button>
          ))}
        </nav>
        <button className="dashboard-sidebar__collapse"><ChevronRight aria-hidden="true" /><span>Menü reduzieren</span></button>
      </aside>

      <section className="dashboard-shell">
        <header className="dashboard-topbar">
          <button className="dashboard-topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Menü öffnen"><Menu /></button>
          <button className="workspace-switcher"><LayoutGrid aria-hidden="true" /><span>Nordlicht Studio</span><ChevronRight aria-hidden="true" /></button>
          <label className="dashboard-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen (z. B. Inhalte, Kanäle, Vorlagen)" aria-label="Workspace durchsuchen" />{query ? <button onClick={() => setQuery("")} aria-label="Suche löschen"><X /></button> : null}</label>
          <div className="dashboard-profile"><button aria-label="Benachrichtigungen"><Bell aria-hidden="true" /><i /></button><span>L</span><strong>Lea</strong></div>
        </header>
        <div className="dashboard-content">
          {query && filteredItems.length !== items.length ? <div className="search-result-note">{filteredItems.length} Inhalte passen zu „{query}“.</div> : null}
          {activeView === "Übersicht" ? <Overview items={filteredItems} onCreate={() => setComposerOpen(true)} /> : <FeatureView view={activeView} onCreate={() => setComposerOpen(true)} />}
        </div>
      </section>
      {composerOpen ? <ContentComposer onClose={() => setComposerOpen(false)} onCreate={addContent} /> : null}
      {toast ? <div className="app-toast"><CheckCircle2 aria-hidden="true" /> {toast}</div> : null}
    </main>
  );
}
