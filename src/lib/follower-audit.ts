export type AudienceSignal = {
  code: "no_recent_activity" | "burst_following" | "engagement_mismatch" | "very_new_account";
  weight: number;
  explanation: string;
};

export type AudienceReviewItem = {
  providerUserId: string;
  score: number;
  signals: AudienceSignal[];
  recommendation: "keep" | "manual_review";
};

export function classifyAudienceProfile(providerUserId: string, signals: AudienceSignal[]): AudienceReviewItem {
  const score = Math.min(100, signals.reduce((total, signal) => total + signal.weight, 0));
  return {
    providerUserId,
    score,
    signals,
    recommendation: score >= 60 ? "manual_review" : "keep",
  };
}

// Deliberately excluded: names, language, nationality, geography, profile photos,
// ethnicity proxies, or fully automatic removal. Review stays explainable and manual.
