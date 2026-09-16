-- PC-52r2: set the decided starting values on game_config.
-- Spahrep 2026-09-16: Starting gold = 0, Starting AP = 10.
-- Max AP and Daily AP Gain stay NULL until decided (ap-economy.md: X TBD).
update public.game_config set starting_gold = 0, starting_ap = 10 where id = 1;
