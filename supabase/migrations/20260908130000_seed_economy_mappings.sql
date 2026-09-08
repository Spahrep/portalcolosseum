-- Seed initial economy mappings for portal/monster/loot tables
-- These are STARTING VALUES pending playtest calibration.
-- Values are grounded in docs/loot-prize-pool.md, docs/encounter-system.md,
-- docs/portal-runs.md, docs/weapon-generation.md (LP costs, point costs,
-- weight semantics for weighted selection, gold ranges).
-- All references use name-based subselects; no hardcoded IDs.
-- Existing base data at time of writing: 1 portal_template, 1 monster_template,
-- 7 weapon_template, 16 attack.

-- Portal monster mappings (point_cost + weight for encounter selection)
INSERT INTO portal_monster_mapping (portal_template_id, monster_template_id, point_cost, weight)
SELECT p.id, m.id, 40, 1.0
FROM portal_template p, monster_template m
WHERE p.name = 'Glimmer Portal' AND m.name = 'Glimmerling';

-- Portal loot mappings (shared portal drop pool; item_name references weapon_template.name)
INSERT INTO portal_loot_mapping (portal_template_id, item_name, lp_cost, weight)
SELECT p.id, w.name, 15, 2.0
FROM portal_template p, weapon_template w
WHERE p.name = 'Glimmer Portal' AND w.name IN ('Wristblade', 'Short Sword');

INSERT INTO portal_loot_mapping (portal_template_id, item_name, lp_cost, weight)
SELECT p.id, w.name, 25, 1.0
FROM portal_template p, weapon_template w
WHERE p.name = 'Glimmer Portal' AND w.name = 'Herb';

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