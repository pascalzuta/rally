-- Accountability scheduling + off-session charging records (iOS briefing aligned).

create table if not exists accountability_setting (
  user_id uuid primary key references app_user(id) on delete cascade,
  timezone text not null default 'UTC',
  reminder_time time not null default '08:20',
  deadline_time time not null default '08:30',
  required_goals integer not null default 2 check (required_goals >= 2),
  accountability_enabled boolean not null default false,
  payment_method_status text not null default 'none'
    check (payment_method_status in ('none', 'pending_setup', 'active')),
  payment_method_provider text not null default 'stripe' check (payment_method_provider in ('stripe')),
  payment_method_type text not null default 'apple_pay_only' check (payment_method_type in ('apple_pay_only')),
  payment_method_last4 text,
  provider_customer_id text,
  provider_payment_method_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_goal_report (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  goals_set_count integer not null default 0 check (goals_set_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists offsession_charge_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  day date not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null check (status in ('charged', 'waived', 'failed')),
  reason text not null check (
    reason in (
      'goals_met',
      'goal_missed',
      'accountability_disabled',
      'payment_not_ready',
      'daily_cap_reached',
      'monthly_cap_reached',
      'payment_failed'
    )
  ),
  provider_charge_id text,
  receipt_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists idx_daily_goal_report_user_day on daily_goal_report(user_id, day desc);
create index if not exists idx_offsession_history_user_day on offsession_charge_history(user_id, day desc);
create index if not exists idx_offsession_history_user_created on offsession_charge_history(user_id, created_at desc);

drop trigger if exists trg_accountability_setting_updated_at on accountability_setting;
create trigger trg_accountability_setting_updated_at
before update on accountability_setting
for each row
execute function set_updated_at();

drop trigger if exists trg_daily_goal_report_updated_at on daily_goal_report;
create trigger trg_daily_goal_report_updated_at
before update on daily_goal_report
for each row
execute function set_updated_at();
