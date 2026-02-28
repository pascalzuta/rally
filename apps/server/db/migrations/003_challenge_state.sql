-- The Painful Dollar: challenge state persistence prep
-- Server-authoritative streak/reward continuity (cross-device, tamper-resistant).

create table if not exists challenge_state (
  user_id uuid primary key references app_user(id) on delete cascade,
  streak_days integer not null default 0 check (streak_days >= 0 and streak_days <= 7),
  last_success_day date,
  dollars_back_earned integer not null default 0 check (dollars_back_earned >= 0),
  challenge_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_challenge_last_success_day on challenge_state(last_success_day);

drop trigger if exists trg_challenge_state_updated_at on challenge_state;
create trigger trg_challenge_state_updated_at
before update on challenge_state
for each row
execute function set_updated_at();
