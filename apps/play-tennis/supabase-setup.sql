-- Rally Play Tennis: Supabase setup
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard > SQL Editor)

-- Lobby: one row per player waiting for a tournament
create table if not exists lobby (
  player_id text primary key,
  player_name text not null,
  county text not null,
  joined_at timestamptz not null default now()
);

-- Tournaments: full tournament state stored as JSONB
create table if not exists tournaments (
  id text primary key,
  county text not null,
  data jsonb not null
);

-- Ratings: Elo ratings per player
create table if not exists ratings (
  player_id text primary key,
  data jsonb not null
);

-- Enable Row Level Security with open access (for testing)
alter table lobby enable row level security;
alter table tournaments enable row level security;
alter table ratings enable row level security;

create policy "Allow all on lobby" on lobby for all using (true) with check (true);
create policy "Allow all on tournaments" on tournaments for all using (true) with check (true);
create policy "Allow all on ratings" on ratings for all using (true) with check (true);

-- Enable Realtime subscriptions on all tables
alter publication supabase_realtime add table lobby;
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table ratings;
