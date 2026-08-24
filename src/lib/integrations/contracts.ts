export type ConnectorState = "ready" | "configuration_required" | "review_required" | "handoff_only";

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
