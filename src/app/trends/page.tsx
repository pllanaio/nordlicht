import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { TrendRadar } from "@/components/trend-radar";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Trendradar", description: "Themen und Hashtag-Beispiele für TikTok, Instagram und LinkedIn – mit Links zu den Plattformquellen." };

export default function TrendsPage() {
  return (
    <main className="public-trends-page" id="main-content" tabIndex={-1}>
      <header><Link href="/" aria-label="ContentDock Startseite"><BrandMark /></Link><div className="auth-page__utility"><Link href="/"><ArrowLeft aria-hidden="true" /> Zur Startseite</Link><ThemeToggle /></div></header>
      <section className="public-trends-page__hero"><span>ContentDock Trendradar</span><h1>Ein Ausgangspunkt für deine nächste Idee.</h1><p>Entdecke Themen und Hashtag-Beispiele für deine Kanäle. Die Quellen helfen dir, Formate und Kontext selbst einzuordnen.</p></section>
      <TrendRadar mode="public" />
    </main>
  );
}
