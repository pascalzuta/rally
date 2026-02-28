-- Rally v2 — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor to set up all tables.

-- Enable citext for case-insensitive email/county matching
CREATE EXTENSION IF NOT EXISTS citext;

-- ── Auth Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_users (
  id          UUID PRIMARY KEY,
  email       CITEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Players ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id                     UUID PRIMARY KEY REFERENCES auth_users(id),
  email                  CITEXT NOT NULL,
  name                   TEXT NOT NULL DEFAULT '',
  city                   TEXT NOT NULL DEFAULT '',
  county                 TEXT NOT NULL DEFAULT '',
  level                  TEXT NOT NULL DEFAULT 'beginner',
  ntrp                   REAL NOT NULL DEFAULT 3.0,
  rating                 REAL NOT NULL DEFAULT 1000,
  rating_confidence      REAL NOT NULL DEFAULT 0,
  provisional_remaining  INT NOT NULL DEFAULT 5,
  wins                   INT NOT NULL DEFAULT 0,
  losses                 INT NOT NULL DEFAULT 0,
  subscription           TEXT NOT NULL DEFAULT 'free',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_county ON players (LOWER(county));
CREATE INDEX IF NOT EXISTS idx_players_city   ON players (LOWER(city));

-- ── Availability Slots ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS availability_slots (
  id           UUID PRIMARY KEY,
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TEXT NOT NULL,  -- "HH:MM"
  end_time     TEXT NOT NULL   -- "HH:MM"
);

CREATE INDEX IF NOT EXISTS idx_availability_player ON availability_slots (player_id);

-- ── Matches ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY,
  challenger_id   UUID NOT NULL REFERENCES players(id),
  opponent_id     UUID NOT NULL REFERENCES players(id),
  tournament_id   UUID,  -- nullable for casual matches
  status          TEXT NOT NULL DEFAULT 'pending',
  scheduled_at    TIMESTAMPTZ,
  venue           TEXT,
  scheduling_tier INT,   -- 1, 2, or 3
  proposals       JSONB NOT NULL DEFAULT '[]'::jsonb,
  result          JSONB,
  near_miss       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_challenger   ON matches (challenger_id);
CREATE INDEX IF NOT EXISTS idx_matches_opponent     ON matches (opponent_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament   ON matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_status       ON matches (status);

-- ── Tournaments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tournaments (
  id                      UUID PRIMARY KEY,
  month                   TEXT NOT NULL,  -- "YYYY-MM"
  name                    TEXT NOT NULL,
  county                  TEXT NOT NULL,
  band                    TEXT NOT NULL,  -- "3.0", "3.5", "4.0"
  status                  TEXT NOT NULL DEFAULT 'registration',
  player_ids              TEXT[] NOT NULL DEFAULT '{}',
  min_players             INT NOT NULL DEFAULT 4,
  max_players             INT NOT NULL DEFAULT 8,
  rounds                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  standings               JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_results         JSONB NOT NULL DEFAULT '{}'::jsonb,
  registration_opened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finals_matches          JSONB,
  scheduling_result       JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_county_band_month
  ON tournaments (LOWER(county), band, month);

-- ── Pool Entries ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pool_entries (
  id          UUID PRIMARY KEY,
  player_id   UUID NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  county      TEXT NOT NULL,
  band        TEXT NOT NULL,
  rating      REAL NOT NULL DEFAULT 1000,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_county_band ON pool_entries (LOWER(county), band);

-- ── RLS disabled (backend uses service role key) ────────────────────────────────

ALTER TABLE auth_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_entries       ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (default behavior with service_role key)
-- No restrictive policies = service role has full access
