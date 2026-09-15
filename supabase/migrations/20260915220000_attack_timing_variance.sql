-- Migration: Add prepare_time_variance and cooldown_time_variance to attack table
-- Created: 2026-09-15
-- Purpose: Support ranged windup/cooldown for attacks (base ± variance); existing rows default to ±0 so behavior unchanged.
-- Follows style of 20260901030000_bigint_primary_keys.sql

alter table public.attack
  add column if not exists prepare_time_variance int not null default 0;

alter table public.attack
  add column if not exists cooldown_time_variance int not null default 0;

-- Explicitly named check constraints (non-negative variance only)
alter table public.attack
  add constraint attack_prepare_time_variance_nonneg check (prepare_time_variance >= 0);

alter table public.attack
  add constraint attack_cooldown_time_variance_nonneg check (cooldown_time_variance >= 0);

comment on column public.attack.prepare_time_variance is 'Variance range for prepare_time (windup); rollStat yields [base-variance, base+variance] clamped >=1; 0 = no variance (existing behavior)';
comment on column public.attack.cooldown_time_variance is 'Variance range for cooldown_time; rollStat yields [base-variance, base+variance] clamped >=1; 0 = no variance (existing behavior)';
