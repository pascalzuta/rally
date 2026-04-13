-- Migration: Add courts JSONB column to lobby table
-- This stores player court profiles (max 3 courts per player)
-- Each entry is a Court object with venue_name, booking_needed, cost_applies, etc.

ALTER TABLE lobby ADD COLUMN IF NOT EXISTS courts JSONB DEFAULT '[]'::jsonb;

-- No migration needed for tournament matches — they're JSONB within the tournaments table.
-- New matches get a `court` field; old matches remain null (treated as "no court set").
