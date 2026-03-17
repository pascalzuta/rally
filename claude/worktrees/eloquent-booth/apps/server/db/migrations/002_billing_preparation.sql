-- The Painful Dollar: billing preparation schema
-- Prepares mobile in-app billing linkage and charge-attempt auditing.

create table if not exists payment_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  platform text not null check (platform in ('ios_app_store', 'android_play', 'web_test')),
  status text not null check (status in ('pending_setup', 'active', 'disabled')),
  external_account_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists charge_attempt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  charge_event_id uuid not null references charge_event(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  platform text not null check (platform in ('ios_app_store', 'android_play', 'web_test')),
  result text not null check (result in ('simulated', 'queued', 'success', 'failed')),
  provider_transaction_id text,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_profile_user on payment_profile(user_id);
create index if not exists idx_charge_attempt_user on charge_attempt(user_id, created_at desc);
create index if not exists idx_charge_attempt_event on charge_attempt(charge_event_id);

drop trigger if exists trg_payment_profile_updated_at on payment_profile;
create trigger trg_payment_profile_updated_at
before update on payment_profile
for each row
execute function set_updated_at();
