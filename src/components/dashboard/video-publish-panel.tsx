"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Instagram, LoaderCircle, Music2, RefreshCw, Send, Youtube } from "lucide-react";
import type { Publication, PublicationOptions, PublicationProvider as Provider } from "@/lib/publishing/types";
import styles from "./video-publish-panel.module.css";

type PublishState = PublicationOptions & { error?: string };

const providerNames: Record<Provider, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const providerIcons = { instagram: Instagram, tiktok: Music2, youtube: Youtube };
const statusLabels: Record<Publication["status"], string> = {
  queued: "In der Warteschlange",
  processing: "Wird übertragen / verarbeitet",
  published: "Veröffentlicht",
  uploaded: "Hochgeladen",
  failed: "Fehlgeschlagen",
  unknown: "Status unklar",
};
const tiktokPrivacyLabels: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Alle",
  MUTUAL_FOLLOW_FRIENDS: "Freund:innen (gegenseitig folgen)",
  FOLLOWER_OF_CREATOR: "Follower:innen",
  SELF_ONLY: "Nur ich",
};

async function parseResponse<T extends { error?: string }>(response: Response) {
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data) throw new Error(typeof data?.error === "string" ? data.error : "Die Veröffentlichungsanfrage konnte nicht abgeschlossen werden.");
  return data;
}

function creatorAvatarUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function VideoPublishPanel({ jobId, defaultTitle }: { jobId: string; defaultTitle: string }) {
  const [state, setState] = useState<PublishState | null>(null);
  const [provider, setProvider] = useState<Provider | "">("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState(defaultTitle.slice(0, 100));
  const [privacy, setPrivacy] = useState("");
  const [madeForKids, setMadeForKids] = useState<"" | "yes" | "no">("");
  const [allowComments, setAllowComments] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [brandContent, setBrandContent] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [musicConsent, setMusicConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const listController = useRef<AbortController | null>(null);
  const submitController = useRef<AbortController | null>(null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const channel = state?.channels.find((entry) => entry.provider === provider);
  const tiktok = channel?.tiktok;
  const avatar = creatorAvatarUrl(tiktok?.creatorAvatarUrl);
  const existingPublication = state?.publications.find((entry) => entry.provider === provider && entry.status !== "failed");
  const hasPrivacy = provider === "youtube" ? ["private", "unlisted", "public"].includes(privacy) : provider === "tiktok" ? Boolean(tiktok?.privacyLevelOptions.includes(privacy)) : true;
  const invalidBrandPrivacy = provider === "tiktok" && brandContent && privacy === "SELF_ONLY";
  const ready = Boolean(!loadError && state?.available && channel?.ready && channel.connected && provider && hasPrivacy && consent && !existingPublication && !invalidBrandPrivacy && (provider !== "youtube" || (title.trim() && madeForKids)) && (provider !== "tiktok" || (tiktok && musicConsent)));
  const captionLimit = provider === "youtube" ? 5000 : 2200;
  const publishHint = loadError ? "Lade die Kanäle erneut, bevor du den Auftrag sendest."
    : !hasPrivacy ? "Wähle zuerst, wer dein Video sehen darf."
    : provider === "youtube" && !title.trim() ? "Ergänze einen Titel für YouTube."
    : provider === "youtube" && !madeForKids ? "Gib an, ob dein Video speziell für Kinder erstellt wurde."
    : invalidBrandPrivacy ? "Ändere die Sichtbarkeit für deine bezahlte Partnerschaft."
    : provider === "tiktok" && !musicConsent ? "Bestätige die TikTok-Bedingungen für Inhalte und Audios."
    : !consent ? "Bestätige abschließend, dass du das Video geprüft hast."
    : "Bereit zum Senden. Die Plattform bestätigt den endgültigen Status nach der Verarbeitung.";

  useEffect(() => {
    const controller = new AbortController();
    listController.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let hasOptions = false;

    async function load() {
      let pollAgain = false;
      try {
        const response = await fetch(`/api/video/jobs/${encodeURIComponent(jobId)}/publish${hasOptions ? "?status=1" : ""}`, { signal: controller.signal, cache: "no-store" });
        const result = await parseResponse<{ publications: Publication[]; error?: string } & Partial<PublicationOptions>>(response);
        if (controller.signal.aborted) return;
        if (hasOptions) setState((current) => current ? { ...current, publications: result.publications } : current);
        else { setState(result as PublishState); hasOptions = true; }
        setLoadError("");
        failures = 0;
        pollAgain = result.publications.some((entry) => entry.status === "queued" || entry.status === "processing");
      } catch (cause) {
        if (controller.signal.aborted) return;
        failures += 1;
        setLoadError(cause instanceof Error ? cause.message : "Veröffentlichungen konnten nicht geladen werden.");
        pollAgain = failures < 4;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (pollAgain) timer = setTimeout(load, failures ? 6000 : 3000);
        }
      }
    }

    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, refreshKey]);

  useEffect(() => () => submitController.current?.abort(), []);

  function selectProvider(nextProvider: Provider) {
    if (nextProvider === provider) return;
    setProvider(nextProvider);
    setPrivacy("");
    setMadeForKids("");
    setAllowComments(false);
    setAllowDuet(false);
    setAllowStitch(false);
    setBrandContent(false);
    setBrandOrganic(false);
    setMusicConsent(false);
    setConsent(false);
    setError("");
    setNotice("");
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider || !ready || submitting) return;
    const payload = JSON.stringify({
      provider,
      caption: caption.trim(),
      consent: true,
      ...(provider === "youtube" ? { title: title.trim(), privacy, selfDeclaredMadeForKids: madeForKids === "yes" } : {}),
      ...(provider === "tiktok" ? {
        privacy,
        tiktok: {
          disableComment: Boolean(tiktok?.commentDisabled || !allowComments),
          disableDuet: Boolean(tiktok?.duetDisabled || !allowDuet),
          disableStitch: Boolean(tiktok?.stitchDisabled || !allowStitch),
          brandContentToggle: brandContent,
          brandOrganicToggle: brandOrganic,
          musicUsageConfirmed: true,
        },
      } : {}),
    });
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    const controller = new AbortController();
    submitController.current = controller;
    listController.current?.abort();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/video/jobs/${encodeURIComponent(jobId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: payload,
        signal: controller.signal,
      });
      const data = await parseResponse<{ publication: Publication; error?: string }>(response);
      if (controller.signal.aborted) return;
      setState((current) => current ? { ...current, publications: [data.publication, ...current.publications.filter((entry) => entry.id !== data.publication.id)] } : current);
      setConsent(false);
      setNotice(`Dein Auftrag für ${providerNames[provider]} wurde angenommen. Den tatsächlichen Plattformstatus siehst du unten.`);
      attempt.current = null;
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Die Veröffentlichung konnte nicht gestartet werden.");
    } finally {
      if (!controller.signal.aborted) {
        setSubmitting(false);
        setRefreshKey((current) => current + 1);
      }
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`publish-title-${jobId}`}>
      <header className={styles.header}><div><h4 id={`publish-title-${jobId}`}><Send aria-hidden="true" size={17} /> Direkt veröffentlichen</h4><p>Wähle einen Kanal. Veröffentlicht wird erst nach deiner Bestätigung.</p></div><button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={submitting} aria-label="Veröffentlichungsstatus und Kanäle aktualisieren"><RefreshCw aria-hidden="true" size={16} /></button></header>
      {loading ? <p className={styles.hint} role="status"><LoaderCircle className={styles.spin} aria-hidden="true" size={15} /> Kanäle werden geladen …</p> : null}
      {loadError ? <p className={styles.error} role="alert">{loadError} Aktualisiere den Status, bevor du erneut sendest.</p> : null}
      {state && !state.available ? <p className={styles.hint}>{state.reason || "Die direkte Veröffentlichung ist für diesen Workspace noch nicht eingerichtet."}</p> : null}
      {state ? <>
        <div className={styles.channels} role="group" aria-label="Zielkanal wählen">{state.channels.map((entry) => { const Icon = providerIcons[entry.provider]; return <button key={entry.provider} type="button" aria-pressed={provider === entry.provider} onClick={() => selectProvider(entry.provider)} disabled={submitting} className={provider === entry.provider ? styles.selected : undefined}><Icon aria-hidden="true" size={19} /><strong>{providerNames[entry.provider]}</strong><small>{entry.connected ? entry.ready ? "Verbunden" : "Einrichtung prüfen" : "Nicht verbunden"}</small></button>; })}</div>
        {channel ? <div className={styles.account}><div className={styles.accountIdentity}>{avatar ? <Image src={avatar} alt="" width={28} height={28} unoptimized /> : null}<strong>{channel.connected ? `Konto: ${channel.tiktok?.creatorNickname || channel.displayName}` : `${providerNames[channel.provider]} verbinden`}</strong></div>{channel.reason ? <p>{channel.reason}</p> : null}{!channel.connected || !channel.ready ? <Link href="/dashboard?view=integrations">Verbindungen verwalten</Link> : null}</div> : <p className={styles.hint}>Wähle zuerst Instagram, TikTok oder YouTube.</p>}
        {existingPublication ? <p className={styles.hint}>Für diesen Kanal liegt bereits ein Auftrag vor: {statusLabels[existingPublication.status]}. Prüfe den Status unten und auf der Plattform, bevor du weitere Schritte unternimmst.</p> : null}
        {channel?.connected && channel.ready && !existingPublication ? <form onSubmit={publish} aria-label="Veröffentlichung vorbereiten" aria-describedby={error ? `publish-error-${jobId}` : undefined}>
          <fieldset className={styles.fields} disabled={submitting || !state.available}>
            {provider === "youtube" ? <label className={styles.field}>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label> : null}
            <label className={styles.field}>{provider === "youtube" ? "Beschreibung" : "Beitragstext"}<textarea aria-describedby={`publish-caption-hint-${jobId}`} value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={captionLimit} rows={4} placeholder="Beschreibe dein Video und ergänze passende Hashtags." /><small id={`publish-caption-hint-${jobId}`}>{caption.length}/{captionLimit} Zeichen · optional</small></label>
            {provider === "youtube" ? <><label className={styles.field}>Sichtbarkeit<select value={privacy} onChange={(event) => setPrivacy(event.target.value)} required><option value="" disabled>Bitte wählen</option><option value="private">Privat · nur freigegebene Personen</option><option value="unlisted">Nicht gelistet · alle mit Link</option><option value="public">Öffentlich · für alle sichtbar</option></select></label><label className={styles.field}>Ist dieses Video speziell für Kinder erstellt?<select value={madeForKids} onChange={(event) => setMadeForKids(event.target.value as "yes" | "no")} required><option value="" disabled>Bitte wählen</option><option value="yes">Ja, für Kinder erstellt</option><option value="no">Nein, nicht speziell für Kinder erstellt</option></select><small>Diese Angabe wird an YouTube übermittelt.</small></label></> : null}
            {provider === "tiktok" && tiktok ? <>
              <p className={styles.hint}>TikTok erlaubt für dieses Konto Videos bis {tiktok.maxVideoPostDurationSec} Sekunden.</p>
              <label className={styles.field}>Wer darf dieses Video sehen?<select aria-invalid={invalidBrandPrivacy || undefined} aria-describedby={invalidBrandPrivacy ? `publish-privacy-error-${jobId}` : undefined} value={privacy} onChange={(event) => setPrivacy(event.target.value)} required><option value="" disabled>Bitte wählen</option>{tiktok.privacyLevelOptions.filter((option) => Boolean(tiktokPrivacyLabels[option])).map((option) => <option value={option} key={option} disabled={brandContent && option === "SELF_ONLY"}>{tiktokPrivacyLabels[option] || option}</option>)}</select></label>
              <details className={styles.interactionDetails}><summary>Interaktionen erlauben <span>{[allowComments, allowDuet, allowStitch].filter(Boolean).length} ausgewählt</span></summary><div className={styles.interactions}><label className={styles.check}><input type="checkbox" checked={allowComments && !tiktok.commentDisabled} onChange={(event) => setAllowComments(event.target.checked)} disabled={tiktok.commentDisabled} /><span>Kommentare erlauben{tiktok.commentDisabled ? " (im Konto deaktiviert)" : ""}</span></label><label className={styles.check}><input type="checkbox" checked={allowDuet && !tiktok.duetDisabled} onChange={(event) => setAllowDuet(event.target.checked)} disabled={tiktok.duetDisabled} /><span>Duett erlauben{tiktok.duetDisabled ? " (im Konto deaktiviert)" : ""}</span></label><label className={styles.check}><input type="checkbox" checked={allowStitch && !tiktok.stitchDisabled} onChange={(event) => setAllowStitch(event.target.checked)} disabled={tiktok.stitchDisabled} /><span>Stitch erlauben{tiktok.stitchDisabled ? " (im Konto deaktiviert)" : ""}</span></label></div></details>
              <div className={styles.commercial}><strong>Kommerzielle Inhalte kennzeichnen</strong><label className={styles.check}><input type="checkbox" checked={brandOrganic} onChange={(event) => setBrandOrganic(event.target.checked)} /><span>Werbung für meine eigene Marke</span></label><label className={styles.check}><input type="checkbox" checked={brandContent} onChange={(event) => setBrandContent(event.target.checked)} /><span>Bezahlte Partnerschaft / Werbung für eine andere Marke</span></label><p>Aktiviere alle zutreffenden Angaben. TikTok kennzeichnet den Beitrag entsprechend.</p></div>
              {invalidBrandPrivacy ? <p className={styles.error} id={`publish-privacy-error-${jobId}`} role="alert">Eine bezahlte Partnerschaft kann nicht mit „Nur ich“ veröffentlicht werden. Wähle eine andere Sichtbarkeit.</p> : null}
              <label className={styles.check}><input type="checkbox" checked={musicConsent} onChange={(event) => setMusicConsent(event.target.checked)} required /><span>Ich bestätige, dass die verwendeten Inhalte und Audios die <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer">TikTok Music Usage Confirmation</a>{brandContent ? <> und die <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer">Branded Content Policy</a></> : null} erfüllen.</span></label>
            </> : null}
            <label className={styles.check}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>Ich habe das Video geprüft und möchte es mit diesen Angaben an {provider ? providerNames[provider] : "den Kanal"} senden.{provider === "instagram" ? " Es wird als Reel veröffentlicht." : ""}</span></label>
          </fieldset>
          {error ? <p className={styles.error} id={`publish-error-${jobId}`} role="alert"><CircleAlert aria-hidden="true" size={15} /> {error}</p> : null}
          <button type="submit" aria-describedby={`publish-submit-hint-${jobId}`} className={`button ${styles.publishButton}`} disabled={!ready || submitting || caption.length > captionLimit}>{submitting ? <LoaderCircle className={styles.spin} aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}{submitting ? "Auftrag wird gesendet …" : provider === "youtube" && privacy !== "public" ? "An YouTube übertragen" : `Auf ${provider ? providerNames[provider] : "Kanal"} veröffentlichen`}</button><p className={styles.submitHint} id={`publish-submit-hint-${jobId}`}>{publishHint}</p>
        </form> : null}
        {notice ? <p className={styles.success} role="status"><CheckCircle2 aria-hidden="true" size={16} /> {notice}</p> : null}
        {state.publications.length ? <div className={styles.publications} aria-live="polite" aria-relevant="text additions"><h5>Veröffentlichungsaufträge</h5><ul>{state.publications.map((publication) => <li key={publication.id}><div><strong>{providerNames[publication.provider]}</strong><span data-status={publication.status}>{statusLabels[publication.status]}</span></div>{publication.errorMessage ? <p>{publication.errorMessage}</p> : null}{publication.status === "uploaded" ? <p>Das Video wurde hochgeladen. Prüfe Verarbeitung und Sichtbarkeit direkt auf der Plattform.</p> : publication.status === "unknown" ? <p>Die Plattform hat noch kein eindeutiges Ergebnis bestätigt. Prüfe dein Konto; erneutes Senden könnte einen doppelten Beitrag erzeugen.</p> : publication.status === "failed" ? <p>Es wird kein neuer Versuch automatisch gestartet. Prüfe zuerst, ob der Beitrag auf der Plattform vorhanden ist.</p> : null}</li>)}</ul></div> : null}
      </> : null}
    </section>
  );
}
