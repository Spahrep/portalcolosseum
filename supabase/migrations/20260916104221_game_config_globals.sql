-- PC-52r2: extend game_config into the game's global-variables table.
-- Spahrep 2026-09-16: config table = global variables — Starting HP,
-- Starting Gold, Starting AP, Max AP, Daily AP Gain, Starting Weapon
-- ("all those at a minimum for the game").
--
-- Seeded values come ONLY from decided docs; undecided values stay NULL
-- until Spahrep/DJ set them (one UPDATE, no schema change — the point of
-- a config table):
--   starting_hp              = 1000  (docs/combat-system.md "Player Stats")
--   starter_weapon_template_id = 8  (SSS, live DB; FK-guarded)
--   starting_gold / AP columns = NULL (no decided value anywhere — AP is
--   "X per 24-hour period (exact X TBD)" per docs/ap-economy.md)

-- 1. Add the global-variable columns. NULLable: values without a decision
--    yet must not force an invented number into the schema.
alter table public.game_config
  add column if not exists starting_hp       integer,
  add column if not exists starting_gold     integer,
  add column if not exists starting_ap       integer,
  add column if not exists max_ap            integer,
  add column if not exists daily_ap_gain     integer;

-- 2. Seed the decided values only.
update public.game_config set starting_hp = 1000 where id = 1;
