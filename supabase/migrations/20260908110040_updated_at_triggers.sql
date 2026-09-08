-- Migration: Standard updated_at trigger function + triggers for all tables with updated_at column
-- Created: 2026-09-08
-- Purpose: Ensure updated_at is automatically maintained on UPDATE for tables that have the column.
-- Tables covered (verified from migrations): profiles, attack, weapon_template, weapon_instance, player_inventory
-- Mapping tables (weapon_template_attack, monster_template_attack_mapping, portal_monster_mapping, portal_loot_mapping) do NOT have updated_at column, so no triggers added.
-- Note: Replaces previous ad-hoc handle_*_updated_at functions/triggers with the canonical set_updated_at().

-- Drop old trigger names if they exist (from earlier migrations)
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS handle_attack_updated_at ON public.attack;
DROP TRIGGER IF EXISTS handle_weapon_template_updated_at ON public.weapon_template;
DROP TRIGGER IF EXISTS handle_weapon_instance_updated_at ON public.weapon_instance;
DROP TRIGGER IF EXISTS handle_player_inventory_updated_at ON public.player_inventory;

-- Drop old functions (will be recreated as set_updated_at)
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.handle_weapon_updated_at();

-- ============================================================
-- 1. Canonical set_updated_at() function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS 'Standard trigger function: sets NEW.updated_at = now() on UPDATE for any table with updated_at column.';

-- ============================================================
-- 2. Triggers on every table that has updated_at column
-- ============================================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attack
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.weapon_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.weapon_instance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.player_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();