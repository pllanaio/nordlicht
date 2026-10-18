"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clapperboard,
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
  Youtube,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardDialog, useModalInteraction } from "@/components/dashboard/dashboard-dialog";
import { ContentComposer } from "@/components/dashboard/content-composer";
import { AiStudio } from "@/components/dashboard/ai-studio";
import { VideoStudio } from "@/components/dashboard/video-studio";
import { initialMediaAssets, MediaLibrary } from "@/components/dashboard/media-library";
import { initialOrganization, OrganizationManager } from "@/components/dashboard/organization-manager";
import { ProfileDialog } from "@/components/dashboard/profile-dialog";
import { ScheduleItemDialog } from "@/components/dashboard/schedule-item-dialog";
import { TrendRadar } from "@/components/trend-radar";
import { logout } from "@/app/actions/auth";
import { calendarAnchorDate, scheduleItems as initialScheduleItems, type Channel, type ScheduleItem } from "@/lib/data";
import type { SocialConnectorCard, SocialProviderId } from "@/lib/integrations/contracts";
import { minimumPlanFor, planCatalog, planIds, planIncludes, type PlanFeature, type PlanId } from "@/lib/plans";
import type { MediaAsset, Organization, UserProfile, WorkspaceDashboardData } from "@/lib/workspace-types";

export type DashboardView = "Übersicht" | "Kalender" | "Freigaben" | "Organisation" | "Mediathek" | "KI-Studio" | "Video-Studio" | "Trends" | "Integrationen" | "Abrechnung";

type ConnectorFeedback = { provider?: string; status: string };

const navItems: Array<{ name: DashboardView; icon: typeof Home; feature?: PlanFeature }> = [
  { name: "Übersicht", icon: Home },
  { name: "Kalender", icon: CalendarDays },
  { name: "Freigaben", icon: UsersRound, feature: "team_approvals" },
  { name: "Organisation", icon: Building2, feature: "team_approvals" },
  { name: "Mediathek", icon: ImageIcon },
  { name: "KI-Studio", icon: WandSparkles },
  { name: "Video-Studio", icon: Clapperboard },
  { name: "Trends", icon: TrendingUp },
  { name: "Integrationen", icon: Plug },
  { name: "Abrechnung", icon: CircleDollarSign },
];

const managerViews = new Set<DashboardView>(["Übersicht", "Kalender", "Freigaben", "Mediathek", "KI-Studio", "Video-Studio", "Trends"]);
const viewQueries: Record<DashboardView, string> = { Übersicht: "", Kalender: "kalender", Freigaben: "freigaben", Organisation: "organisation", Mediathek: "mediathek", "KI-Studio": "ki-studio", "Video-Studio": "video-studio", Trends: "trends", Integrationen: "integrations", Abrechnung: "abrechnung" };
const mobileNavigationQuery = "(max-width: 720px)";
function subscribeMobileNavigation(callback: () => void) {
  const media = window.matchMedia(mobileNavigationQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const demoCookieNames = {
  items: "contentdock_demo_items_v1",
  organization: "contentdock_demo_organization_v1",
  profile: "contentdock_demo_profile_v1",
};

function readDemoCookie<T>(name: string): T | undefined {
  const prefix = `${name}=`;
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  if (!value) return undefined;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return undefined;
  }
}

function writeDemoCookie(name: string, value: unknown) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // The public demo remains usable in memory when cookies are disabled or full.
  }
}

const channelClass: Record<Channel, string> = {
  Instagram: "instagram",
  TikTok: "tiktok",
  LinkedIn: "linkedin",
  YouTube: "youtube",
};

function parseCalendarDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(date: string, amount: number) {
  const result = parseCalendarDate(date);
  result.setDate(result.getDate() + amount);
  return toCalendarDate(result);
}

function getWeekStart(date: string) {
  const result = parseCalendarDate(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return toCalendarDate(result);
}

function formatCalendarMoment(date: string, time: string) {
  const formattedDate = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(parseCalendarDate(date));
  return `${formattedDate}, ${time} Uhr`;
}

function getWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStart, index);
    return {
      date,
      day: parseCalendarDate(date).getDate(),
      short: new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(parseCalendarDate(date)).replace(".", ""),
    };
  });
}

function formatWeekRange(weekStart: string) {
  const weekEnd = addCalendarDays(weekStart, 6);
  const start = parseCalendarDate(weekStart);
  const end = parseCalendarDate(weekEnd);
  const startLabel = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: start.getMonth() === end.getMonth() ? undefined : "short" }).format(start);
  const endLabel = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function getIsoWeek(date: string) {
  const value = parseCalendarDate(date);
  const target = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function contentTypeLabel(channel: Channel) {
  if (channel === "TikTok") return "TikTok-Video";
  if (channel === "Instagram") return "Instagram-Reel";
  if (channel === "LinkedIn") return "LinkedIn-Beitrag";
  return "YouTube-Video";
}

type LiveNotice = {
  id: string;
  title: string;
  detail: string;
  kind: "approval" | "draft" | "connector";
  itemId?: string;
};

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === "LinkedIn") return <Linkedin aria-hidden="true" size={15} />;
  return <span aria-hidden="true">{channel === "Instagram" ? "◎" : channel === "TikTok" ? "♪" : "▶"}</span>;
}

function ScheduleCard({ item, onOpen }: { item: ScheduleItem; onOpen: (id: string) => void }) {
  return (
    <button className="schedule-card" type="button" onClick={() => onOpen(item.id)} aria-label={`${item.title}, ${formatCalendarMoment(item.date, item.time)} – Details bearbeiten`}>
      {item.image ? <Image unoptimized={item.image.startsWith("/api/") || item.image.startsWith("blob:")} src={item.image} alt="" width={72} height={62} sizes="72px" /> : <span className="media-placeholder"><FileImage aria-hidden="true" /></span>}
      <div>
        <small><span className={`channel-icon channel-icon--${channelClass[item.channel]}`}><ChannelIcon channel={item.channel} /></span>{item.time} Uhr</small>
        <strong>{item.title}</strong>
        <em className={`status status--${item.status.toLowerCase()}`}>{item.status}</em>
      </div>
    </button>
  );
}

function WeekPlanner({
  items,
  weekStart,
  focusDate,
  onOpenItem,
  onPreviousWeek,
  onNextWeek,
  onSelectDay,
}: {
  items: ScheduleItem[];
  weekStart: string;
  focusDate: string;
  onOpenItem: (id: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: string) => void;
}) {
  const days = getWeekDays(weekStart);
  return (
    <section className="week-planner">
      <div className="week-planner__head">
        <h2>Wochenansicht <span>KW {getIsoWeek(weekStart)}</span></h2>
        <div className="week-planner__controls">
          <button type="button" onClick={onPreviousWeek} aria-label="Vorherige Woche"><ChevronLeft aria-hidden="true" /></button>
          <span>{formatWeekRange(weekStart)}</span>
          <button type="button" onClick={onNextWeek} aria-label="Nächste Woche"><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
      <div className="week-planner__days">
        {days.map((day) => (
          <button className={day.date === focusDate ? "is-selected" : ""} aria-pressed={day.date === focusDate} type="button" onClick={() => onSelectDay(day.date)} aria-label={`${day.short}, ${day.day}. auswählen`} key={day.date}><span>{day.short}</span><strong>{day.day}</strong></button>
        ))}
      </div>
      <div className="week-planner__agenda">
        {days.map((day) => {
          const dayItems = items.filter((item) => item.date === day.date).toSorted((a, b) => a.time.localeCompare(b.time));
          return <section key={day.date}><h3>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(parseCalendarDate(day.date))}</h3>{dayItems.length ? dayItems.map((item) => <ScheduleCard key={item.id} item={item} onOpen={onOpenItem} />) : <p className="agenda-empty">Keine Beiträge geplant</p>}</section>;
        })}
      </div>
      <div className="week-planner__body">
        <div className="week-planner__columns">
          {days.map((day) => (
            <div className={`week-column${day.date === focusDate ? " is-selected" : ""}`} onClick={() => onSelectDay(day.date)} key={day.date}>
              {items.filter((item) => item.date === day.date).toSorted((a, b) => a.time.localeCompare(b.time)).map((item) => (
                <div className="schedule-slot" key={item.id}><ScheduleCard item={item} onOpen={onOpenItem} /></div>
              ))}
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
  weekStart,
  focusDate,
  onOpenItem,
  onPreviousWeek,
  onNextWeek,
  onSelectDay,
  onOpenTrends,
  onOpenIntegrations,
  onOpenVideoStudio,
  connectors,
  notices,
  unfinishedItems,
  activeDraftIndex,
  onCycleDraft,
}: {
  items: ScheduleItem[];
  onCreate: () => void;
  demo: boolean;
  displayName: string;
  weekStart: string;
  focusDate: string;
  onOpenItem: (id: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: string) => void;
  onOpenTrends: () => void;
  onOpenIntegrations: () => void;
  onOpenVideoStudio: () => void;
  connectors: SocialConnectorCard[];
  notices: LiveNotice[];
  unfinishedItems: ScheduleItem[];
  activeDraftIndex: number;
  onCycleDraft: (direction: -1 | 1) => void;
}) {
  const nextItem = unfinishedItems[activeDraftIndex];
  const channels: Array<{ channel: Channel; provider?: SocialProviderId }> = [
    { channel: "Instagram", provider: "instagram" },
    { channel: "TikTok", provider: "tiktok" },
    { channel: "YouTube", provider: "youtube" },
    { channel: "LinkedIn", provider: "linkedin" },
  ];

  return (
    <>
      <header className="dashboard-heading">
        <div><h1>{demo ? "Dein Überblick · Demo" : `Hallo, ${displayName}.`}</h1><p>{demo ? "Entdecke ContentDock mit Beispieldaten. Es wird nichts veröffentlicht." : `${items.length} ${items.length === 1 ? "Beitrag" : "Beiträge"} in deinem Kalender. Hier geht es mit deinen Ideen weiter.`}</p></div>
        <button className="button dashboard-heading__button" onClick={onOpenVideoStudio}>Video erstellen <Clapperboard size={17} aria-hidden="true" /></button>
      </header>
      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <WeekPlanner items={items} weekStart={weekStart} focusDate={focusDate} onOpenItem={onOpenItem} onPreviousWeek={onPreviousWeek} onNextWeek={onNextWeek} onSelectDay={onSelectDay} />
          <div className="dashboard-lower">
            <section className="channel-table">
              <h2>Kanäle</h2>
              <div className="channel-table__labels"><span>Kanal</span><span>Status</span><span>Nächster Wunschtermin</span></div>
              {channels.map(({ channel, provider }) => {
                const connector = connectors.find((candidate) => candidate.provider === provider);
                const connected = Boolean(connector?.connection);
                const next = items.filter((item) => item.channel === channel && item.status === "Geplant").toSorted((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
                return (
                  <button className="channel-row" type="button" onClick={onOpenIntegrations} key={channel}>
                    <span className={`channel-icon channel-icon--${channel.toLowerCase()}`}><ChannelIcon channel={channel} /></span>
                    <span><strong>{channel}</strong><small>{connector?.connection?.displayName ?? "Noch nicht verbunden"}</small></span>
                    <span className={`channel-row__status${connected ? "" : " is-missing"}`}><i /> {connected ? "Verbunden" : connector?.configured ? "Bereit" : "Nicht eingerichtet"}</span><span>{next ? formatCalendarMoment(next.date, next.time) : "Nichts geplant"}</span><ChevronRight size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </section>
            <section className="reminders">
              <div className="panel-title"><h2>Erinnerungen</h2><span>{notices.length}</span></div>
              {notices.length ? notices.slice(0, 4).map((notice) => (
                <button type="button" onClick={() => notice.itemId ? onOpenItem(notice.itemId) : onOpenIntegrations()} key={notice.id}><span>{notice.kind === "connector" ? <Bell aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}</span><span><strong>{notice.title}</strong><small>{notice.detail}</small></span><ChevronRight aria-hidden="true" /></button>
              )) : <div className="reminders__empty"><CheckCircle2 aria-hidden="true" /><strong>Alles erledigt</strong><small>Aktuell gibt es keine offenen Aufgaben.</small></div>}
            </section>
          </div>
        </div>
        <aside className="dashboard-grid__aside">
          <section className="next-step">
            <div className="panel-title"><h2>Nächster Schritt</h2>{unfinishedItems.length ? <div className="next-step__navigation"><button type="button" onClick={() => onCycleDraft(-1)} aria-label="Vorheriger Entwurf"><ChevronLeft /></button><span>{activeDraftIndex + 1}/{unfinishedItems.length}</span><button type="button" onClick={() => onCycleDraft(1)} aria-label="Nächster Entwurf"><ChevronRight /></button></div> : null}</div>
            {nextItem ? <>
              <span className="next-step__type">{contentTypeLabel(nextItem.channel)}</span>
              <h3>{contentTypeLabel(nextItem.channel)} finalisieren</h3>
              <p>{nextItem.status === "Freigabe" ? "Prüfe den Beitrag und lege seinen Wunschtermin fest." : "Vervollständige den Entwurf und gib ihn zur Prüfung frei."}</p>
              <div className="progress-steps"><span className={nextItem.status !== "Entwurf" ? "is-done" : "is-active"}>1<small>Bearbeiten</small></span><span className={nextItem.status === "Freigabe" ? "is-active" : ""}>2<small>Prüfen</small></span><span>3<small>Planen</small></span></div>
              <div className="next-step__media">
                {nextItem.image ? <Image unoptimized={nextItem.image.startsWith("/api/") || nextItem.image.startsWith("blob:")} src={nextItem.image} alt="" width={92} height={128} sizes="92px" /> : <span className="media-placeholder"><FileImage aria-hidden="true" /> Ohne Bild</span>}
                <div><strong>{nextItem.title}</strong><p>{nextItem.caption || "Noch kein Beitragstext hinterlegt."}</p><small>{formatCalendarMoment(nextItem.date, nextItem.time)}</small></div>
              </div>
              <button className="button" type="button" onClick={() => onOpenItem(nextItem.id)}>Bearbeiten & fertigstellen <ArrowRight size={17} aria-hidden="true" /></button>
            </> : <div className="next-step__empty"><CheckCircle2 aria-hidden="true" /><h3>Alles fertiggestellt</h3><p>Es gibt aktuell keine Entwürfe oder offenen Freigaben.</p><button className="button" onClick={onCreate}>Neuen Beitrag erstellen <Plus size={16} /></button></div>}
          </section>
          <section className="trend-radar">
            <div className="panel-title"><h2>Trendradar</h2><TrendingUp size={18} aria-hidden="true" /></div>
            <div className="trend-radar__signal">
              <TrendingUp aria-hidden="true" />
              <div><strong>Neue Ideen für deinen nächsten Beitrag</strong><p>Entdecke Themen für deine Branche und prüfe die Quellen.</p></div>
              <button type="button" onClick={onOpenTrends}>Themen entdecken <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

const socialProviderIcons: Record<SocialProviderId, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
  youtube: Youtube,
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
          <span className="feature-kicker">Social-Media-Konten</span>
          <h2>Deine Kanäle verbinden</h2>
          <p>Du meldest dich direkt bei der Plattform an und entscheidest, welche Zugriffe du ContentDock erlaubst.</p>
        </div>
        <span className="integrations-panel__security"><ShieldCheck aria-hidden="true" /> Geschützte Verbindung</span>
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
                  {connected ? <><i /> Verbunden</> : connector.configured ? "Bereit" : "Noch nicht verfügbar"}
                </span>
              </div>
              <h3>{connector.label}</h3>
              <p>{connector.description}</p>
              {connector.connection ? (
                <div className="social-connector__account">
                  <span>{connector.connection.displayName.slice(0, 1).toLocaleUpperCase("de")}</span>
                  <div><strong>{connector.connection.displayName}</strong><small>{connector.publishingReady ? "Veröffentlichung freigegeben" : "Konto verbunden"}</small></div>
                </div>
              ) : (
                <div className="social-connector__notice">
                  {connector.configured ? <Link2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                  <span>{connector.configured ? "Melde dich direkt bei der Plattform an." : demo ? "Dieser Kanal ist noch nicht verfügbar." : "Dieser Kanal wurde für ContentDock noch nicht eingerichtet."}</span>
                </div>
              )}
              <div className="social-connector__actions">
                {connector.connection && demo ? (
                  <form action={`/api/connect/${connector.provider}/disconnect?mode=demo`} method="post">
                    <button className="secondary-button" type="submit"><Unplug size={15} aria-hidden="true" /> Verbindung trennen</button>
                  </form>
                ) : connector.connection && !connector.publishingReady ? (
                  <a className="button" href={`/api/connect/${connector.provider}/start`}>Veröffentlichung erlauben <ArrowRight size={15} aria-hidden="true" /></a>
                ) : connector.connection ? (
                  <form action={`/api/connect/${connector.provider}/disconnect`} method="post">
                    <button className="secondary-button" type="submit"><Unplug size={15} aria-hidden="true" /> Trennen</button>
                  </form>
                ) : connector.configured ? (
                  <a className="button" href={`/api/connect/${connector.provider}/start${demo ? "?mode=demo" : ""}`}>Mit {connector.label} verbinden <ArrowRight size={15} aria-hidden="true" /></a>
                ) : (
                  <span className="social-connector__disabled">Verbindung noch nicht verfügbar</span>
                )}
                <a className="social-connector__docs" href={connector.docsUrl} target="_blank" rel="noreferrer" aria-label={`${connector.label} Dokumentation öffnen`}><ExternalLink aria-hidden="true" /></a>
              </div>
            </article>
          );
        })}
      </div>

      {demo ? <p className="integrations-panel__paywall"><LockKeyhole aria-hidden="true" /> In der Demo kannst du die Oberfläche ausprobieren. Veröffentlichungen sind erst im gebuchten Arbeitsbereich mit verbundenem Konto möglich.</p> : null}

      <section className="connector-architecture">
        <div><span>1</span><strong>Verbinden</strong><small>Offizieller Login beim Anbieter</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>2</span><strong>Freigeben</strong><small>Nur benötigte Berechtigungen</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>3</span><strong>Veröffentlichen</strong><small>Fertige Videos prüfen und veröffentlichen</small></div>
      </section>

    </div>
  );
}

function LockedFeature({ feature, internalTest }: { plan: PlanId; feature: PlanFeature; internalTest: boolean }) {
  const requiredPlan = minimumPlanFor(feature);
  const featureLabel = feature === "team_approvals" ? "Teamfreigaben" : "Trendradar";
  return (
    <div className="feature-view__locked">
      <span><LockKeyhole aria-hidden="true" /></span>
      <div>
        <span className="feature-kicker">Im höheren Tarif enthalten</span>
        <h2>{featureLabel} ist ein {planCatalog[requiredPlan].label}-Feature.</h2>
        <p>{internalTest ? "Wähle ein passendes Testkonto, um die Teamfunktionen zu testen." : "Für die Zusammenarbeit mit deinem Team brauchst du einen Tarif mit Teamfreigaben."}</p>
        <Link className="button" href={internalTest ? "/login" : "/#preise"}>{internalTest ? "Testkonto wechseln" : "Tarife ansehen"} <ArrowRight size={16} aria-hidden="true" /></Link>
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
        {internalTest ? <p className="plan-overview__test"><ShieldCheck aria-hidden="true" /> Interne Abo-Simulation – keine Abbuchung und keine Rechnung.</p> : null}
      </section>
      <section className="plan-overview__matrix" aria-labelledby="plan-matrix-title">
        <div><span className="feature-kicker">Tarifvergleich</span><h2 id="plan-matrix-title">Das ist in deinem Tarif enthalten</h2></div>
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
  items,
  weekStart,
  focusDate,
  onOpenItem,
  onPreviousWeek,
  onNextWeek,
  onSelectDay,
  mediaAssets,
  onMediaUpload,
  onVideoAssetCreated,
  demo,
  connectors,
  plan,
  internalTest,
  organization,
  onOrganizationChange,
  onOrganizationDelete,
  onToast,
  onOpenOrganization,
  profile,
  currentRole,
  onBeforeInvite,
}: {
  view: Exclude<DashboardView, "Übersicht">;
  onCreate: () => void;
  items: ScheduleItem[];
  weekStart: string;
  focusDate: string;
  onOpenItem: (id: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: string) => void;
  mediaAssets: MediaAsset[];
  onMediaUpload: (files: File[]) => void;
  onVideoAssetCreated: (asset: MediaAsset) => void;
  demo: boolean;
  connectors: SocialConnectorCard[];
  plan: PlanId;
  internalTest: boolean;
  organization: Organization | null;
  onOrganizationChange: (organization: Organization) => void;
  onOrganizationDelete: () => void;
  onToast: (message: string) => void;
  onOpenOrganization: () => void;
  profile: UserProfile;
  currentRole: "Administrator" | "Manager";
  onBeforeInvite: () => Promise<void>;
}) {
  const featureCopy: Record<Exclude<DashboardView, "Übersicht">, { title: string; text: string; icon: typeof Home }> = {
    Kalender: { title: "Content-Kalender", text: "Plane Beiträge kanalübergreifend und behalte Freigaben im Blick.", icon: CalendarDays },
    Freigaben: { title: "Teamfreigaben", text: "Prüfe Inhalte gemeinsam, sammle Feedback und dokumentiere Entscheidungen.", icon: UsersRound },
    Organisation: { title: "Organisation & Benutzer", text: "Verwalte dein Team, seine Zugriffsrechte und Einladungen.", icon: Building2 },
    Mediathek: { title: "Mediathek", text: "Deine Bilder und Videos an einem Ort.", icon: FileImage },
    "KI-Studio": { title: "KI-Studio", text: "Schreibe Beitragstexte, finde Hashtags und entwickle neue Einstiege.", icon: Sparkles },
    "Video-Studio": { title: "Video-Studio", text: "Verwandle deine Idee in ein Kurzvideo mit Skript, Sprecherstimme, Stockclips und Untertiteln.", icon: Clapperboard },
    Trends: { title: "Trendradar & Zielgruppenqualität", text: "Öffentliche Hashtag-Signale und individuelle Branchenideen mit nachvollziehbarer Quelle.", icon: TrendingUp },
    Integrationen: { title: "Integrationen", text: "Verbinde deine Konten für die Veröffentlichung und sieh ihren aktuellen Status.", icon: Plug },
    Abrechnung: { title: "Abrechnung", text: "Sieh deinen aktuellen Tarif und seine enthaltenen Funktionen.", icon: CircleDollarSign },
  };
  const feature = featureCopy[view];
  const Icon = feature.icon;
  const restrictedFeature = view === "Freigaben" || view === "Organisation" ? "team_approvals" : null;
  const restricted = !demo && Boolean(restrictedFeature && !planIncludes(plan, restrictedFeature));

  return (
    <div className="feature-view">
      <header><span><Icon aria-hidden="true" /></span><div><h1>{feature.title}</h1><p>{feature.text}</p></div></header>
      {restricted && restrictedFeature ? (
        <LockedFeature plan={plan} feature={restrictedFeature} internalTest={internalTest} />
      ) : view === "Kalender" ? (
        <div className="calendar-workspace">
          <div className="calendar-workspace__toolbar">
            <div><strong>{items.length} Beiträge</strong><span>Öffne einen Beitrag, um Text und Wunschtermin zu bearbeiten. Ein Kalendereintrag veröffentlicht noch nichts.</span></div>
            <button className="button" type="button" onClick={onCreate}>Beitrag erstellen <Plus size={17} aria-hidden="true" /></button>
          </div>
          <WeekPlanner items={items} weekStart={weekStart} focusDate={focusDate} onOpenItem={onOpenItem} onPreviousWeek={onPreviousWeek} onNextWeek={onNextWeek} onSelectDay={onSelectDay} />
        </div>
      ) : view === "Mediathek" ? (
        <MediaLibrary assets={mediaAssets} onUpload={onMediaUpload} persistent={!demo} />
      ) : view === "KI-Studio" ? (
        <AiStudio mode={demo ? "demo" : "workspace"} />
      ) : view === "Video-Studio" ? (
        <VideoStudio mode={demo ? "demo" : "workspace"} onAssetCreated={onVideoAssetCreated} />
      ) : view === "Trends" ? (
        <TrendRadar mode={demo ? "demo" : "workspace"} proAccess={planIncludes(plan, "trend_radar")} />
      ) : view === "Organisation" ? (
        <OrganizationManager organization={organization} demo={demo} currentUser={profile} onChange={onOrganizationChange} onDelete={onOrganizationDelete} onToast={onToast} onBeforeInvite={onBeforeInvite} />
      ) : view === "Freigaben" ? (
        <div className="approval-workspace">
          <section className="approval-workspace__organization"><div><span className="feature-kicker">Organisation</span><h2>{organization?.name ?? "Noch keine Organisation"}</h2><p>{organization ? `${organization.members.length} Mitglieder können entsprechend ihrer Rolle zusammenarbeiten.` : "Lege zuerst eine Organisation für Teamfreigaben an."}</p></div>{currentRole === "Administrator" ? <button className="secondary-button" type="button" onClick={onOpenOrganization}><Building2 aria-hidden="true" /> Organisation verwalten</button> : <span className="approval-workspace__role"><ShieldCheck aria-hidden="true" /> Manager</span>}</section>
          <div className="approval-workspace__list">
            {items.filter((item) => item.status === "Freigabe").length ? items.filter((item) => item.status === "Freigabe").map((item) => <button type="button" onClick={() => onOpenItem(item.id)} key={item.id}>{item.image ? <Image unoptimized={item.image.startsWith("/api/") || item.image.startsWith("blob:")} src={item.image} alt="" width={74} height={74} /> : <span className="media-placeholder"><FileImage aria-hidden="true" /></span>}<span><small>{contentTypeLabel(item.channel)} · {formatCalendarMoment(item.date, item.time)}</small><strong>{item.title}</strong><em>Wartet auf Teamfreigabe</em></span><ArrowRight aria-hidden="true" /></button>) : <div className="approval-workspace__empty"><CheckCircle2 aria-hidden="true" /><h2>Keine offenen Freigaben</h2><p>Sobald ein Beitrag den Status „Freigabe“ erhält, erscheint er hier automatisch.</p></div>}
          </div>
        </div>
      ) : view === "Integrationen" ? (
        <IntegrationsView connectors={connectors} demo={demo} />
      ) : view === "Abrechnung" ? (
        <BillingView plan={plan} internalTest={internalTest} />
      ) : (
        <div className="feature-view__empty">
          <Icon aria-hidden="true" /><h2>Für den MVP vorbereitet.</h2><p>Die Oberfläche und Adaptergrenzen sind angelegt. Verbinde die Provider-Credentials, um den Live-Flow zu aktivieren.</p>
          <button className="button" onClick={onCreate}>Beitrag erstellen <Plus size={17} aria-hidden="true" /></button>
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
  initialWorkspaceData,
}: {
  mode?: "workspace" | "demo";
  connectors?: SocialConnectorCard[];
  displayName?: string;
  internalTest?: boolean;
  plan?: PlanId;
  initialView?: DashboardView;
  connectorFeedback?: ConnectorFeedback;
  initialWorkspaceData?: WorkspaceDashboardData;
}) {
  const isDemo = mode === "demo";
  const isMobile = useSyncExternalStore(subscribeMobileNavigation, () => window.matchMedia(mobileNavigationQuery).matches, () => false);
  const [activeView, setActiveView] = useState<DashboardView>(initialView);
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [items, setItems] = useState(() => isDemo ? initialScheduleItems : initialWorkspaceData?.items ?? []);
  const [mediaAssets, setMediaAssets] = useState(() => isDemo ? initialMediaAssets : initialWorkspaceData?.mediaAssets ?? []);
  const [organization, setOrganization] = useState<Organization | null>(() => isDemo ? initialOrganization : initialWorkspaceData?.organization ?? null);
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (!isDemo && initialWorkspaceData) return initialWorkspaceData.profile;
    const names = displayName.trim().split(/\s+/);
    return { firstName: isNaN(Number(names[0])) ? (names[0] || "Lea") : "Lea", lastName: names.slice(1).join(" ") || "Nordlicht", email: mode === "demo" ? "lea@nordlicht.studio" : "konto@contentdock.app", avatarUrl: "" };
  });
  const uploadedMediaUrls = useRef<string[]>([]);
  const profileMediaUrls = useRef<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const initialCalendarDate = isDemo ? calendarAnchorDate : initialWorkspaceData?.calendarAnchorDate ?? toCalendarDate(new Date());
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => getWeekStart(initialCalendarDate));
  const [calendarFocusDate, setCalendarFocusDate] = useState(() => isDemo ? addCalendarDays(initialCalendarDate, 2) : initialCalendarDate);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(() => new Set());
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState(() => connectorFeedbackMessage(connectorFeedback));
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const persistenceRevision = useRef(initialWorkspaceData?.revision ?? 0);
  const persistenceStarted = useRef(false);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const demoCookiesHydrated = useRef(false);
  const activePlan = planCatalog[plan];
  const profileName = `${profile.firstName} ${profile.lastName}`.trim();
  const profileInitial = profile.firstName.trim().slice(0, 1).toLocaleUpperCase("de") || "U";

  useModalInteraction(sidebarRef, sidebarOpen && isMobile, () => setSidebarOpen(false));

  useEffect(() => {
    const onHistoryChange = () => {
      const slug = new URL(window.location.href).searchParams.get("view") ?? "";
      setActiveView((Object.entries(viewQueries).find(([, value]) => value === slug)?.[0] as DashboardView | undefined) ?? "Übersicht");
      setQuery("");
    };
    window.addEventListener("popstate", onHistoryChange);
    return () => window.removeEventListener("popstate", onHistoryChange);
  }, []);

  function navigate(view: DashboardView) {
    setActiveView(view);
    setSidebarOpen(false);
    setQuery("");
    const url = new URL(window.location.href);
    if (viewQueries[view]) url.searchParams.set("view", viewQueries[view]);
    else url.searchParams.delete("view");
    url.searchParams.delete("connection_status");
    url.searchParams.delete("provider");
    window.history.pushState(null, "", url);
    requestAnimationFrame(() => {
      const heading = mainRef.current?.querySelector("h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  useEffect(() => () => {
    uploadedMediaUrls.current.forEach((url) => URL.revokeObjectURL(url));
    profileMediaUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!isDemo) return;
    const storedItems = readDemoCookie<ScheduleItem[]>(demoCookieNames.items);
    const storedOrganization = readDemoCookie<Organization | null>(demoCookieNames.organization);
    const storedProfile = readDemoCookie<UserProfile>(demoCookieNames.profile);
    const hydrateTimeout = window.setTimeout(() => {
      if (Array.isArray(storedItems)) setItems(storedItems);
      if (storedOrganization !== undefined) setOrganization(storedOrganization);
      if (storedProfile?.firstName && storedProfile?.email) setProfile({ ...storedProfile, avatarUrl: storedProfile.avatarUrl.startsWith("blob:") ? "" : storedProfile.avatarUrl });
      demoCookiesHydrated.current = true;
    }, 0);
    return () => window.clearTimeout(hydrateTimeout);
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo || !demoCookiesHydrated.current) return;
    writeDemoCookie(demoCookieNames.items, items.map((item) => ({ ...item, image: item.image.startsWith("blob:") ? "" : item.image })));
    writeDemoCookie(demoCookieNames.organization, organization);
    writeDemoCookie(demoCookieNames.profile, { ...profile, avatarUrl: profile.avatarUrl.startsWith("blob:") ? "" : profile.avatarUrl });
  }, [isDemo, items, organization, profile]);

  useEffect(() => {
    if (isDemo || !initialWorkspaceData) return;
    if (!persistenceStarted.current) {
      persistenceStarted.current = true;
      return;
    }

    const snapshot = { items, organization, profile };
    const timeout = window.setTimeout(() => {
      setSaveStatus("saving");
      persistenceQueue.current = persistenceQueue.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch("/api/workspace/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, revision: persistenceRevision.current }),
          });
          const result = (await response.json()) as { saved?: boolean; revision?: number; error?: string };
          if (!response.ok || !result.saved || typeof result.revision !== "number") {
            throw new Error(result.error ?? "Workspace-Daten konnten nicht gespeichert werden.");
          }
          persistenceRevision.current = result.revision;
          setSaveStatus("saved");
        })
        .catch((cause) => {
          setSaveStatus("error");
          setToast(cause instanceof Error ? cause.message : "Workspace-Daten konnten nicht gespeichert werden.");
        });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [initialWorkspaceData, isDemo, items, organization, profile]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (!normalized) return items;
    return items.filter((item) => `${item.title} ${item.channel} ${item.status}`.toLocaleLowerCase("de").includes(normalized));
  }, [items, query]);
  const selectedItem = selectedItemId ? items.find((item) => item.id === selectedItemId) : undefined;
  const currentRole = organization?.members.find((member) => member.email.toLocaleLowerCase() === profile.email.toLocaleLowerCase())?.role ?? "Administrator";
  const visibleView = currentRole === "Manager" && !managerViews.has(activeView) ? "Übersicht" : activeView;
  const visibleNavItems = currentRole === "Manager" ? navItems.filter((item) => managerViews.has(item.name)) : navItems;
  const unfinishedItems = useMemo(() => items.filter((item) => item.status !== "Geplant").toSorted((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [items]);
  const safeDraftIndex = unfinishedItems.length ? activeDraftIndex % unfinishedItems.length : 0;
  const notices = useMemo<LiveNotice[]>(() => {
    const contentNotices = items.flatMap((item): LiveNotice[] => {
      if (item.status === "Freigabe") return [{ id: `approval-${item.id}`, title: `${contentTypeLabel(item.channel)} freigeben`, detail: `${item.title} wartet auf eine Entscheidung.`, kind: "approval", itemId: item.id }];
      if (item.status === "Entwurf") return [{ id: `draft-${item.id}`, title: `${contentTypeLabel(item.channel)} fertigstellen`, detail: `${item.title} ist noch ein Entwurf.`, kind: "draft", itemId: item.id }];
      return [];
    });
    const connectorNotices = currentRole === "Administrator" ? connectors.filter((connector) => !connector.connection).map((connector): LiveNotice => ({ id: `connector-${connector.provider}`, title: `${connector.label} verbinden`, detail: connector.configured ? "Der offizielle Login ist bereit." : "Die Verbindung zu diesem Kanal ist noch nicht verfügbar.", kind: "connector" })) : [];
    return [...contentNotices, ...connectorNotices];
  }, [connectors, currentRole, items]);
  const unreadNotices = notices.filter((notice) => !seenNotificationIds.has(notice.id));

  async function addContent(content: { title: string; channel: Channel; caption: string; date: string; time: string; file?: File }) {
    let image = "";
    if (content.file) {
      if (isDemo) {
        image = URL.createObjectURL(content.file);
        uploadedMediaUrls.current.push(image);
      } else {
        const formData = new FormData();
        formData.append("files", content.file);
        const response = await fetch("/api/workspace/media", { method: "POST", body: formData });
        const result = await response.json() as { assets?: MediaAsset[]; error?: string };
        if (!response.ok || !result.assets?.[0]) throw new Error(result.error ?? "Das Beitragsbild konnte nicht hochgeladen werden. Bitte versuche es erneut.");
        image = result.assets[0].preview;
        setMediaAssets((current) => [...result.assets!, ...current]);
      }
    }
    const nextItem: ScheduleItem = {
      id: crypto.randomUUID(),
      date: content.date,
      time: content.time,
      title: content.title || "Neuer Content",
      caption: content.caption,
      channel: content.channel,
      status: "Entwurf",
      image,
    };
    setItems((current) => [...current, nextItem]);
    setCalendarWeekStart(getWeekStart(content.date));
    setCalendarFocusDate(content.date);
    setComposerOpen(false);
    setToast(`Entwurf für ${formatCalendarMoment(content.date, content.time)} angelegt. ${isDemo ? "Nur in dieser Demo." : "Die Speicherung läuft automatisch."}`);
  }

  function openCreate() {
    setComposerOpen(true);
  }

  function openItem(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (item) setCalendarFocusDate(item.date);
    setSelectedItemId(id);
  }

  function saveItem(updatedItem: ScheduleItem) {
    setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
    setCalendarWeekStart(getWeekStart(updatedItem.date));
    setCalendarFocusDate(updatedItem.date);
    setSelectedItemId(null);
    setToast(`Beitrag aktualisiert. Wunschtermin: ${formatCalendarMoment(updatedItem.date, updatedItem.time)}.`);
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItemId(null);
    setToast(isDemo ? "Beitrag aus dem Demo-Kalender entfernt." : "Beitrag entfernt. Die Änderung wird gespeichert.");
  }

  function changeWeek(amount: number) {
    setCalendarWeekStart((current) => addCalendarDays(current, amount * 7));
    setCalendarFocusDate((current) => addCalendarDays(current, amount * 7));
  }

  function selectCalendarDay(date: string) {
    setCalendarFocusDate(date);
    setCalendarWeekStart(getWeekStart(date));
  }

  function cycleDraft(direction: -1 | 1) {
    if (!unfinishedItems.length) return;
    setActiveDraftIndex((current) => (current + direction + unfinishedItems.length) % unfinishedItems.length);
  }

  function toggleNotifications() {
    if (notificationsOpen) setSeenNotificationIds((current) => new Set([...current, ...notices.map((notice) => notice.id)]));
    setNotificationsOpen((current) => !current);
  }

  function openNotice(notice: LiveNotice) {
    setSeenNotificationIds((current) => new Set([...current, notice.id]));
    setNotificationsOpen(false);
    if (notice.itemId) openItem(notice.itemId);
    else navigate("Integrationen");
  }

  function deleteOrganization() {
    uploadedMediaUrls.current.forEach((url) => URL.revokeObjectURL(url));
    uploadedMediaUrls.current = [];
    setOrganization(null);
    setItems([]);
    setMediaAssets([]);
    setSelectedItemId(null);
    setActiveDraftIndex(0);
    setToast(isDemo ? "Organisation, Mitglieder und Demo-Inhalte entfernt." : "Organisation und Inhalte entfernt. Die Änderung wird gespeichert.");
  }

  async function saveProfile(nextProfile: UserProfile, avatarFile?: File) {
    let avatarUrl = nextProfile.avatarUrl;
    if (avatarFile) {
      if (isDemo) {
        if (profile.avatarUrl.startsWith("blob:")) URL.revokeObjectURL(profile.avatarUrl);
        avatarUrl = URL.createObjectURL(avatarFile);
        profileMediaUrls.current.push(avatarUrl);
      } else {
        const formData = new FormData();
        formData.set("avatar", avatarFile);
        try {
          const response = await fetch("/api/workspace/profile/avatar", { method: "POST", body: formData });
          const result = (await response.json()) as { avatarUrl?: string; error?: string };
          if (!response.ok || !result.avatarUrl) throw new Error(result.error ?? "Das Profilbild konnte nicht gespeichert werden.");
          avatarUrl = result.avatarUrl;
        } catch (cause) {
          setToast(cause instanceof Error ? cause.message : "Das Profilbild konnte nicht gespeichert werden.");
          throw cause;
        }
      }
    }
    setOrganization((current) => current ? { ...current, members: current.members.map((member) => member.email.toLocaleLowerCase() === profile.email.toLocaleLowerCase() ? { ...member, firstName: nextProfile.firstName, lastName: nextProfile.lastName, email: nextProfile.email } : member) } : current);
    setProfile({ ...nextProfile, avatarUrl });
    setProfileOpen(false);
    setToast("Dein Profil wurde aktualisiert.");
  }

  async function uploadMedia(files: File[]) {
    const supported = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!supported.length) {
      setToast("Bitte wähle Bild- oder Videodateien aus.");
      return;
    }
    if (!isDemo) {
      const formData = new FormData();
      supported.forEach((file) => formData.append("files", file));
      try {
        const response = await fetch("/api/workspace/media", { method: "POST", body: formData });
        const result = (await response.json()) as { assets?: MediaAsset[]; error?: string };
        if (!response.ok || !result.assets) throw new Error(result.error ?? "Das Material konnte nicht gespeichert werden.");
        setMediaAssets((current) => [...result.assets!, ...current]);
        setToast(`${result.assets.length} ${result.assets.length === 1 ? "Datei wurde" : "Dateien wurden"} dauerhaft gespeichert.`);
      } catch (cause) {
        setToast(cause instanceof Error ? cause.message : "Das Material konnte nicht gespeichert werden.");
      }
      return;
    }

    const uploadDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    const uploaded = supported.map((file, index): MediaAsset => {
      const preview = URL.createObjectURL(file);
      uploadedMediaUrls.current.push(preview);
      return { id: `upload-${Date.now()}-${index}`, name: file.name.replace(/\.[^/.]+$/, ""), kind: file.type.startsWith("video/") ? "video" : "image", preview, size: file.size, uploadedAt: uploadDate, uploadedInSession: true };
    });
    setMediaAssets((current) => [...uploaded, ...current]);
    setToast(`${uploaded.length} ${uploaded.length === 1 ? "Datei wurde" : "Dateien wurden"} zur Mediathek hinzugefügt.`);
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 720px)").matches) {
      setSidebarOpen(false);
      return;
    }
    setSidebarCollapsed((current) => !current);
  }

  async function persistWorkspaceNow() {
    if (isDemo || !initialWorkspaceData) return;
    await persistenceQueue.current.catch(() => undefined);
    const response = await fetch("/api/workspace/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, organization, profile, revision: persistenceRevision.current }),
    });
    const result = (await response.json()) as { saved?: boolean; revision?: number; error?: string };
    if (!response.ok || !result.saved || typeof result.revision !== "number") {
      const message = result.error ?? "Workspace-Daten konnten nicht gespeichert werden.";
      setToast(message);
      throw new Error(message);
    }
    persistenceRevision.current = result.revision;
  }

  return (
    <div className={`dashboard-app${isDemo ? " dashboard-app--demo" : ""}${sidebarCollapsed ? " dashboard-app--collapsed" : ""}${sidebarOpen ? " dashboard-app--navigation-open" : ""}`}>
      {sidebarOpen && isMobile ? <div className="dashboard-navigation-backdrop" aria-hidden="true" onClick={() => setSidebarOpen(false)} /> : null}
      <aside ref={sidebarRef} id="dashboard-navigation" className={`dashboard-sidebar${sidebarOpen ? " is-open" : ""}`} role={sidebarOpen && isMobile ? "dialog" : undefined} aria-modal={(sidebarOpen && isMobile) || undefined} aria-label="Hauptnavigation" inert={isMobile && !sidebarOpen} tabIndex={-1}>
        <div className="dashboard-sidebar__brand"><Link href="/" aria-label="ContentDock Startseite"><BrandMark compact /></Link><button className="dashboard-sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Menü schließen"><X /></button></div>
        <nav aria-label="Workspace-Navigation">
          {visibleNavItems.map(({ name, icon: Icon, feature }) => {
            const locked = !isDemo && Boolean(feature && !planIncludes(plan, feature));
            return (
              <button className={`${visibleView === name ? "is-active" : ""}${locked ? " is-locked" : ""}`} onClick={() => navigate(name)} aria-current={visibleView === name ? "page" : undefined} aria-label={`${name}${locked ? " – im höheren Tarif verfügbar" : ""}`} title={name} key={name}>
                <Icon aria-hidden="true" /><span>{name}</span>{locked ? <LockKeyhole className="dashboard-sidebar__lock" aria-label="In diesem Tarif gesperrt" /> : null}
              </button>
            );
          })}
        </nav>
        <button className="dashboard-sidebar__collapse" type="button" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "Seitenmenü erweitern" : "Seitenmenü reduzieren"}><ChevronRight aria-hidden="true" /><span>{sidebarCollapsed ? "Menü erweitern" : "Menü reduzieren"}</span></button>
      </aside>

      <section className="dashboard-shell" inert={sidebarOpen && isMobile}>
        {isDemo ? (
          <div className="demo-banner">
            <span><LockKeyhole aria-hidden="true" /> Demo mit Beispieldaten · keine Veröffentlichung</span>
            <Link href="/#preise">Abo auswählen <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        ) : null}
        <header className="dashboard-topbar">
          <button className="dashboard-topbar__menu" onClick={() => { setSidebarCollapsed(false); setSidebarOpen(true); }} aria-label="Menü öffnen" aria-expanded={sidebarOpen} aria-controls="dashboard-navigation"><Menu /></button>
          <button className="workspace-switcher" type="button" onClick={() => { if (currentRole === "Administrator") navigate("Organisation"); }} disabled={currentRole !== "Administrator"} aria-label={currentRole === "Administrator" ? "Organisation verwalten" : "Aktive Organisation"}><LayoutGrid aria-hidden="true" /><span>{organization?.name ?? "Organisation anlegen"}</span><em>{currentRole}</em><ChevronRight aria-hidden="true" /></button>
          <label className="dashboard-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Beiträge nach Titel, Kanal oder Status suchen" aria-label="Beiträge durchsuchen" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Suche löschen"><X /></button> : null}</label>
          <div className="dashboard-profile">
            <ThemeToggle />
            <button type="button" onClick={toggleNotifications} aria-expanded={notificationsOpen} aria-label="Benachrichtigungen"><Bell aria-hidden="true" />{unreadNotices.length ? <i /> : null}</button>
            <button className="dashboard-profile__identity" type="button" onClick={() => setProfileOpen(true)} aria-label="Eigenes Profil bearbeiten">
              <span>{profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" fill unoptimized={profile.avatarUrl.startsWith("blob:") || profile.avatarUrl.startsWith("/api/")} sizes="36px" /> : profileInitial}</span>
              <div><strong>{profileName}</strong><small>{isDemo ? "Demo-Profil" : `${activePlan.label}${internalTest ? " · Testkonto" : ""}`}</small></div>
            </button>
            {!isDemo ? <form action={logout}><button type="submit" aria-label="Abmelden" title="Abmelden"><LogOut aria-hidden="true" /></button></form> : null}
          </div>
          {notificationsOpen ? <DashboardDialog labelledBy="notifications-title" onClose={toggleNotifications}><section className="notification-menu"><header><div><strong id="notifications-title">Mitteilungen</strong><span>{unreadNotices.length ? `${unreadNotices.length} offen` : "Aktuell"}</span></div><button type="button" onClick={toggleNotifications} aria-label="Mitteilungen schließen"><X /></button></header>{unreadNotices.length ? <div>{unreadNotices.map((notice) => <button type="button" onClick={() => openNotice(notice)} key={notice.id}><span className={`notification-menu__icon notification-menu__icon--${notice.kind}`}>{notice.kind === "connector" ? <Plug aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}</span><span><strong>{notice.title}</strong><small>{notice.detail}</small></span><ChevronRight aria-hidden="true" /></button>)}</div> : <div className="notification-menu__empty"><CheckCircle2 aria-hidden="true" /><strong>Alles erledigt</strong><span>Es gibt keine neuen Mitteilungen.</span></div>}</section></DashboardDialog> : null}
        </header>
        <main ref={mainRef} id="main-content" className="dashboard-content dashboard-main-content" tabIndex={-1}>
          {!isDemo ? <div className="dashboard-save-status" data-state={saveStatus} role="status">{saveStatus === "saving" ? "Änderungen werden gespeichert …" : saveStatus === "error" ? "Änderungen konnten nicht gespeichert werden. Bitte lasse diese Seite geöffnet." : "Alle Änderungen gespeichert"}{saveStatus === "error" ? <button type="button" onClick={() => { setSaveStatus("saving"); void persistWorkspaceNow().then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error")); }}>Speichern erneut versuchen</button> : null}</div> : null}
          {query.trim() ? <section className="dashboard-search-results" aria-labelledby="search-results-title"><header><h1 id="search-results-title">Suchergebnisse</h1><p role="status">{filteredItems.length} {filteredItems.length === 1 ? "Beitrag" : "Beiträge"} für „{query}“</p><button className="secondary-button" type="button" onClick={() => setQuery("")}>Zurück zu {visibleView}</button></header>{filteredItems.length ? <div>{filteredItems.map((item) => <button key={item.id} type="button" onClick={() => openItem(item.id)}><span><strong>{item.title}</strong><small>{item.channel} · {formatCalendarMoment(item.date, item.time)}</small></span><span className={`status status--${item.status.toLowerCase()}`}>{item.status}</span><ChevronRight aria-hidden="true" /></button>)}</div> : <p>Kein Beitrag gefunden. Suche nach einem anderen Titel, Kanal oder Status.</p>}</section> : visibleView === "Übersicht" ? (
            <Overview
              items={filteredItems}
              onCreate={openCreate}
              demo={isDemo}
              displayName={profile.firstName}
              weekStart={calendarWeekStart}
              focusDate={calendarFocusDate}
              onOpenItem={openItem}
              onPreviousWeek={() => changeWeek(-1)}
              onNextWeek={() => changeWeek(1)}
              onSelectDay={selectCalendarDay}
              onOpenTrends={() => navigate("Trends")}
              onOpenIntegrations={() => { if (currentRole === "Administrator") navigate("Integrationen"); }}
              onOpenVideoStudio={() => navigate("Video-Studio")}
              connectors={connectors}
              notices={notices}
              unfinishedItems={unfinishedItems}
              activeDraftIndex={safeDraftIndex}
              onCycleDraft={cycleDraft}
            />
          ) : (
            <FeatureView
              view={visibleView}
              onCreate={openCreate}
              items={filteredItems}
              weekStart={calendarWeekStart}
              focusDate={calendarFocusDate}
              onOpenItem={openItem}
              onPreviousWeek={() => changeWeek(-1)}
              onNextWeek={() => changeWeek(1)}
              onSelectDay={selectCalendarDay}
              mediaAssets={mediaAssets}
              onMediaUpload={uploadMedia}
              onVideoAssetCreated={(asset) => setMediaAssets((current) => current.some((entry) => entry.id === asset.id) ? current : [asset, ...current])}
              demo={isDemo}
              connectors={connectors}
              plan={plan}
              internalTest={internalTest}
              organization={organization}
              onOrganizationChange={setOrganization}
              onOrganizationDelete={deleteOrganization}
              onToast={setToast}
              onOpenOrganization={() => navigate("Organisation")}
              profile={profile}
              currentRole={currentRole}
              onBeforeInvite={persistWorkspaceNow}
            />
          )}
        </main>
      </section>
      {composerOpen ? <ContentComposer mode={mode} onClose={() => setComposerOpen(false)} onCreate={addContent} /> : null}
      {selectedItem ? <ScheduleItemDialog key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItemId(null)} onSave={saveItem} onDelete={deleteItem} /> : null}
      {profileOpen ? <ProfileDialog profile={profile} onClose={() => setProfileOpen(false)} onSave={saveProfile} /> : null}
      {toast ? <div className="app-toast" role="status"><span>{toast}</span><button className="app-toast__dismiss" type="button" onClick={() => setToast("")} aria-label="Meldung schließen"><X aria-hidden="true" /></button></div> : null}
    </div>
  );
}
