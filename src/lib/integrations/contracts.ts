export type ConnectorState = "ready" | "configuration_required" | "review_required" | "handoff_only";

export type SocialProviderId = "instagram" | "linkedin" | "tiktok";

export type SocialConnectionSummary = {
  provider: SocialProviderId;
  accountId: string;
  displayName: string;
  profileImageUrl?: string;
  scopes: string[];
  connectedAt: string;
  tokenExpiresAt?: string;
};

export type SocialConnectorCard = {
  provider: SocialProviderId;
  label: string;
  description: string;
  docsUrl: string;
  configured: boolean;
  publishingReady: boolean;
  connection?: SocialConnectionSummary;
};

export type ConnectorCapability =
  | "oauth"
  | "publish_photo"
  | "publish_video"
  | "publish_draft"
  | "schedule"
  | "analytics"
  | "billing"
  | "crm_sync"
  | "template_handoff";

export type ConnectorDefinition = {
  id: string;
  label: string;
  state: ConnectorState;
  capabilities: ConnectorCapability[];
  note: string;
  docsUrl: string;
};

export type PublishRequest = {
  accessToken: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  caption: string;
  publishAt?: string;
};

export type PublishResult = {
  provider: string;
  externalId: string;
  status: "processing" | "published" | "draft";
};

export interface SocialPublisher {
  readonly connector: ConnectorDefinition;
  publish(request: PublishRequest): Promise<PublishResult>;
}
