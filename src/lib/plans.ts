export const planIds = ["starter", "studio", "pro"] as const;

export type PlanId = (typeof planIds)[number];

export type PlanFeature =
  | "caption_generation"
  | "scheduled_posts"
  | "team_approvals"
  | "trend_radar"
  | "algorithm_signals";

export const planCatalog: Record<
  PlanId,
  {
    label: string;
    price: string;
    summary: string;
    features: readonly string[];
  }
> = {
  starter: {
    label: "Starter",
    price: "39 €",
    summary: "Für einzelne Marken und einen verlässlichen Content-Rhythmus.",
    features: ["1 Marke", "30 Posts pro Monat", "KI-Texte mit eigenem API-Key"],
  },
  studio: {
    label: "Studio",
    price: "89 €",
    summary: "Für Teams mit mehreren Marken, Planung und Freigaben.",
    features: ["3 Marken", "Unbegrenzte Planung", "Teamfreigaben"],
  },
  pro: {
    label: "Pro",
    price: "179 €",
    summary: "Für datenbasierte Optimierung und mehrere Marken.",
    features: ["10 Marken", "Trend- und Viralanalyse", "Algorithmus-Signale", "Priorisierter Support"],
  },
};

const minimumPlanByFeature: Record<PlanFeature, PlanId> = {
  caption_generation: "starter",
  scheduled_posts: "starter",
  team_approvals: "studio",
  trend_radar: "pro",
  algorithm_signals: "pro",
};

const planRank: Record<PlanId, number> = { starter: 0, studio: 1, pro: 2 };

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && planIds.includes(value as PlanId);
}

export function planIncludes(plan: PlanId, feature: PlanFeature) {
  return planRank[plan] >= planRank[minimumPlanByFeature[feature]];
}

export function minimumPlanFor(feature: PlanFeature) {
  return minimumPlanByFeature[feature];
}
