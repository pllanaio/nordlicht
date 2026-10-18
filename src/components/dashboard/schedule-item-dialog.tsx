"use client";

import Image from "next/image";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useState } from "react";
import { CalendarDays, Check, Clock3, FileImage, Trash2, X } from "lucide-react";
import type { Channel, ScheduleItem, ScheduleStatus } from "@/lib/data";

const channels: Channel[] = ["Instagram", "TikTok", "LinkedIn", "YouTube"];
const statuses: ScheduleStatus[] = ["Entwurf", "Freigabe", "Geplant"];

function formatLongDate(date: string) {
  if (!date || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) return "Datum auswählen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function ScheduleItemDialog({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ScheduleItem;
  onClose: () => void;
  onSave: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [channel, setChannel] = useState<Channel>(item.channel);
  const [status, setStatus] = useState<ScheduleStatus>(item.status);
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = Boolean(title.trim() && date && time);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    onSave({
      ...item,
      title: title.trim(),
      caption: caption.trim(),
      channel,
      status,
      date,
      time,
    });
  }

  return (
    <DashboardDialog labelledBy="post-dialog-title" onClose={onClose}>
      <form className="post-dialog" onSubmit={save}>
        <header className="post-dialog__header">
          <div>
            <span>Beitragsdetails</span>
            <h2 id="post-dialog-title">Beitrag bearbeiten</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Dialog schließen"><X /></button>
        </header>

        <div className="post-dialog__body">
          <aside className="post-dialog__preview">
            {item.image ? <Image unoptimized={item.image.startsWith("/api/") || item.image.startsWith("blob:")} src={item.image} alt={`Beitragsbild für ${item.title}`} width={260} height={300} sizes="260px" /> : <span className="media-placeholder"><FileImage aria-hidden="true" /> Kein Bild hinzugefügt</span>}
            <div>
              <span><CalendarDays aria-hidden="true" /> {formatLongDate(date)}</span>
              <span><Clock3 aria-hidden="true" /> {time} Uhr</span>
            </div>
          </aside>

          <div className="post-dialog__fields">
            <p>Alle Angaben außer dem Beitragstext sind Pflichtfelder.</p>
            <label className="composer-field">Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} /></label>
            <label className="composer-field">Beitragstext (optional)<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={5} /></label>
            <div className="post-dialog__field-grid">
              <label className="composer-field">Kanal<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>{channels.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="composer-field">Status<select value={status} onChange={(event) => setStatus(event.target.value as ScheduleStatus)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="composer-field">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="composer-field">Uhrzeit<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            </div>
            <p className="composer-plan__notice">„Geplant“ hält deinen Wunschtermin fest. Der Kalender veröffentlicht keine Beiträge automatisch.</p>
          </div>
        </div>

        <footer className="post-dialog__footer">
          <div>
            {confirmDelete ? (
              <><span>Beitrag wirklich löschen?</span><button className="post-dialog__confirm-delete" type="button" onClick={() => onDelete(item.id)}>Ja, löschen</button><button className="post-dialog__cancel-delete" type="button" onClick={() => setConfirmDelete(false)}>Abbrechen</button></>
            ) : (
              <button className="post-dialog__delete" type="button" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" /> Beitrag löschen</button>
            )}
          </div>
          <div><button className="secondary-button" type="button" onClick={onClose}>Schließen</button><button className="button" type="submit" disabled={!valid}>Änderungen speichern <Check size={17} aria-hidden="true" /></button></div>
        </footer>
      </form>
    </DashboardDialog>
  );
}
