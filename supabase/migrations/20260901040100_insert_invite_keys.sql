-- ============================================================
-- Portal Colosseum - Alpha Invite Keys (30 pre-generated)
-- ============================================================
-- Run this SQL AFTER applying migration
--   20260901040000_create_invite_keys_table.sql
-- to the production database via: supabase db push
--
-- Each key is one-time use (used = false → used = true after signup)
--
-- Test key (bypasses DB, set as env var INVITE_KEY_HARDCODED):
--   EyeOfTheWorld
-- ============================================================

INSERT INTO public.invite_keys (key, used) VALUES
  ('alpha-b8ba6f0a', false),
  ('alpha-18208b6b', false),
  ('alpha-b82f127f', false),
  ('alpha-48c0d0f8', false),
  ('alpha-9381815c', false),
  ('alpha-16d15ad7', false),
  ('alpha-4ecc987e', false),
  ('alpha-fdab7308', false),
  ('alpha-eceef4f2', false),
  ('alpha-1fd2bea1', false),
  ('alpha-7b5940d6', false),
  ('alpha-7cff4eb9', false),
  ('alpha-2bfe3b96', false),
  ('alpha-1380c469', false),
  ('alpha-0b35de6a', false),
  ('alpha-bd10b333', false),
  ('alpha-aaf84dc4', false),
  ('alpha-6017f44a', false),
  ('alpha-f7526cb8', false),
  ('alpha-b23275bc', false),
  ('alpha-8dba5d6d', false),
  ('alpha-dc23dd07', false),
  ('alpha-16e1d094', false),
  ('alpha-b8d3bf63', false),
  ('alpha-2bc5d88b', false),
  ('alpha-4bb19c98', false),
  ('alpha-bb62f475', false),
  ('alpha-fe7b77b2', false),
  ('alpha-cedce411', false),
  ('alpha-d01bda46', false);
