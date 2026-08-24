import type { PublishRequest, PublishResult, SocialPublisher } from "./contracts";
import { connectorCatalog } from "./catalog";

export class TikTokPublisher implements SocialPublisher {
  readonly connector = connectorCatalog.find((item) => item.id === "tiktok")!;

  async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.mediaType !== "video") throw new Error("This MVP adapter initializes TikTok video posts only.");
    const creatorResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
      method: "POST",
      headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    });
    if (!creatorResponse.ok) throw new Error("TikTok creator info query failed");

    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        post_info: { title: request.caption, privacy_level: "SELF_ONLY", disable_duet: false, disable_comment: false, disable_stitch: false },
        source_info: { source: "PULL_FROM_URL", video_url: request.mediaUrl },
      }),
    });
    const data = (await response.json()) as { data?: { publish_id?: string }; error?: { message?: string } };
    if (!response.ok || !data.data?.publish_id) throw new Error(data.error?.message ?? "TikTok publish initialization failed");
    return { provider: "tiktok", externalId: data.data.publish_id, status: "processing" };
  }
}
