-- Migration: Add stop_share_tiers to portal_template and awarded_pool to portal_run
-- Implements tiered loot extraction for between-fights stop choice

ALTER TABLE portal_template ADD COLUMN IF NOT EXISTS stop_share_tiers jsonb NOT NULL DEFAULT '
  [
    {"gold_pct": 0.20, "sel_items": 0, "rand_items": 0},
    {"gold_pct": 0.20, "sel_items": 0, "rand_items": 1},
    {"gold_pct": 0.30, "sel_items": 1, "rand_items": 1},
    {"gold_pct": 0.60, "sel_items": 1, "rand_items": 2},
    {"gold_pct": 0.80, "sel_items": 2, "rand_items": 2}
  ]
'::jsonb;

ALTER TABLE portal_run ADD COLUMN IF NOT EXISTS awarded_pool jsonb NOT NULL DEFAULT '{}'::jsonb;
