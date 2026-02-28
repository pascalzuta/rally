-- The Painful Dollar: core backend schema (PostgreSQL)
-- Authoritative records for auth users, accountability windows, and fee ledger.

create extension if not exists pgcrypto;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists conversation_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists daily_accountability_window (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('open', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists charge_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  amount_cents integer not null check (amount_cents >= 0),
  reason text not null check (reason in ('late_response', 'waived_grace')),
  disputed boolean not null default false,
  dispute_reason text,
  settled_at timestamptz,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists idx_window_user_day on daily_accountability_window(user_id, day);
create index if not exists idx_charge_user_day on charge_event(user_id, day desc);
create index if not exists idx_charge_settled on charge_event(settled_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_window_updated_at on daily_accountability_window;
create trigger trg_window_updated_at
before update on daily_accountability_window
for each row
execute function set_updated_at();
