-- ============================================================
-- Enable RLS + admin-only policies on the 4 tables added in
-- portal-templates work that were left exposed (no RLS).
--
-- Tables: portal_template, portal_monster_mapping, portal_loot_mapping,
--         monster_loot_mapping
--
-- Read-access decision for portal_template:
--   - Verified: game-app.js contains ZERO .from('portal_template') or
--     equivalent client-side Supabase calls. All usage of these tables
--     is inside /api/admin/[...path].js (server-side, service-role key).
--   - Therefore SELECT is also restricted to admins only (same pattern
--     as monster_template, weapon_template, attack, etc.).
--   - Mapping tables are purely internal admin configuration data;
--     player-facing rolls and loot resolution happen server-side.
--
-- All policies follow the existing is_current_user_admin() pattern
-- from 20260905110000_security_admin_only_access.sql
-- ============================================================

-- --- portal_template ---
CREATE POLICY "Admins can manage portal_template"
  ON public.portal_template FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- portal_monster_mapping ---
CREATE POLICY "Admins can manage portal_monster_mapping"
  ON public.portal_monster_mapping FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- portal_loot_mapping ---
CREATE POLICY "Admins can manage portal_loot_mapping"
  ON public.portal_loot_mapping FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- monster_loot_mapping ---
CREATE POLICY "Admins can manage monster_loot_mapping"
  ON public.monster_loot_mapping FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Enable + force RLS (consistent with other tables)
ALTER TABLE public.portal_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_monster_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_loot_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monster_loot_mapping ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.portal_template FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_monster_mapping FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_loot_mapping FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monster_loot_mapping FORCE ROW LEVEL SECURITY;
