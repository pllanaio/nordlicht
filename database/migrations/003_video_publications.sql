-- Publishing is deliberately separate from video creation; failures never discard media.
create table video_publication (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  video_job_id uuid not null references video_job(id) on delete cascade,
  created_by uuid not null references app_user(id),
  provider text not null check (provider in ('instagram','tiktok','youtube')),
  provider_account_id text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  input jsonb not null,
  status text not null default 'queued' check (status in ('queued','processing','published','uploaded','failed','unknown')),
  stage text not null default 'queued',
  external_id text,
  encrypted_state bytea,
  lease_token uuid,
  lease_expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index video_publication_queue_idx on video_publication(created_at) where status = 'queued';
create index video_publication_workspace_idx on video_publication(workspace_id, video_job_id, created_at desc);
create unique index video_publication_no_duplicates on video_publication(video_job_id, provider)
  where status in ('queued','processing','published','uploaded','unknown');
create index video_publication_creator_idx on video_publication(created_by);
create table publishing_worker (id text primary key, last_seen timestamptz not null default now());
