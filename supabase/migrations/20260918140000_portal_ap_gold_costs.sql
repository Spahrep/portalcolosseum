-- Add AP cost to enter (default 0) and gold cost to unlock (default 1000)
ALTER TABLE portal_template 
  ADD COLUMN ap_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN unlock_gold_cost integer NOT NULL DEFAULT 1000;

-- Portal 1 has no unlock cost since it starts unlocked
UPDATE portal_template SET unlock_gold_cost = 0 WHERE id = 1;

-- Seed portals 2-10 (progressively harder)
INSERT INTO portal_template (id, name, tier, description, fights, green_dice_count, yellow_dice_count, red_dice_count, green_faces, yellow_faces, red_faces, ap_cost, unlock_gold_cost)
VALUES
  (2, 'Portal 2', 1, 'The next challenge awaits', 5, 4, 3, 3, '{10,10,10,15,15,20}', '{15,15,20,20,25,25}', '{20,25,30,35,40,45}', 0, 1000),
  (3, 'Portal 3', 1, 'Deeper into the arena', 5, 5, 3, 3, '{10,10,10,15,15,20}', '{15,15,20,20,25,25}', '{20,25,30,35,40,45}', 0, 1000),
  (4, 'Portal 4', 2, 'Stronger foes await', 5, 5, 4, 3, '{10,10,15,15,20,20}', '{15,20,20,25,25,30}', '{25,30,35,40,45,50}', 0, 1000),
  (5, 'Portal 5', 2, 'The trials intensify', 5, 5, 4, 4, '{10,15,15,20,20,25}', '{15,20,25,25,30,30}', '{25,30,35,40,45,50}', 0, 1000),
  (6, 'Portal 6', 2, 'Only the strong survive', 5, 6, 4, 4, '{10,15,15,20,20,25}', '{20,20,25,25,30,30}', '{30,35,40,45,50,55}', 0, 1000),
  (7, 'Portal 7', 3, 'The arena grows harsh', 6, 6, 5, 4, '{15,15,20,20,25,25}', '{20,25,25,30,30,35}', '{30,35,40,45,50,55}', 0, 1000),
  (8, 'Portal 8', 3, 'Few have ventured this far', 6, 6, 5, 5, '{15,15,20,25,25,30}', '{20,25,30,30,35,35}', '{35,40,45,50,55,60}', 0, 1000),
  (9, 'Portal 9', 3, 'The penultimate test', 6, 7, 5, 5, '{15,20,20,25,25,30}', '{25,25,30,30,35,35}', '{35,40,45,50,55,60}', 0, 1000),
  (10, 'Portal 10', 4, 'The final challenge', 7, 7, 6, 5, '{15,20,20,25,30,30}', '{25,25,30,35,35,40}', '{40,45,50,55,60,65}', 0, 1000);

-- Update the identity sequence
SELECT setval('portal_template_id_seq', 10);