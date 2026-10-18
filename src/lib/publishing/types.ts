export type PublicationProvider = "instagram" | "tiktok" | "youtube";
export type Publication = {
  id: string; provider: PublicationProvider;
  status: "queued" | "processing" | "published" | "uploaded" | "failed" | "unknown";
  externalId: string | null; errorMessage: string | null; createdAt: string; updatedAt: string;
};
export type TikTokCreator = {
  creatorNickname: string; creatorAvatarUrl: string; privacyLevelOptions: string[];
  maxVideoPostDurationSec: number; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean;
};
export type PublicationInput = {
  provider: PublicationProvider; caption: string; title?: string; privacy?: string; selfDeclaredMadeForKids?: boolean; consent: true;
  tiktok?: { disableComment: boolean; disableDuet: boolean; disableStitch: boolean; brandContentToggle: boolean; brandOrganicToggle: boolean; musicUsageConfirmed: true };
};
export type PublicationOptions = {
  available: boolean; reason?: string; channels: {
    provider: PublicationProvider; displayName: string; connected: boolean; ready: boolean; reason?: string; tiktok?: TikTokCreator;
  }[]; publications: Publication[];
};
