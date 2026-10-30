-- Declarative desired state. Public product metadata only; no deployment performed.
-- Supabase roles anon/authenticated must already exist in the target environment.

create table public.product_app_releases (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9.-]{0,99}$'),
  version text not null check (length(version) between 1 and 80),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_bytes bigint not null check (artifact_bytes > 0),
  download_url text check (download_url is null or (length(download_url) <= 2048 and download_url ~ '^https://[^[:space:]@]+$')),
  release_status text not null default 'experimental' check (release_status in ('experimental', 'preview')),
  legal_status text not null default 'not-validated' check (legal_status = 'not-validated'),
  published boolean not null default false,
  released_at timestamptz not null,
  created_at timestamptz not null default now(),
  platform text not null check (platform in ('macos')),
  architecture text not null check (architecture in ('arm64')),
  default_model_replaced boolean not null default false check (default_model_replaced = false),
  unique (version, platform, architecture)
);

alter table public.product_app_releases enable row level security;
alter table public.product_app_releases force row level security;
revoke all on table public.product_app_releases from public, anon, authenticated;
grant select on table public.product_app_releases to anon, authenticated;
create policy "published_read_only" on public.product_app_releases
  for select to anon, authenticated
  using (published = true);
create index product_app_releases_published_at on public.product_app_releases (released_at desc) where published = true;

create table public.product_model_releases (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9.-]{0,99}$'),
  version text not null check (length(version) between 1 and 80),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_bytes bigint not null check (artifact_bytes > 0),
  download_url text check (download_url is null or (length(download_url) <= 2048 and download_url ~ '^https://[^[:space:]@]+$')),
  release_status text not null default 'experimental' check (release_status in ('experimental', 'preview')),
  legal_status text not null default 'not-validated' check (legal_status = 'not-validated'),
  published boolean not null default false,
  released_at timestamptz not null,
  created_at timestamptz not null default now(),
  model_name text not null check (length(model_name) between 1 and 160),
  base_model text not null check (length(base_model) between 1 and 160),
  training_steps integer not null check (training_steps > 0),
  behavior_cases integer not null check (behavior_cases > 0),
  behavior_scope text not null check (length(behavior_scope) between 1 and 500),
  installation text not null check (installation = 'manual-separate-ollama-import'),
  is_default boolean not null default false check (is_default = false),
  unique (version)
);

alter table public.product_model_releases enable row level security;
alter table public.product_model_releases force row level security;
revoke all on table public.product_model_releases from public, anon, authenticated;
grant select on table public.product_model_releases to anon, authenticated;
create policy "published_read_only" on public.product_model_releases
  for select to anon, authenticated
  using (published = true);
create index product_model_releases_published_at on public.product_model_releases (released_at desc) where published = true;

create table public.product_legal_library_snapshots (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9.-]{0,99}$'),
  version text not null check (length(version) between 1 and 80),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_bytes bigint not null check (artifact_bytes > 0),
  download_url text check (download_url is null or (length(download_url) <= 2048 and download_url ~ '^https://[^[:space:]@]+$')),
  release_status text not null default 'experimental' check (release_status in ('experimental', 'preview')),
  legal_status text not null default 'not-validated' check (legal_status = 'not-validated'),
  published boolean not null default false,
  released_at timestamptz not null,
  created_at timestamptz not null default now(),
  corpus_sha256 text not null check (corpus_sha256 ~ '^[a-f0-9]{64}$'),
  instruments integer not null check (instruments > 0),
  articles integer not null check (articles > 0),
  sample_audit_cases integer not null check (sample_audit_cases > 0),
  currentness text not null default 'unverified' check (currentness = 'unverified'),
  coverage_scope text not null check (length(coverage_scope) between 1 and 500),
  unique (version)
);

alter table public.product_legal_library_snapshots enable row level security;
alter table public.product_legal_library_snapshots force row level security;
revoke all on table public.product_legal_library_snapshots from public, anon, authenticated;
grant select on table public.product_legal_library_snapshots to anon, authenticated;
create policy "published_read_only" on public.product_legal_library_snapshots
  for select to anon, authenticated
  using (published = true);
create index product_legal_library_snapshots_published_at on public.product_legal_library_snapshots (released_at desc) where published = true;

grant usage on schema public to anon, authenticated;
