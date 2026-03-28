-- =============================================================================
-- Rally Analytics & Attribution Schema
-- Run this in the Supabase SQL editor for project gxiflulfgqahlvdirecz
-- =============================================================================

-- 1. Raw analytics events (every tracked action)
CREATE TABLE IF NOT EXISTS analytics_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name    text NOT NULL,
  properties    jsonb DEFAULT '{}',
  user_id       text,                      -- player ID (null for anonymous visitors)
  session_id    text,                      -- client-generated session identifier
  channel       text DEFAULT 'direct',     -- derived: meta, google, organic, direct, referral, etc.
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  referrer      text,
  landing_page  text,
  page_url      text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_channel ON analytics_events (channel);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id);

-- 2. User acquisition records (one per user, first-touch attribution)
CREATE TABLE IF NOT EXISTS user_acquisitions (
  user_id       text PRIMARY KEY,
  channel       text DEFAULT 'direct',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  referrer      text,
  landing_page  text,
  registered_at timestamptz DEFAULT now(),
  county        text,
  skill_level   text,
  gender        text
);

CREATE INDEX IF NOT EXISTS idx_user_acq_channel ON user_acquisitions (channel);
CREATE INDEX IF NOT EXISTS idx_user_acq_registered ON user_acquisitions (registered_at);

-- 3. Channel spend tracking (for CAC / ROAS calculations)
CREATE TABLE IF NOT EXISTS channel_spend (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel  text NOT NULL,
  month    text NOT NULL,             -- format: YYYY-MM
  spend    numeric(12, 2) DEFAULT 0,
  UNIQUE(channel, month)
);

-- 4. Enable RLS but allow anonymous inserts for event tracking
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_spend ENABLE ROW LEVEL SECURITY;

-- Allow anon role to insert events (client-side tracking)
CREATE POLICY "Allow anon insert analytics_events"
  ON analytics_events FOR INSERT
  TO anon WITH CHECK (true);

-- Allow anon to read analytics_events (for dashboard)
CREATE POLICY "Allow anon select analytics_events"
  ON analytics_events FOR SELECT
  TO anon USING (true);

-- Allow anon to upsert user_acquisitions
CREATE POLICY "Allow anon insert user_acquisitions"
  ON user_acquisitions FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update user_acquisitions"
  ON user_acquisitions FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon select user_acquisitions"
  ON user_acquisitions FOR SELECT
  TO anon USING (true);

-- Channel spend: anon can read and write (admin dashboard)
CREATE POLICY "Allow anon all channel_spend"
  ON channel_spend FOR ALL
  TO anon USING (true) WITH CHECK (true);

-- 5. Enable Realtime for live dashboard updates (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_events;
