import type { MediaAsset } from "@/lib/workspace-types";

export type VideoInput = {
  topic: string;
  script?: string;
  language: "de" | "en";
  voice: "alloy" | "nova" | "onyx" | "shimmer";
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: 30 | 60 | 90;
  subtitles: boolean;
};

export type VideoSource = { id: string; url: string; author: string; authorUrl?: string };
export type VideoJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "canceled";
  stage: "queued" | "script" | "voice" | "stock" | "subtitles" | "render" | "complete";
  progress: number;
  input: VideoInput;
  script: string | null;
  sources: VideoSource[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  mediaAsset: MediaAsset | null;
  subtitleUrl: string | null;
};
