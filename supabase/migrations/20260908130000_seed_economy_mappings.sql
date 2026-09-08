-- Seed initial economy mappings for portal/monster/loot tables
-- These are STARTING VALUES pending playtest calibration.
-- Values are grounded in docs/loot-prize-pool.md, docs/encounter-system.md,
-- docs/portal-runs.md, docs/weapon-generation.md (LP costs, point costs,
-- weight semantics for weighted selection, gold ranges).
-- All references use name-based subselects; no hardcoded IDs.
-- Existing base data (prod, verified 2026-09-08): portal 'Portal 1',
-- monster 'Glimmerling', 7 weapon_templates. 'Herb' does not exist in prod,
-- so its loot row is omitted (was a no-op insert).

-- Portal monster mappings (point_cost + weight for encounter selection)
INSERT INTO portal_monster_mapping (portal_template_id, monster_template_id, point_cost, weight)
SELECT p.id, m.id, 40, 1.0
FROM portal_template p, monster_template m
WHERE p.name = 'Portal 1' AND m.name = 'Glimmerling';

-- Portal loot mappings (shared portal drop pool; weapon_template_id FK to weapon_template)
INSERT INTO portal_loot_mapping (portal_template_id, weapon_template_id, lp_cost, weight)
SELECT p.id, w.id, 15, 2.0
FROM portal_template p, weapon_template w
WHERE p.name = 'Portal 1' AND w.name IN ('Wristblade', 'Short Sword');

-- Monster loot mappings (monster-specific drops)
INSERT INTO monster_loot_mapping (monster_template_id, weapon_template_id, lp_cost, weight)
SELECT m.id, w.id, 8, 3.0
FROM monster_template m, weapon_template w
WHERE m.name = 'Glimmerling' AND w.name = 'Wristblade';

INSERT INTO monster_loot_mapping (monster_template_id, weapon_template_id, lp_cost, weight)
SELECT m.id, w.id, 12, 1.5
FROM monster_template m, weapon_template w
WHERE m.name = 'Glimmerling' AND w.name = 'Short Sword';

-- Note: Additional mappings for the other 5 weapon_templates and future portals/monsters
-- will be added after initial playtests calibrate the economy. Gold min/max live on
-- monster_template (summed per fight per loot-prize-pool.md).
