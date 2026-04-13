-- =============================================================================
-- Migration: Push Notification Infrastructure
-- Creates device_tokens, notification_preferences tables
-- and extends notifications for push + in-app read tracking
-- =============================================================================

-- ── 1. Device Tokens ─────────────────────────────────────────────────────────
-- Stores FCM/APNs tokens for each device a player uses.
-- One player may have multiple tokens (phone + tablet).
-- A given token string is globally unique (FCM guarantees this).

create table if not exists device_tokens (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_device_tokens_token unique (token)
);

create index if not exists idx_device_tokens_player_id
  on device_tokens(player_id);

alter table device_tokens enable row level security;

create policy "device_tokens_select_own" on device_tokens
  for select using (auth.uid() = player_id);

create policy "device_tokens_insert_own" on device_tokens
  for insert with check (auth.uid() = player_id);

create policy "device_tokens_update_own" on device_tokens
  for update using (auth.uid() = player_id);

create policy "device_tokens_delete_own" on device_tokens
  for delete using (auth.uid() = player_id);

-- Upsert function: register or refresh a device token.
-- Uses SECURITY DEFINER so it can be called via RPC from the client
-- even though the token might belong to a different user (re-login on same device).
create or replace function upsert_device_token(
  p_player_id uuid,
  p_token text,
  p_platform text,
  p_app_version text default null
) returns void as $$
begin
  insert into device_tokens (player_id, token, platform, app_version)
  values (p_player_id, p_token, p_platform, p_app_version)
  on conflict (token) do update set
    player_id   = excluded.player_id,
    platform    = excluded.platform,
    app_version = excluded.app_version,
    updated_at  = now();
end;
$$ language plpgsql security definer;


-- ── 2. Notification Preferences ──────────────────────────────────────────────
-- Per-player notification settings. Created lazily on first preference change.
-- Defaults: everything on, quiet hours 10pm-7am Eastern.

create table if not exists notification_preferences (
  player_id       uuid primary key,
  push_enabled    boolean not null default true,
  email_enabled   boolean not null default true,
  -- JSON array of disabled notification type codes, e.g. ["N-11", "N-12"]
  disabled_types  jsonb not null default '[]'::jsonb,
  -- Quiet hours: null means use system defaults (10pm-7am)
  quiet_start     smallint check (quiet_start >= 0 and quiet_start <= 23),
  quiet_end       smallint check (quiet_end >= 0 and quiet_end <= 23),
  timezone        text not null default 'America/New_York',
  updated_at      timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "notification_prefs_all_own" on notification_preferences
  for all using (auth.uid() = player_id)
  with check (auth.uid() = player_id);


-- ── 3. Auto-update updated_at triggers ──────────────────────────────────────

create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Only create triggers if they don't already exist
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_device_tokens_updated_at'
  ) then
    create trigger set_device_tokens_updated_at
      before update on device_tokens
      for each row execute function trigger_set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_notification_prefs_updated_at'
  ) then
    create trigger set_notification_prefs_updated_at
      before update on notification_preferences
      for each row execute function trigger_set_updated_at();
  end if;
end $$;


-- ── 4. Enable Realtime on new tables ─────────────────────────────────────────
-- device_tokens: no realtime needed (server-side only reads)
-- notification_preferences: no realtime needed (user reads own)
-- But enable on device_tokens for admin monitoring if desired

alter publication supabase_realtime add table device_tokens;
