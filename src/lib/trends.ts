export type TrendPlatform = {
  id: "tiktok" | "instagram" | "linkedin";
  name: string;
  sourceLabel: string;
  sourceUrl: string;
  note: string;
  hashtags: Array<{ tag: string; signal: string; fit: string }>;
};

export const trendPlatforms: TrendPlatform[] = [
  {
    id: "tiktok",
    name: "TikTok",
    sourceLabel: "TikTok Creative Center",
    sourceUrl: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
    note: "TikTok stellt eine öffentliche, regionsabhängige Hashtag-Rangliste bereit.",
    hashtags: [
      { tag: "#behindthescenes", signal: "Hohe Format-Passung", fit: "Authentische Einblicke" },
      { tag: "#dayinthelife", signal: "Stabiles Story-Format", fit: "Creator & Teams" },
      { tag: "#smallbusiness", signal: "Breites Themenfeld", fit: "KMU & lokale Marken" },
      { tag: "#learnontiktok", signal: "Wissensformat", fit: "Tipps & Tutorials" },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    sourceLabel: "Meta Reels Guidance",
    sourceUrl: "https://www.facebook.com/business/ads/facebook-instagram-reels-ads",
    note: "Meta veröffentlicht Format-Guidance, aber keine universelle öffentliche Hashtag-Rangliste. Die Demo zeigt daher Themen-Signale statt erfundener Rankings.",
    hashtags: [
      { tag: "#reels", signal: "Format-Signal", fit: "Kurzvideo" },
      { tag: "#contentcreator", signal: "Creator-Kontext", fit: "Produktion & Workflow" },
      { tag: "#brandstory", signal: "Nischen-Signal", fit: "Markenaufbau" },
      { tag: "#behindthescenes", signal: "Story-Signal", fit: "Nähe & Vertrauen" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    sourceLabel: "LinkedIn Help",
    sourceUrl: "https://www.linkedin.com/help/linkedin/answer/a549442",
    note: "LinkedIn nutzt Hashtags als Themen- und Suchkontext. Es gibt keine belastbare öffentliche globale Top-Liste.",
    hashtags: [
      { tag: "#leadership", signal: "Themen-Signal", fit: "Führung & Kultur" },
      { tag: "#personalbranding", signal: "Creator-Signal", fit: "Expertenpositionierung" },
      { tag: "#innovation", signal: "Breites Themenfeld", fit: "Technologie & Wandel" },
      { tag: "#contentstrategy", signal: "Nischen-Signal", fit: "Marketing & Kommunikation" },
    ],
  },
];
