"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, CircleAlert, Clapperboard, Download, ExternalLink, FileText, Film, KeyRound, LoaderCircle, Mic2, RefreshCw, ShieldCheck, Sparkles, Subtitles, X } from "lucide-react";
import type { VideoJob } from "@/lib/video/types";
import type { MediaAsset } from "@/lib/workspace-types";
import { VideoPublishPanel } from "@/components/dashboard/video-publish-panel";
import styles from "./video-studio.module.css";

type VideoInput = VideoJob["input"];
type JobListResponse = { jobs: VideoJob[]; available: boolean; reason?: string; error?: string };
type JobResponse = { job: VideoJob; error?: string };

const stages = [
  { id: "script", label: "Skript", icon: FileText },
  { id: "voice", label: "Stimme", icon: Mic2 },
  { id: "stock", label: "Stockclips", icon: Film },
  { id: "subtitles", label: "Untertitel", icon: Subtitles },
  { id: "render", label: "Kurzvideo", icon: Clapperboard },
] as const;

const statusLabels: Record<VideoJob["status"], string> = {
  queued: "In der Warteschlange",
  processing: "Wird erstellt",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
  canceled: "Abgebrochen",
};

function isActive(job: VideoJob) {
  return job.status === "queued" || job.status === "processing";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeAssetUrl(value: string | null | undefined) {
  return value?.startsWith("/api/") && !value.includes("\\") ? value : undefined;
}

function downloadUrl(value: string) {
  return `${value}${value.includes("?") ? "&" : "?"}download=1`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

async function readResponse<T extends { error?: string }>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data) {
    throw new Error(typeof data?.error === "string" ? data.error : "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
  }
  return data;
}

export function VideoStudio({ mode, onAssetCreated }: { mode: "workspace" | "demo"; onAssetCreated: (asset: MediaAsset) => void }) {
  const isDemo = mode === "demo";
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [topicTouched, setTopicTouched] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [language, setLanguage] = useState<VideoInput["language"]>("de");
  const [voice, setVoice] = useState<VideoInput["voice"]>("nova");
  const [aspectRatio, setAspectRatio] = useState<VideoInput["aspectRatio"]>("9:16");
  const [durationSeconds, setDurationSeconds] = useState<VideoInput["durationSeconds"]>(30);
  const [subtitles, setSubtitles] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [credentialConsent, setCredentialConsent] = useState(false);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const completedJobs = useRef(new Set<string>());
  const mutationController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const requestAttempt = useRef<{ payload: string; key: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const hasActiveJob = jobs.some(isActive);
  const topicInvalid = topicTouched && topic.trim().length < 3;
  const keyInvalid = keyTouched && (!apiKey.trim() || /\s/.test(apiKey.trim()));
  const creationHint = hasActiveJob ? "Ein Video wird bereits erstellt. Danach kannst du den nächsten Auftrag starten."
    : !availability?.available ? availability?.reason || "Die Verfügbarkeit der Videoerstellung wird geprüft."
    : topic.trim().length < 3 ? "Ergänze zuerst dein Thema mit mindestens drei Zeichen."
    : !apiKey.trim() || /\s/.test(apiKey.trim()) ? "Trage deinen OpenAI API-Key ohne Leerzeichen ein."
    : !credentialConsent ? "Bestätige die vorübergehende Speicherung und Abrechnung über dein OpenAI-Konto."
    : "Alles bereit. Mit deinem Klick startet die kostenpflichtige Erstellung.";

  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    listController.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    async function loadJobs() {
      let pollAgain = false;
      try {
        const response = await fetch("/api/video/jobs", { signal: controller.signal, cache: "no-store" });
        const data = await readResponse<JobListResponse>(response);
        if (controller.signal.aborted) return;
        setJobs(data.jobs);
        setAvailability({ available: data.available, reason: data.reason });
        setListError("");
        failures = 0;
        pollAgain = data.jobs.some(isActive);
      } catch (cause) {
        if (controller.signal.aborted) return;
        failures += 1;
        setListError(cause instanceof Error ? cause.message : "Aufträge konnten nicht geladen werden.");
        pollAgain = failures < 4;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (pollAgain) timer = setTimeout(loadJobs, failures ? 6000 : 3000);
        }
      }
    }

    void loadJobs();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [isDemo, refreshKey]);

  useEffect(() => {
    for (const job of jobs) {
      if (job.status === "completed" && job.mediaAsset && !completedJobs.current.has(job.id)) {
        completedJobs.current.add(job.id);
        onAssetCreated(job.mediaAsset);
      }
    }
  }, [jobs, onAssetCreated]);

  useEffect(() => () => mutationController.current?.abort(), []);

  async function createVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDemo || submitting || cancelingId || hasActiveJob || !availability?.available) return;
    if (!credentialConsent || !apiKey.trim() || topic.trim().length < 3) {
      setFormError("Gib ein Thema und deinen API-Key ein und bestätige die vorübergehende Speicherung.");
      return;
    }
    const payload = JSON.stringify({ topic: topic.trim(), ...(script.trim() ? { script: script.trim() } : {}), language, voice, aspectRatio, durationSeconds, subtitles, credentialConsent: true });
    if (requestAttempt.current?.payload !== payload) requestAttempt.current = { payload, key: crypto.randomUUID() };
    const controller = new AbortController();
    mutationController.current = controller;
    listController.current?.abort();
    setSubmitting(true);
    setFormError("");
    setFormNotice("");
    setActionError("");
    try {
      const response = await fetch("/api/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-key": apiKey.trim(), "Idempotency-Key": requestAttempt.current.key },
        body: payload,
        signal: controller.signal,
      });
      const data = await readResponse<JobResponse>(response);
      if (controller.signal.aborted) return;
      setJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      setSelectedJobId(data.job.id);
      setApiKey("");
      setKeyTouched(false);
      setCredentialConsent(false);
      requestAttempt.current = null;
      setFormNotice("Dein Auftrag wurde angenommen. Du kannst diesen Bereich verlassen und das Ergebnis später öffnen.");
    } catch (cause) {
      if (!controller.signal.aborted) setFormError(cause instanceof Error ? cause.message : "Der Videoauftrag konnte nicht angelegt werden.");
    } finally {
      if (!controller.signal.aborted) {
        setSubmitting(false);
        setRefreshKey((current) => current + 1);
      }
    }
  }

  async function cancelJob(job: VideoJob) {
    if (isDemo || cancelingId || submitting) return;
    const controller = new AbortController();
    mutationController.current = controller;
    listController.current?.abort();
    setCancelingId(job.id);
    setActionError("");
    try {
      const response = await fetch(`/api/video/jobs/${encodeURIComponent(job.id)}`, { method: "DELETE", signal: controller.signal });
      const data = await readResponse<JobResponse>(response);
      if (!controller.signal.aborted) setJobs((current) => current.map((entry) => entry.id === data.job.id ? data.job : entry));
    } catch (cause) {
      if (!controller.signal.aborted) setActionError(cause instanceof Error ? cause.message : "Der Auftrag konnte nicht abgebrochen werden.");
    } finally {
      if (!controller.signal.aborted) {
        setCancelingId(null);
        setRefreshKey((current) => current + 1);
      }
    }
  }

  function loadJobTemplate(job: VideoJob) {
    setTopic(job.input.topic);
    setScript(job.script ?? job.input.script ?? "");
    setScriptExpanded(Boolean(job.script || job.input.script));
    setLanguage(job.input.language);
    setVoice(job.input.voice);
    setAspectRatio(job.input.aspectRatio);
    setDurationSeconds(job.input.durationSeconds);
    setSubtitles(job.input.subtitles);
    setCredentialConsent(false);
    requestAttempt.current = null;
    setFormError("");
    setFormNotice("Die Angaben wurden übernommen. Prüfe dein Skript und starte bei Bedarf bewusst einen neuen, kostenpflichtigen Auftrag.");
    formRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    formRef.current?.querySelector<HTMLTextAreaElement>("#video-topic")?.focus({ preventScroll: true });
  }

  return (
    <div className={styles.studio}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}><Clapperboard aria-hidden="true" size={16} /> Von der Idee zum Kurzvideo</span>
        <p>Beschreibe deine Idee. Prüfe dein fertiges Video und entscheide anschließend, wo du es veröffentlichen möchtest.</p>
        <ol className={styles.workflow} aria-label="Ablauf der Videoerstellung">
          {stages.map(({ id, label, icon: Icon }, index) => <li key={id}><span><Icon aria-hidden="true" size={16} />{label}</span>{index < stages.length - 1 ? <ArrowRight aria-hidden="true" size={14} /> : null}</li>)}
        </ol>
      </div>

      {isDemo ? <div className={styles.notice}><Sparkles aria-hidden="true" /><div><strong>Demo · Video-Studio entdecken</strong><p>Probiere die Einstellungen aus. Diese Demo startet keine Generierung und zeigt keine simulierten Videoergebnisse. Melde dich an, um echte Videos mit deinem eigenen API-Key zu erstellen.</p></div><Link className="secondary-button" href="/login">Anmelden <ArrowRight aria-hidden="true" size={16} /></Link></div> : null}
      {!isDemo && availability && !availability.available ? <div className={styles.notice}><CircleAlert aria-hidden="true" /><div><strong>Videoerstellung noch nicht verfügbar</strong><p>{availability.reason || "Das Video-Studio wird für deinen Workspace eingerichtet. Bereits erstellte Videos bleiben verfügbar."}</p></div></div> : null}

      <div className={styles.workspace}>
        <form className={styles.form} onSubmit={createVideo} ref={formRef} aria-labelledby="video-form-title" aria-describedby={formError ? "video-form-error" : undefined}>
          <header className={styles.sectionHeader}><span className={styles.stepNumber}>01</span><div><h2 id="video-form-title">Deine Videoidee</h2><p>Thema beschreiben, Format wählen und Erstellung starten.</p></div></header>
          <fieldset className={styles.fields} disabled={submitting}>
            <label className={styles.field} htmlFor="video-topic">Thema <span>Pflichtfeld</span><textarea id="video-topic" aria-describedby={topicInvalid ? "video-topic-hint video-topic-error" : "video-topic-hint"} aria-invalid={topicInvalid || undefined} onBlur={() => setTopicTouched(true)} value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} minLength={3} maxLength={1000} required placeholder="Zum Beispiel: Drei einfache Tipps für nachhaltigeres Reisen" /><small id="video-topic-hint">Beschreibe Thema, Zielgruppe und gewünschte Botschaft.</small>{topicInvalid ? <small className={styles.fieldError} id="video-topic-error">Bitte beschreibe dein Thema mit mindestens drei Zeichen.</small> : null}</label>
            <details className={styles.scriptDisclosure} open={scriptExpanded} onToggle={(event) => setScriptExpanded(event.currentTarget.open)}><summary><FileText aria-hidden="true" size={16} /> Eigenes Skript verwenden <span>Optional</span></summary><label className={styles.field} htmlFor="video-script">Sprechertext<textarea id="video-script" value={script} onChange={(event) => setScript(event.target.value)} rows={6} maxLength={4000} placeholder="Lass dieses Feld leer, um das Skript automatisch erstellen zu lassen." /><small>Nur der gesprochene Text, maximal 4000 Zeichen. Richtwert: etwa 60–75 Wörter für 30 Sekunden. Ein zu langer Text kann die gewünschte Videolänge überschreiten.</small></label></details>
            <div className={styles.optionGroup}><h3>Format und Stimme</h3><p>Hochformat eignet sich für Reels, TikTok und Shorts.</p><div className={styles.options}>
              <label className={styles.field} htmlFor="video-language">Sprache<select id="video-language" value={language} onChange={(event) => setLanguage(event.target.value as VideoInput["language"])}><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>
              <label className={styles.field} htmlFor="video-voice">Sprecherstimme<select id="video-voice" value={voice} onChange={(event) => setVoice(event.target.value as VideoInput["voice"])}><option value="nova">Nova</option><option value="alloy">Alloy</option><option value="onyx">Onyx</option><option value="shimmer">Shimmer</option></select></label>
              <label className={styles.field} htmlFor="video-format">Format<select id="video-format" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as VideoInput["aspectRatio"])}><option value="9:16">9:16 · Hochformat</option><option value="16:9">16:9 · Querformat</option><option value="1:1">1:1 · Quadratisch</option></select></label>
              <label className={styles.field} htmlFor="video-duration">Zieldauer (ca.)<select id="video-duration" value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value) as VideoInput["durationSeconds"])}><option value={30}>30 Sekunden</option><option value={60}>60 Sekunden</option><option value={90}>90 Sekunden</option></select></label>
            </div></div>
            <label className={styles.checkField}><input type="checkbox" checked={subtitles} onChange={(event) => setSubtitles(event.target.checked)} /><span><strong>Untertitel einblenden</strong><small>Direkt im Video und zusätzlich als SRT-Datei.</small></span><Subtitles aria-hidden="true" size={20} /></label>
            {!isDemo ? <div className={styles.credentials}><label className={styles.field} htmlFor="video-api-key"><span className={styles.keyLabel}><KeyRound aria-hidden="true" size={15} /> Dein OpenAI API-Key</span><input id="video-api-key" onBlur={() => setKeyTouched(true)} aria-invalid={keyInvalid || undefined} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={1024} required placeholder="sk-…" aria-describedby={keyInvalid ? "video-key-description video-key-error" : "video-key-description"} />{keyInvalid ? <small className={styles.fieldError} id="video-key-error">Bitte gib deinen API-Key ohne Leerzeichen ein.</small> : null}</label><p id="video-key-description">Der Auftrag läuft im Hintergrund. Dafür wird dein Schlüssel bis zu einer Stunde verschlüsselt gespeichert und bei Abschluss, Fehler, Abbruch oder Ablauf gelöscht. Im Browser wird er nicht dauerhaft gespeichert.</p><label className={styles.consent}><input type="checkbox" checked={credentialConsent} onChange={(event) => setCredentialConsent(event.target.checked)} required /><span>Ich stimme der vorübergehenden verschlüsselten Speicherung für diesen Auftrag zu. Die KI-Nutzung wird über mein OpenAI-Konto abgerechnet.</span></label></div> : null}
          </fieldset>
          {formError ? <p className={styles.error} id="video-form-error" role="alert"><CircleAlert aria-hidden="true" size={17} />{formError}</p> : null}
          {formNotice ? <p className={styles.success} role="status"><CheckCircle2 aria-hidden="true" size={17} />{formNotice}</p> : null}
          {formNotice && hasActiveJob ? <button className={styles.progressLink} type="button" onClick={() => { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: "auto", block: "start" }); }}>Fortschritt ansehen <ArrowRight aria-hidden="true" size={16} /></button> : null}
          {isDemo ? <Link className={`button ${styles.submit}`} href="/login">Anmelden und Video erstellen <ArrowRight aria-hidden="true" size={17} /></Link> : <><button className={`button ${styles.submit}`} type="submit" aria-describedby="video-submit-hint video-cost-hint" disabled={submitting || Boolean(cancelingId) || hasActiveJob || !availability?.available || topic.trim().length < 3 || !apiKey.trim() || /\s/.test(apiKey.trim()) || !credentialConsent}>{submitting ? <LoaderCircle aria-hidden="true" className={styles.spin} size={18} /> : <Clapperboard aria-hidden="true" size={18} />}{submitting ? "Auftrag wird angelegt …" : "Video kostenpflichtig erstellen"}</button><p className={styles.submitHint} id="video-submit-hint">{creationHint}</p><p className={styles.smallPrint} id="video-cost-hint">Die OpenAI-Kosten hängen von Skript und Videolänge ab. Ein neuer Auftrag startet erst mit deinem Klick.</p></>}
          <p className={styles.provenance}><ShieldCheck aria-hidden="true" size={15} /> KI-generierte Stimme von OpenAI · Stockvideos von Pexels</p>
        </form>

        <section className={styles.result} ref={resultRef} tabIndex={-1} aria-labelledby="video-result-title" aria-busy={loading}>
          <header className={styles.sectionHeader}><span className={styles.stepNumber}>02</span><div><h2 id="video-result-title">Dein Video</h2><p>{selectedJob ? "Fortschritt, Vorschau und Export." : "Hier wird aus deiner Idee ein Clip."}</p></div>{!isDemo ? <button className={styles.iconButton} type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={submitting || Boolean(cancelingId)} aria-label="Videoaufträge aktualisieren"><RefreshCw aria-hidden="true" size={17} /></button> : null}</header>
          {listError ? <p className={styles.error} role="alert"><CircleAlert aria-hidden="true" size={17} />{listError} Die letzte bekannte Ansicht bleibt erhalten. Du kannst die Aufträge aktualisieren.</p> : null}
          {actionError ? <p className={styles.error} role="alert"><CircleAlert aria-hidden="true" size={17} />{actionError}</p> : null}
          {selectedJob ? <JobDetail job={selectedJob} canceling={cancelingId === selectedJob.id} onCancel={() => void cancelJob(selectedJob)} onUseTemplate={() => loadJobTemplate(selectedJob)} /> : <div className={styles.empty}><div className={styles.emptyFrame} aria-hidden="true"><Clapperboard aria-hidden="true" size={34} /><span>Deine nächste Geschichte</span><i /><i /><i /></div><h3>{loading ? "Aufträge werden geladen …" : "Bereit für deine Idee"}</h3><p>{isDemo ? "Im Workspace erhältst du hier ein echtes MP4-Video mit Sprecherstimme und passenden Clips. Dein Ergebnis landet automatisch in der Mediathek." : "Starte mit deiner Videoidee den ersten Auftrag. Du kannst den Fortschritt hier verfolgen und das fertige Video direkt herunterladen."}</p>{loading ? <LoaderCircle aria-label="Lädt" className={styles.spin} size={20} /> : null}</div>}
        </section>
      </div>

      {!isDemo && jobs.length > 0 ? <section className={styles.history} aria-labelledby="video-history-title"><header><h2 id="video-history-title">Letzte Videoaufträge</h2><span>{jobs.length} {jobs.length === 1 ? "Auftrag" : "Aufträge"}</span></header><ul>{jobs.map((job) => <li key={job.id}><button type="button" className={selectedJob?.id === job.id ? styles.selectedJob : undefined} aria-pressed={selectedJob?.id === job.id} onClick={() => { setSelectedJobId(job.id); setActionError(""); resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: "auto", block: "start" }); }}><span className={styles.jobIcon}>{isActive(job) ? <LoaderCircle aria-hidden="true" className={styles.spin} size={19} /> : job.status === "completed" ? <CheckCircle2 aria-hidden="true" size={19} /> : <Film aria-hidden="true" size={19} />}</span><span className={styles.jobName}><strong>{job.input.topic}</strong><small>{formatDate(job.createdAt)} · {job.input.aspectRatio} · {job.input.durationSeconds} Sek.</small></span><span className={styles.jobStatus} data-status={job.status}>{statusLabels[job.status]}</span><ArrowRight aria-hidden="true" size={16} /></button></li>)}</ul></section> : null}
    </div>
  );
}

function JobDetail({ job, canceling, onCancel, onUseTemplate }: { job: VideoJob; canceling: boolean; onCancel: () => void; onUseTemplate: () => void }) {
  const active = isActive(job);
  const stageIndex = stages.findIndex((stage) => stage.id === job.stage);
  const progress = Math.min(100, Math.max(0, job.progress));
  const previewUrl = safeAssetUrl(job.mediaAsset?.preview);
  const subtitleUrl = safeAssetUrl(job.subtitleUrl);

  return (
    <div className={styles.jobDetail}>
      <div className={styles.jobHeading}><h3>{job.input.topic}</h3><span className={styles.jobStatus} data-status={job.status}>{statusLabels[job.status]}</span></div>
      {active ? <div className={styles.progressBlock}><div className={styles.progressLabel} role="status"><span>{job.status === "queued" ? "Dein Auftrag wartet auf den Start." : `${stages.find((stage) => stage.id === job.stage)?.label ?? "Video"} wird erstellt …`}</span><strong>{progress} %</strong></div><div className={styles.progressTrack} role="progressbar" aria-label="Fortschritt der Videoerstellung" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><ol className={styles.progressSteps}>{stages.map(({ id, label, icon: Icon }, index) => <li key={id} aria-current={index === stageIndex ? "step" : undefined} data-state={index < stageIndex ? "done" : index === stageIndex ? "active" : "pending"}>{index < stageIndex ? <Check aria-hidden="true" size={16} /> : <Icon aria-hidden="true" size={16} />}<span>{label}{id === "subtitles" && !job.input.subtitles ? " · aus" : ""}</span></li>)}</ol><p className={styles.submitHint}>Die Erstellung kann einige Minuten dauern. Dein Auftrag läuft auch weiter, wenn du diesen Bereich verlässt.</p><button className="secondary-button" type="button" onClick={onCancel} disabled={canceling}>{canceling ? <LoaderCircle className={styles.spin} aria-hidden="true" size={16} /> : <X aria-hidden="true" size={16} />}{canceling ? "Wird abgebrochen …" : "Auftrag abbrechen"}</button><p className={styles.smallPrint}>Bereits angefallene OpenAI-Kosten werden durch einen Abbruch nicht rückgängig gemacht.</p></div> : null}
      {job.status === "failed" || job.status === "canceled" ? <div className={styles.failure}><CircleAlert aria-hidden="true" size={24} /><h4>{job.status === "failed" ? "Das Video konnte nicht fertiggestellt werden" : "Der Auftrag wurde abgebrochen"}</h4><p>{job.errorMessage || (job.status === "failed" ? "Bitte prüfe die Einstellungen und starte bei Bedarf einen neuen Auftrag." : "Du kannst deine Angaben für einen neuen Auftrag übernehmen.")}</p><p>Es wird kein neuer Auftrag automatisch gestartet.</p></div> : null}
      {job.status === "completed" && previewUrl ? <div className={styles.completed}><div className={styles.player}><video key={job.id} src={previewUrl} controls playsInline preload="metadata" aria-label={`Fertiges Video: ${job.input.topic}`} /></div><p className={styles.saved}><CheckCircle2 aria-hidden="true" size={16} /> In deiner Mediathek gespeichert</p><div className={styles.downloads}><a className="button" href={downloadUrl(previewUrl)} download><Download aria-hidden="true" size={16} /> MP4 herunterladen</a>{subtitleUrl ? <a className="secondary-button" href={subtitleUrl} download><Subtitles aria-hidden="true" size={16} /> Untertitel · SRT</a> : null}</div><p className={styles.smallPrint}>Die Sprecherstimme ist KI-generiert. Prüfe Inhalt, Aussprache, Bildauswahl und Nutzungsrechte vor der Veröffentlichung.</p></div> : null}
      {job.status === "completed" && previewUrl ? <VideoPublishPanel key={job.id} jobId={job.id} defaultTitle={job.input.topic} /> : null}
      {job.script ? <details className={styles.generatedScript}><summary><FileText aria-hidden="true" size={16} /> Verwendetes Skript</summary><p>{job.script}</p></details> : null}
      {job.sources.length ? <details className={styles.sources}><summary><Film aria-hidden="true" size={16} /> Stockvideo-Quellen · Pexels ({job.sources.length})</summary><ul>{job.sources.map((source, index) => { const href = safeExternalUrl(source.url); return <li key={`${source.id}-${index}`}><span>Clip {index + 1} · {source.author}</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer">Quelle ansehen <ExternalLink aria-hidden="true" size={13} /></a> : null}</li>; })}</ul><a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer" className={styles.licenseLink}>Pexels-Nutzungsbedingungen <ExternalLink aria-hidden="true" size={13} /></a></details> : null}
      {!active ? <button className={`secondary-button ${styles.templateButton}`} type="button" onClick={onUseTemplate}><RefreshCw aria-hidden="true" size={16} /> Angaben und Skript übernehmen</button> : null}
    </div>
  );
}
