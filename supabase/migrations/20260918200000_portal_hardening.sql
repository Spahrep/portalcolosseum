-- Portal hardening: add max_enemies, update portal 1-10 with harder dice counts/faces per PC-64 spec
-- Each step shifts dice green→yellow→red (min 2 per color), face values escalate ~5pt per portal

ALTER TABLE portal_template 
  ADD COLUMN max_enemies integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN portal_template.max_enemies IS 'Max monsters per encounter (default 5)';

-- Portal 1: explicit defaults + new hardened values (was using table defaults)
UPDATE portal_template SET
  name = 'Portal 1',
  tier = 1,
  description = 'The arena awaits',
  fights = 5,
  green_dice_count = 4,
  yellow_dice_count = 3,
  red_dice_count = 3,
  green_faces = '{5,5,10,10,15,20}',
  yellow_faces = '{10,10,15,20,20,25}',
  red_faces = '{15,20,25,25,30,35}',
  max_enemies = 5,
  ap_cost = 0,
  unlock_gold_cost = 0
WHERE id = 1;

-- Portals 2-10: re-seed with new progression (dice shift + escalating faces + max_enemies)
UPDATE portal_template SET
  fights = 5,
  green_dice_count = 3,
  yellow_dice_count = 4,
  red_dice_count = 3,
  green_faces = '{10,10,15,15,20,20}',
  yellow_faces = '{15,15,20,25,25,30}',
  red_faces = '{20,25,30,35,40,45}',
  max_enemies = 5
WHERE id = 2;

UPDATE portal_template SET
  fights = 5,
  green_dice_count = 2,
  yellow_dice_count = 5,
  red_dice_count = 3,
  green_faces = '{10,15,15,20,20,25}',
  yellow_faces = '{20,20,25,25,30,35}',
  red_faces = '{25,30,35,40,45,50}',
  max_enemies = 5
WHERE id = 3;

UPDATE portal_template SET
  fights = 5,
  green_dice_count = 2,
  yellow_dice_count = 4,
  red_dice_count = 4,
  green_faces = '{15,15,20,20,25,25}',
  yellow_faces = '{20,25,25,30,35,40}',
  red_faces = '{30,35,40,45,50,55}',
  max_enemies = 5
WHERE id = 4;

UPDATE portal_template SET
  fights = 5,
  green_dice_count = 2,
  yellow_dice_count = 3,
  red_dice_count = 5,
  green_faces = '{15,15,20,25,25,30}',
  yellow_faces = '{25,25,30,30,35,40}',
  red_faces = '{35,40,45,50,55,60}',
  max_enemies = 6
WHERE id = 5;

UPDATE portal_template SET
  fights = 5,
  green_dice_count = 2,
  yellow_dice_count = 2,
  red_dice_count = 6,
  green_faces = '{15,20,20,25,30,30}',
  yellow_faces = '{25,30,30,35,40,45}',
  red_faces = '{40,45,50,55,60,65}',
  max_enemies = 6
WHERE id = 6;

UPDATE portal_template SET
  fights = 6,
  green_dice_count = 2,
  yellow_dice_count = 2,
  red_dice_count = 7,
  green_faces = '{20,20,25,25,30,35}',
  yellow_faces = '{30,35,35,40,45,45}',
  red_faces = '{45,50,55,60,65,70}',
  max_enemies = 6
WHERE id = 7;

UPDATE portal_template SET
  fights = 6,
  green_dice_count = 2,
  yellow_dice_count = 2,
  red_dice_count = 8,
  green_faces = '{20,25,25,30,35,40}',
  yellow_faces = '{35,35,40,45,45,50}',
  red_faces = '{50,55,60,65,70,75}',
  max_enemies = 6
WHERE id = 8;

UPDATE portal_template SET
  fights = 6,
  green_dice_count = 2,
  yellow_dice_count = 2,
  red_dice_count = 9,
  green_faces = '{25,25,30,35,35,40}',
  yellow_faces = '{35,40,45,50,50,55}',
  red_faces = '{55,60,65,70,75,80}',
  max_enemies = 6
WHERE id = 9;

UPDATE portal_template SET
  fights = 7,
  green_dice_count = 2,
  yellow_dice_count = 2,
  red_dice_count = 10,
  green_faces = '{25,30,35,35,40,45}',
  yellow_faces = '{40,45,45,50,55,55}',
  red_faces = '{60,65,70,75,80,85}',
  max_enemies = 7
WHERE id = 10;

-- Ensure identity sequence is correct
SELECT setval('portal_template_id_seq', 10);