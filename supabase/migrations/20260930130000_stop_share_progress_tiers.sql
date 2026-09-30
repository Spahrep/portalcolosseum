-- Migration: Stop-share tiers → progress-keyed curve (PC-DEC-056, Spahrep 2026-09-30)
-- Replaces the positional-by-fight-number tiers with a progress-keyed curve so
-- the stop-share auto-scales to any portal length (5 fights, 8 fights, etc.).
--
-- New format: each entry is {progress, gold_pct, sel_items, rand_items}
--   progress   = fraction of the run cleared (0.2 = 20% through, 1.0 = full clear)
--   gold_pct   = fraction of gold kept
--   sel_items  = how many weapons the player picks (agency)
--   rand_items = how many weapons the game picks (loss)
--
-- Default accelerating curve: gold 15/30/50/70/100%, items 0/0/1/1/2 sel + 0/1/1/2/2 rand.
-- Full clear (progress 1.0) = full pool (handled by computeStopShare, not a tier).

-- Update the column default to the new progress-keyed format.
ALTER TABLE portal_template
  ALTER COLUMN stop_share_tiers SET DEFAULT
  '[
    {"progress": 0.2, "gold_pct": 0.15, "sel_items": 0, "rand_items": 1},
    {"progress": 0.4, "gold_pct": 0.30, "sel_items": 0, "rand_items": 1},
    {"progress": 0.6, "gold_pct": 0.50, "sel_items": 1, "rand_items": 1},
    {"progress": 0.8, "gold_pct": 0.70, "sel_items": 1, "rand_items": 2}
  ]'::jsonb;

-- Backfill any existing portal templates that still carry the OLD positional
-- format (entries keyed by fight number, no "progress" field). Detect by the
-- absence of a "progress" key in the first entry. Only touch rows that are
-- still on the old shape — leave any already-migrated rows alone.
UPDATE portal_template
SET stop_share_tiers = '[
    {"progress": 0.2, "gold_pct": 0.15, "sel_items": 0, "rand_items": 1},
    {"progress": 0.4, "gold_pct": 0.30, "sel_items": 0, "rand_items": 1},
    {"progress": 0.6, "gold_pct": 0.50, "sel_items": 1, "rand_items": 1},
    {"progress": 0.8, "gold_pct": 0.70, "sel_items": 1, "rand_items": 2}
  ]'::jsonb
WHERE stop_share_tiers IS NULL
   OR jsonb_typeof(stop_share_tiers) <> 'array'
   OR jsonb_array_length(stop_share_tiers) = 0
   OR NOT (stop_share_tiers->0 ? 'progress');
