# Direct publishing: Instagram, TikTok and YouTube

ContentDock creates the video first. A workspace owner, administrator or editor then previews it, selects one connected channel, enters the caption and provider settings, and explicitly confirms publication. Rendering never automatically posts. Reviewers cannot enqueue a publication; only owners and administrators can save or delete workspace social connections.

## Deployment

1. Run `npm run db:migrate` (migration `003_video_publications.sql`).
2. Configure a persistent PostgreSQL database, `PUBLISHING_ENABLED=true`, the same 32-byte base64 `SOCIAL_TOKEN_ENCRYPTION_KEY` in the web app and publishing worker, and a separate random `PUBLISHING_MEDIA_SECRET` of at least 32 characters and the existing OAuth state/session secrets. `npm run secret:generate` can generate secrets. Never put secrets in `NEXT_PUBLIC_*`.
3. Set `APP_URL` to the public HTTPS origin and run `npm run worker:publishing` alongside the app and video worker. For Vercel, also run `npm run media:serve` behind an HTTPS reverse proxy, set `MEDIA_DELIVERY_URL` to its origin in the app and publishing worker, and share `PUBLISHING_MEDIA_SECRET` with the media service. Large videos stream directly from this service, avoiding serverless response limits. The web API only accepts new publications while the publishing worker has a recent heartbeat. The publishing worker needs `DATABASE_URL` (or `PG*`) and the provider credentials below for safe token refresh. It does not need the user's AI key.
4. Register each exact callback URL below in the corresponding provider app, configure app review/verification, and connect the target account under Integrations.
5. Perform one controlled real upload per approved platform with an account you own, after checking the preview and audience selection. Automated tests in this repository use simulated provider transports; they do not publish real posts or prove platform approval.

### Instagram

Set `META_APP_ID` and `META_APP_SECRET`. Configure `https://YOUR_DOMAIN/api/connect/instagram/callback`. Use Instagram Login with a professional Instagram account and approved `instagram_business_basic` + `instagram_business_content_publish` permissions. The token's permissions are read from the provider, not inferred from the requested scopes. Existing connections without confirmed grants must be reconnected.

The worker creates a REELS container, persists its ID, polls `status_code` until `FINISHED`, and then calls `media_publish`. Instagram fetches the MP4 from `/api/publishing/media/{publicationId}?expires=...&signature=...` on the configured media-service origin. This route serves only the completed video linked to that active publication, has a one-hour HMAC capability, validates tenant joins, and supports byte ranges and HEAD. The URL is not a permanent public asset link. Ensure your proxy does not log query strings for this route. The HMAC uses the separate `PUBLISHING_MEDIA_SECRET` with a publication-specific domain separator. A fully self-hosted app may serve this route directly when no media-service origin is configured; Vercel requires the separate service.

Instagram tokens currently require reconnecting when expired. The worker will not post using an expired token.

### TikTok

Set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. Configure `https://YOUR_DOMAIN/api/connect/tiktok/callback`. Enable Login Kit and Content Posting API Direct Post with `user.info.basic` and `video.publish`. TikTok audit/app approval determines which users, privacy levels and publishing quotas your application can use. Unaudited clients are restricted by TikTok; ContentDock does not bypass those restrictions.

The UI obtains fresh creator information and requires an explicit privacy choice, interaction settings, branded-content disclosures and music-usage confirmation. These constraints are checked again when enqueuing and immediately before upload. Synthetic content is disclosed via `is_aigc`. The worker uses `FILE_UPLOAD`, persists the publish ID and encrypted upload URL before uploading chunks, and polls the publish status. Remote-URL domain verification is therefore not needed for this upload path. OAuth refresh tokens are rotated when supplied by TikTok.

TikTok references: [Direct Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), [creator information](https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info), [content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines), [music confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en).

### YouTube

Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`. Configure `https://YOUR_DOMAIN/api/connect/youtube/callback` in a Google OAuth web application and enable YouTube Data API v3. The linked Google account must have a YouTube channel. Requested scopes are `youtube.upload` and `youtube.readonly`; readonly identifies the channel and verifies uploaded video status. Actual token grants are stored. Offline consent obtains a refresh token.

The UI requires a title, explicit `private`/`unlisted`/`public` audience and an explicit “made for kids” answer. The worker initializes a resumable upload, persists the encrypted session URL, uploads the MP4, stores the returned video ID and reads provider status. It also declares synthetic media. Only provider-confirmed public + processed videos are reported as `published`; private, unlisted or still-processing uploads are `uploaded`. YouTube may force uploads from unverified API projects to private. Complete Google's OAuth verification and YouTube compliance audit as applicable before promising public publishing to customers. Vertical videos qualify as Shorts according to YouTube's current rules; this API has no separate “Shorts” upload flag.

References: [OAuth](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps), [resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol), [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).

## API and safety properties

- `GET /api/video/jobs/{id}/publish` returns the safe channel options, fresh TikTok creator settings and the publication history. Tokens and upload URLs never appear in this response.
- `GET` with `?status=1` reads publication status from the database only. The UI uses this path for automatic polling, preserving the selected options without repeatedly consuming TikTok creator-info quota. Initial load and explicit refresh fetch channel settings; enqueue and upload recheck them.
- `POST` at the same path requires a same-origin JSON request, authenticated paid workspace, UUID `Idempotency-Key`, provider input and `consent: true`. See `src/lib/publishing/types.ts` for the exact request/response types.
- Queue claims use `FOR UPDATE SKIP LOCKED`; writes and assets always carry the workspace ID. Before posting, the worker checks current membership, active subscription, bound account ID, permissions and token expiry.
- A duplicate request key returns the existing result. A second nonfailed publication of the same video/platform is blocked even with a new key. Failed video generation never queues a post.
- Provider calls have timeouts and redirects disabled. Upload URLs are restricted to provider-owned HTTPS hosts. Provider errors are reduced to safe messages; raw response payloads, tokens and signed upload URLs are not logged.
- Expired worker leases and uncertain remote outcomes become `unknown`, never automatically retried. IDs and encrypted upload state are retained for reconciliation. Worker interruption cannot cause the next worker to blindly post a duplicate. Lease loss, shutdown and a 15-minute job deadline abort active provider requests; an expired lease is never renewed.
- Completed video media remains available regardless of publication outcome.

## Reconciliation

`unknown` means the platform may already have accepted the action. First inspect the provider's account/dashboard and the stored `external_id` (Instagram container ID while processing, TikTok publish ID, YouTube video ID after upload). For an interrupted upload the encrypted session state is available to an operator with database and key access. Do not reset `unknown` to `queued`.

If the remote post exists, record the confirmed final state and ID in the publication record through an operator-controlled repair. If the provider definitively confirms that no post can result (for example a terminal failed container), mark it `failed` and let the user explicitly submit a new publication. There is intentionally no one-click blind retry for uncertain states. YouTube `uploaded` is a confirmed upload with limited/processing visibility and does not permit another upload of the same video; inspect YouTube Studio for processing or visibility changes. A future reconciler can poll saved IDs without repeating creation calls.

Run `npm run test:publishing` for deterministic provider-contract, credential, egress, signing, and timeout tests. Optional PostgreSQL tests require a dedicated `PUBLISHING_TEST_DATABASE_URL`; never point them at production.
