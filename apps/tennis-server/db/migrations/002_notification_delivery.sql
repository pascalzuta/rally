-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id),
  channel text NOT NULL,
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending',
  push_sent_at timestamptz,
  sms_sent_at timestamptz,
  acknowledged_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_escalation
  ON notification_deliveries(status, push_sent_at);

-- Player phone numbers for SMS fallback
CREATE TABLE IF NOT EXISTS player_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL UNIQUE REFERENCES players(id),
  phone_number text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add tier to notifications (1=push+sms, 2=push only, 3=in-app only)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tier smallint;

-- Add active flag and failure tracking to device_tokens
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS consecutive_failures smallint NOT NULL DEFAULT 0;

-- Atomic queue claim function
CREATE OR REPLACE FUNCTION claim_pending_notifications(batch_size int DEFAULT 50)
RETURNS SETOF notifications
LANGUAGE sql
AS $$
  UPDATE notifications
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM notifications
    WHERE status = 'queued'
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
