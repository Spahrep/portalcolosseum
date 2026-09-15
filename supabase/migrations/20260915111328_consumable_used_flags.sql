-- PC-39: Add used flags for consumables A/B on portal_run
-- Applied after 20260914143600_consumables_v2_pc37.sql
-- Do NOT apply this migration until review complete.

ALTER TABLE portal_run
  ADD COLUMN IF NOT EXISTS consume_a_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consume_b_used boolean NOT NULL DEFAULT false;

-- Backfill existing rows (safe, defaults cover new rows)
UPDATE portal_run SET consume_a_used = false WHERE consume_a_used IS NULL;
UPDATE portal_run SET consume_b_used = false WHERE consume_b_used IS NULL;
