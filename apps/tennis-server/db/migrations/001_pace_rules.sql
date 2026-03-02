-- Pace Rules: match deadline tracking columns
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS deadline_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposals_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_actions jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS player_activity jsonb DEFAULT '{}';

-- Pace Rules: tournament deadline columns
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS hard_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS round_robin_deadline timestamptz;

-- Notification queue
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id),
  match_id uuid REFERENCES matches(id),
  tournament_id uuid REFERENCES tournaments(id),
  type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON notifications(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_player
  ON notifications(player_id, status);
