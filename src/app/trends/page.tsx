import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { TrendRadar } from "@/components/trend-radar";

export const metadata: Metadata = { title: "Öffentlicher Trendradar", description: "Öffentlich einsehbare Hashtag- und Themen-Signale für TikTok, Instagram und LinkedIn." };

export default function TrendsPage() {
  return (
    <main className="public-trends-page">
      <header><Link href="/" aria-label="ContentDock Startseite"><BrandMark /></Link><Link href="/"><ArrowLeft aria-hidden="true" /> Zur Startseite</Link></header>
      <section className="public-trends-page__hero"><span>ContentDock Trendradar</span><h1>Öffentliche Signale.<br />Keine Algorithmus-Mythen.</h1><p>Hashtag- und Themen-Inspiration mit nachvollziehbarer Quelle – frei zugänglich, auch ohne ContentDock-Abo.</p></section>
      <TrendRadar mode="public" />
    </main>
  );
}
