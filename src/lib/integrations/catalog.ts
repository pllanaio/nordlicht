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
  {
    id: "mollie",
    label: "Mollie",
    state: "configuration_required",
    capabilities: ["billing"],
    note: "First Payment erzeugt das Mandat; danach wird das monatliche Abo angelegt.",
    docsUrl: "https://docs.mollie.com/docs/recurring-payments",
  },
  {
    id: "odoo",
    label: "Odoo",
    state: "configuration_required",
    capabilities: ["crm_sync"],
    note: "Odoo 19 JSON-2 mit minimal berechtigtem Bot-Nutzer und API-Key.",
    docsUrl: "https://www.odoo.com/documentation/19.0/developer/reference/external_api.html",
  },
  {
    id: "capcut",
    label: "CapCut",
    state: "handoff_only",
    capabilities: ["template_handoff"],
    note: "Kein verlässlich dokumentierter öffentlicher Template-API-Vertrag; zunächst kuratierte Empfehlungen und Deep-Link-Übergabe.",
    docsUrl: "https://www.capcut.com/templates",
  },
  {
    id: "photoai",
    label: "PhotoAI",
    state: "handoff_only",
    capabilities: ["template_handoff"],
    note: "Consumer-Workflow ohne öffentlich dokumentierte Entwickler-API; Partnerzugang vor Automatisierung klären.",
    docsUrl: "https://photoai.com/",
  },
];
