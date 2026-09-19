-- Fix: max_enemies was wrong (misread "battles per run" as "enemies per fight")
-- Drop the column, update portal 5-9 to 6 fights, portal 10 stays 7 (already correct)

ALTER TABLE portal_template DROP COLUMN max_enemies;

-- Portal 5 onward get 6 fights per run (was 5 for 5-6)
UPDATE portal_template SET fights = 6 WHERE id = 5;
UPDATE portal_template SET fights = 6 WHERE id = 6;

-- Portal 7-9 already have fights=6, portal 10 already has fights=7
-- (no change needed for those)