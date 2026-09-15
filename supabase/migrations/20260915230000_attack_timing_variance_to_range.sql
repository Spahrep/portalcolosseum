-- Migration: Rename attack timing variance columns to *_range
-- Created: 2026-09-15
-- Purpose: Consistent vocabulary — the ± spread around a base stat is called
--   "range" on weapon_template.damage_range / monster_template.damage_range.
--   "variance" is used only for speed; "delta" in the schema means +only
--   (max_hp_delta = uniform(0..delta)), which is misleading for a ± field.
--   Follows the damage_range precedent (same concept: base ± range).

alter table public.attack
  rename constraint attack_prepare_time_variance_nonneg to attack_prepare_time_range_nonneg;

alter table public.attack
  rename constraint attack_cooldown_time_variance_nonneg to attack_cooldown_time_range_nonneg;

alter table public.attack
  rename column prepare_time_variance to prepare_time_range;

alter table public.attack
  rename column cooldown_time_variance to cooldown_time_range;

comment on column public.attack.prepare_time_range is 'Range for prepare_time (windup); rollStat yields [base-range, base+range] clamped >=1; 0 = no range (existing behavior)';

comment on column public.attack.cooldown_time_range is 'Range for cooldown_time; rollStat yields [base-range, base+range] clamped >=1; 0 = no range (existing behavior)';
