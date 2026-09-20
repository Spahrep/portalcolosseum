-- Loot drops migration for Portal Colosseum
-- Adds prize_pool column to portal_run

ALTER TABLE portal_run ADD COLUMN IF NOT EXISTS prize_pool jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN portal_run.prize_pool IS 'Accumulated loot: {weapon_ids: int[], gold: int, lp_earned: int}. weapon_ids point to weapon_instance rows created by generate_weapon.';
