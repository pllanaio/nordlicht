"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarDays, Check, Clock3, Trash2, X } from "lucide-react";
import type { Channel, ScheduleItem, ScheduleStatus } from "@/lib/data";

const channels: Channel[] = ["Instagram", "TikTok", "LinkedIn", "YouTube"];
const statuses: ScheduleStatus[] = ["Entwurf", "Freigabe", "Geplant"];

function formatLongDate(date: string) {
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
    <div className="composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="post-dialog" role="dialog" aria-modal="true" aria-labelledby="post-dialog-title" onSubmit={save}>
        <header className="post-dialog__header">
          <div>
            <span>Post-Details</span>
            <h2 id="post-dialog-title">Beitrag bearbeiten</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Dialog schließen"><X /></button>
        </header>

        <div className="post-dialog__body">
          <aside className="post-dialog__preview">
            <Image src={item.image} alt={`Vorschau für ${item.title}`} width={260} height={300} sizes="260px" />
            <div>
              <span><CalendarDays aria-hidden="true" /> {formatLongDate(date)}</span>
              <span><Clock3 aria-hidden="true" /> {time} Uhr</span>
            </div>
          </aside>

          <div className="post-dialog__fields">
            <label className="composer-field">Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label className="composer-field">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={5} /></label>
            <div className="post-dialog__field-grid">
              <label className="composer-field">Kanal<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>{channels.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="composer-field">Status<select value={status} onChange={(event) => setStatus(event.target.value as ScheduleStatus)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="composer-field">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="composer-field">Uhrzeit<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            </div>
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
    </div>
  );
}
