"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Eye, FileVideo, ImageIcon, Search, Upload, X } from "lucide-react";
import type { MediaAsset } from "@/lib/workspace-types";

export type { MediaAsset } from "@/lib/workspace-types";

export const initialMediaAssets: MediaAsset[] = [
  { id: "media-alpine", name: "Alpine Campaign", kind: "image", preview: "/media/alpine-lake.webp", size: 2_840_000, uploadedAt: "24.08.2026" },
  { id: "media-creator", name: "Creator Studio", kind: "image", preview: "/media/creator-studio.webp", size: 4_120_000, uploadedAt: "25.08.2026" },
  { id: "media-design", name: "Design Session", kind: "image", preview: "/media/design-studio.webp", size: 3_480_000, uploadedAt: "25.08.2026" },
  { id: "media-team", name: "Team Update", kind: "image", preview: "/media/team-studio.webp", size: 5_060_000, uploadedAt: "26.08.2026" },
];

function formatBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function AssetPreview({ asset, fill = false }: { asset: MediaAsset; fill?: boolean }) {
  if (asset.kind === "video") {
    return <video src={asset.preview} muted playsInline controls={!fill} aria-label={`Videovorschau ${asset.name}`} />;
  }
  return fill
    ? <Image src={asset.preview} alt={asset.name} fill unoptimized={asset.preview.startsWith("blob:")} sizes="(max-width: 720px) 50vw, 260px" />
    : <Image src={asset.preview} alt={asset.name} width={620} height={420} unoptimized={asset.preview.startsWith("blob:")} sizes="(max-width: 720px) 90vw, 620px" />;
}

export function MediaLibrary({ assets, onUpload, persistent = false }: { assets: MediaAsset[]; onUpload: (files: File[]) => void; persistent?: boolean }) {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? assets.find((asset) => asset.id === selectedId) : undefined;
  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    return assets.filter((asset) => (filter === "all" || asset.kind === filter) && (!normalized || asset.name.toLocaleLowerCase("de").includes(normalized)));
  }, [assets, filter, query]);

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onUpload(files);
    event.target.value = "";
  }

  return (
    <div className="media-library">
      <div className="media-library__toolbar">
        <div className="media-library__filters" aria-label="Medientyp filtern">
          {(["all", "image", "video"] as const).map((option) => (
            <button className={filter === option ? "is-active" : ""} type="button" onClick={() => setFilter(option)} key={option}>{option === "all" ? "Alle" : option === "image" ? "Bilder" : "Videos"}</button>
          ))}
        </div>
        <label className="media-library__search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Material durchsuchen" aria-label="Mediathek durchsuchen" /></label>
        <label className="button media-library__upload"><Upload aria-hidden="true" /> Material hochladen<input type="file" accept="image/*,video/*" multiple onChange={selectFiles} /></label>
      </div>

      <div className="media-library__summary"><span><strong>{visibleAssets.length}</strong> Dateien sichtbar</span><span>{persistent ? "Workspace-Speicher · Uploads werden dauerhaft gespeichert" : "Demo-Speicher · Uploads bleiben bis zum Neuladen erhalten"}</span></div>

      {visibleAssets.length ? (
        <div className="media-library__grid">
          {visibleAssets.map((asset) => (
            <button className="media-asset" type="button" onClick={() => setSelectedId(asset.id)} key={asset.id}>
              <span className="media-asset__preview"><AssetPreview asset={asset} fill /><i>{asset.kind === "video" ? <FileVideo aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}</i></span>
              <span className="media-asset__meta"><strong>{asset.name}</strong><small>{asset.uploadedAt} · {formatBytes(asset.size)}</small></span>
              <Eye className="media-asset__open" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="media-library__empty"><ImageIcon aria-hidden="true" /><strong>Kein Material gefunden</strong><span>Passe den Filter an oder lade neues Material hoch.</span></div>
      )}

      {selected ? (
        <div className="composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <section className="media-detail" role="dialog" aria-modal="true" aria-labelledby="media-detail-title">
            <header><div><span>Medienvorschau</span><h2 id="media-detail-title">{selected.name}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Vorschau schließen"><X /></button></header>
            <div className="media-detail__preview"><AssetPreview asset={selected} /></div>
            <footer><span>{selected.kind === "video" ? "Video" : "Bild"} · {formatBytes(selected.size)} · hochgeladen am {selected.uploadedAt}</span><button className="secondary-button" type="button" onClick={() => setSelectedId(null)}>Schließen</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
