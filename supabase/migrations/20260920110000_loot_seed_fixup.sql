-- Seed fixup for loot drops: gold values + loot mappings

-- Gold values per monster difficulty
UPDATE monster_template SET min_gold=1, max_gold=3 WHERE name='Glimmerling';
UPDATE monster_template SET min_gold=2, max_gold=5 WHERE name='Blue Slime';
UPDATE monster_template SET min_gold=3, max_gold=8 WHERE name='Giant Rat';
UPDATE monster_template SET min_gold=5, max_gold=12 WHERE name='Wolf';
UPDATE monster_template SET min_gold=8, max_gold=18 WHERE name='Imp';

-- Clear and reseed portal_loot_mapping for Portal 1 (Wristblade, Short Sword, etc.)
DELETE FROM portal_loot_mapping WHERE portal_template_id=1;

INSERT INTO portal_loot_mapping (portal_template_id, weapon_template_id, lp_cost, weight) VALUES
(1, 1, 15, 2.0),  -- Wristblade
(1, 2, 15, 2.0),  -- Short Sword
(1, 4, 12, 1.5),  -- Hand Axe
(1, 3, 20, 0.5);  -- Greatsword

-- Add monster_loot_mapping for Glimmerling (assume id=1)
DELETE FROM monster_loot_mapping WHERE monster_template_id=1;
INSERT INTO monster_loot_mapping (monster_template_id, weapon_template_id, lp_cost, weight) VALUES
(1, 1, 8, 3.0),   -- Wristblade
(1, 2, 12, 1.5);  -- Short Sword

-- Note: other monsters can have rows added later; current seed focuses on Glimmerling + portal
