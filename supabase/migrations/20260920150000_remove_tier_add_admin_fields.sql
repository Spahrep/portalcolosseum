-- Remove unused tier column from portal_template (never asked for, dead weight)
ALTER TABLE portal_template DROP COLUMN IF EXISTS tier;

-- Note: fights, max_enemies, ap_cost, unlock_gold_cost are already on the table.
-- This migration only removes tier; the admin form update for the missing fields
-- is in the JS (admin-app.js) and doesn't need a schema change.