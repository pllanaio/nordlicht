-- ContentDock production target schema (PostgreSQL 16+)
-- UUIDs should be generated with gen_random_uuid().

create type membership_role as enum ('owner', 'admin', 'editor', 'reviewer');
create type content_status as enum ('draft', 'review', 'scheduled', 'publishing', 'published', 'failed');
create type publication_status as enum ('queued', 'processing', 'published', 'retry', 'failed', 'canceled');
create type subscription_status as enum ('pending', 'active', 'past_due', 'canceled');

create table app_user (
  id uuid primary key default gen_random_uuid(),
  external_auth_id text not null unique,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now()
);

create table workspace_member (
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role membership_role not null,
  primary key (workspace_id, user_id)
);

create table subscription (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspace(id) on delete cascade,
  plan text not null check (plan in ('starter', 'studio', 'pro')),
  status subscription_status not null default 'pending',
  mollie_customer_id text unique,
  mollie_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table social_connection (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  display_name text not null,
  encrypted_access_token bytea not null,
  encrypted_refresh_token bytea,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_account_id)
);

create table media_asset (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  storage_key text not null unique,
  content_type text not null,
  bytes bigint not null check (bytes > 0),
  checksum_sha256 text not null,
  width integer,
  height integer,
  duration_ms integer,
  scan_status text not null default 'pending',
  created_by uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table content_item (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  title text not null,
  caption text not null default '',
  hashtags text[] not null default '{}',
  status content_status not null default 'draft',
  asset_id uuid references media_asset(id),
  created_by uuid not null references app_user(id),
  approved_by uuid references app_user(id),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table publication (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  content_item_id uuid not null references content_item(id) on delete cascade,
  connection_id uuid not null references social_connection(id),
  status publication_status not null default 'queued',
  idempotency_key text not null unique,
  provider_publish_id text,
  attempts integer not null default 0,
  last_error_code text,
  last_error_message text,
  scheduled_at timestamptz not null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table reminder (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  content_item_id uuid references content_item(id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table trend_signal (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  title text not null,
  explanation text not null,
  source text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table audience_review (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  provider_user_id text not null,
  score integer not null check (score between 0 and 100),
  signals jsonb not null,
  decision text check (decision in ('keep', 'flag', 'block')),
  decided_by uuid references app_user(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider_user_id)
);

create index content_item_workspace_schedule_idx on content_item(workspace_id, scheduled_at);
create index publication_due_idx on publication(status, scheduled_at) where status in ('queued', 'retry');
create index reminder_due_idx on reminder(workspace_id, due_at) where acknowledged_at is null;
