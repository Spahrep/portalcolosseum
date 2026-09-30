-- Migration: LP formula — monster.loot_value + progress-keyed depth multiplier (PC-DEC-057, Spahrep 2026-09-30)
--
-- LP = Σ(monster.loot_value) × depth_mult(progress)
--
-- 1. monster_template.loot_value — the base LP a monster contributes when
--    killed. INDEPENDENT of point_cost (encounter budget): decouples "how hard
--    is the fight" from "how good is the loot". Enables a Metal Slime archetype
--    (low point_cost = cheap/weak, high loot_value = jackpot). Backfilled from
--    point_cost for existing monsters so nothing changes until tuned.
-- 2. game_config.loot_depth_multipliers — the progress-keyed, accelerating
--    depth multiplier curve (fraction of run cleared → multiplier). Config-driven
--    so it's a tuning knob. Default accelerating curve: 1.0/1.2/1.5/1.9/2.5.

-- 1. Add loot_value to monster_template (NOT NULL DEFAULT 0; backfill below).
ALTER TABLE monster_template
  ADD COLUMN IF NOT EXISTS loot_value integer NOT NULL DEFAULT 0;

-- Backfill loot_value from the monster's point_cost in portal_monster_mapping
-- (the encounter budget). A monster's default loot_value = its point_cost, so
-- existing behavior is preserved until a template is tuned. Monsters with no
-- mapping row keep 0 (they contribute no LP — a deliberate tuning state).
UPDATE monster_template m
SET loot_value = COALESCE(
  (SELECT pm.point_cost FROM portal_monster_mapping pm
   WHERE pm.monster_template_id = m.id ORDER BY pm.point_cost DESC LIMIT 1),
  0
)
WHERE m.loot_value = 0;

-- 2. Add the progress-keyed depth multiplier curve to game_config.
--    JSONB array of {progress, mult}: progress = fraction of run cleared,
--    mult = LP multiplier at that progress. Auto-scales to any portal length.
ALTER TABLE game_config
  ADD COLUMN IF NOT EXISTS loot_depth_multipliers jsonb;

-- Seed the default accelerating curve (tuning knob — one UPDATE to change).
UPDATE game_config
SET loot_depth_multipliers = '[
  {"progress": 0.2, "mult": 1.0},
  {"progress": 0.4, "mult": 1.2},
  {"progress": 0.6, "mult": 1.5},
  {"progress": 0.8, "mult": 1.9},
  {"progress": 1.0, "mult": 2.5}
]'::jsonb
WHERE id = 1;
