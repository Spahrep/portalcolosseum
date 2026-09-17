-- ============================================================
-- Fix: SSS starter weapon has no attack mappings
-- ============================================================
-- Root cause: the SSS starter template (weapon_template id 8, added by
-- 20260916102928_sss_starter_grant.sql) was seeded with only
-- slot_0_attack_id = 1. Every other template has its base attack mapped
-- in weapon_template_attack_mapping (attack 1 on slot 1), but template 8
-- never received its row.
--
-- Effect: /api/combat weaponInfo() builds the hand menu's attack list from
-- weapon_template_attack_mapping, so an SSS-equipped hand rendered zero
-- selectable attacks. The turn could never commit -> combat softlocked
-- after the die roll for any player using the SSS (new signups get it via
-- handle_new_user, so this was a latent prod bug, not just the manual grant).
--
-- Fix: seed the same base-attack mapping every other template has
-- (attack id 1 = "Attack", slot 1, weight 1). Safe to re-run; the unique
-- index on (weapon_template_id, attack_id) guards duplicates.

INSERT INTO public.weapon_template_attack_mapping (weapon_template_id, attack_id, slot, weight)
VALUES (8, 1, 1, 1.0)
ON CONFLICT (weapon_template_id, attack_id) DO NOTHING;
