-- Durable, tenant-scoped video generation. Credentials are encrypted only while
-- queued/running, expire after one hour, and are erased by terminal transitions.
create table video_job (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  created_by uuid not null references app_user(id),
  idempotency_key uuid not null,
  request_hash text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','canceled')),
  stage text not null default 'queued' check (stage in ('queued','script','voice','stock','subtitles','render','complete')),
  progress integer not null default 0 check (progress between 0 and 100),
  input jsonb not null,
  script text,
  search_terms jsonb not null default '[]',
  sources jsonb not null default '[]',
  subtitle_srt text,
  media_asset_id uuid references media_asset(id) on delete set null,
  encrypted_api_key bytea,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  check (status in ('queued','processing') or encrypted_api_key is null)
);
create index video_job_queue_idx on video_job(created_at) where status = 'queued';
create index video_job_workspace_idx on video_job(workspace_id, created_at desc);
create index video_job_creator_idx on video_job(created_by);
create index video_job_media_idx on video_job(media_asset_id) where media_asset_id is not null;
create table video_worker (id text primary key, last_seen timestamptz not null default now());
