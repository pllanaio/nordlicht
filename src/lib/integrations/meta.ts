import type { PublishRequest, PublishResult, SocialPublisher } from "./contracts";
import { connectorCatalog } from "./catalog";

type MetaContainerResponse = { id?: string; error?: { message?: string } };

export class InstagramPublisher implements SocialPublisher {
  readonly connector = connectorCatalog.find((item) => item.id === "meta")!;

  constructor(
    private readonly instagramAccountId: string,
    private readonly graphVersion = process.env.META_GRAPH_VERSION ?? "v23.0",
    private readonly graphHost = process.env.META_GRAPH_HOST ?? "graph.instagram.com",
  ) {}

  async publish(request: PublishRequest): Promise<PublishResult> {
    // Scheduling belongs to the ContentDock job queue. At publishAt, this adapter
    // creates and publishes the container after a final capability check.
    const createUrl = new URL(`https://${this.graphHost}/${this.graphVersion}/${this.instagramAccountId}/media`);
    createUrl.searchParams.set("caption", request.caption);
    if (request.mediaType === "video") {
      createUrl.searchParams.set("media_type", "REELS");
      createUrl.searchParams.set("video_url", request.mediaUrl);
    } else {
      createUrl.searchParams.set("image_url", request.mediaUrl);
    }

    const containerResponse = await fetch(createUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${request.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    const container = (await containerResponse.json()) as MetaContainerResponse;
    if (!containerResponse.ok || !container.id) throw new Error(container.error?.message ?? "Meta container creation failed");

    const publishUrl = new URL(`https://${this.graphHost}/${this.graphVersion}/${this.instagramAccountId}/media_publish`);
    publishUrl.searchParams.set("creation_id", container.id);
    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${request.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    const published = (await publishResponse.json()) as MetaContainerResponse;
    if (!publishResponse.ok || !published.id) throw new Error(published.error?.message ?? "Meta publish failed");
    return { provider: "instagram", externalId: published.id, status: "published" };
  }
}
