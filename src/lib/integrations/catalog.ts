import type { ConnectorDefinition } from "./contracts";

export const connectorCatalog: ConnectorDefinition[] = [
  {
    id: "meta",
    label: "Meta / Instagram",
    state: "review_required",
    capabilities: ["oauth", "publish_photo", "publish_video", "schedule", "analytics"],
    note: "Veröffentlichung für autorisierte professionelle Instagram-Konten nach App-Review.",
    docsUrl: "https://developers.facebook.com/products/instagram/apis/",
  },
  {
    id: "tiktok",
    label: "TikTok",
    state: "review_required",
    capabilities: ["oauth", "publish_video", "publish_photo", "publish_draft"],
    note: "Unauditierte Direct-Post-Clients veröffentlichen nur privat; video.publish benötigt Freigabe.",
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },
];
