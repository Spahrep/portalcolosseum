-- PC-107: Attack timing multipliers (prepare/cooldown) + ranges.
-- Flat tick additions are meaningless on slow weapons. Timing is now a pure
-- multiplier on weapon/monster speed:
--   castTicks = speed * rollMultiplier(prepare_time_multiplier, range)
--   cooldown  = speed * rollMultiplier(cooldown_time_multiplier, range)
-- 1.0 = exactly base speed, 1.5 = 50% slower, 0.7 = 30% faster.
-- Existing prepare_time / cooldown_time columns are kept for backward-compat.
-- The engine no longer reads them for timing. Do NOT drop or alter them.
-- Do not apply here — PM applies after review.

ALTER TABLE public.attack
  ADD COLUMN prepare_time_multiplier float NOT NULL DEFAULT 1.0,
  ADD COLUMN prepare_time_multiplier_range float NOT NULL DEFAULT 0,
  ADD COLUMN cooldown_time_multiplier float NOT NULL DEFAULT 1.0,
  ADD COLUMN cooldown_time_multiplier_range float NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.attack.prepare_time_multiplier IS 'Multiplier on weapon/monster speed for attack windup; 1.0 = exactly base speed; rollMultiplier(base, range) yields the factor';
COMMENT ON COLUMN public.attack.prepare_time_multiplier_range IS '± range for prepare_time_multiplier roll; rollMultiplier yields [base-range, base+range] clamped >=0; 0 = no range';
COMMENT ON COLUMN public.attack.cooldown_time_multiplier IS 'Multiplier on weapon/monster speed for attack cooldown; 1.0 = exactly base speed; rollMultiplier(base, range) yields the factor';
COMMENT ON COLUMN public.attack.cooldown_time_multiplier_range IS '± range for cooldown_time_multiplier roll; rollMultiplier yields [base-range, base+range] clamped >=0; 0 = no range';

-- Tuning constants (PC-107). Derived from the former flat prepare/cooldown
-- relative to a reference weapon speed of ~29 (average of seeded weapon
-- speeds 18-38). All *_multiplier_range stay 0 (no variance — matches the
-- current flat rows, whose ranges are 0).
UPDATE public.attack SET
  prepare_time_multiplier = 1.0,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.0,
  cooldown_time_multiplier_range = 0
WHERE name = 'Attack';

UPDATE public.attack SET
  prepare_time_multiplier = 1.6,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.5,
  cooldown_time_multiplier_range = 0
WHERE name = 'Heavy Chop';

UPDATE public.attack SET
  prepare_time_multiplier = 0.6,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 0.5,
  cooldown_time_multiplier_range = 0
WHERE name = 'Quick Slash';

UPDATE public.attack SET
  prepare_time_multiplier = 1.4,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.2,
  cooldown_time_multiplier_range = 0
WHERE name = 'Precision Strike';

UPDATE public.attack SET
  prepare_time_multiplier = 1.4,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.5,
  cooldown_time_multiplier_range = 0
WHERE name = 'Cleave';

UPDATE public.attack SET
  prepare_time_multiplier = 1.8,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 2.0,
  cooldown_time_multiplier_range = 0
WHERE name = 'Whirlwind';

UPDATE public.attack SET
  prepare_time_multiplier = 2.0,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.8,
  cooldown_time_multiplier_range = 0
WHERE name = 'Triple Strike';

UPDATE public.attack SET
  prepare_time_multiplier = 2.0,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 2.2,
  cooldown_time_multiplier_range = 0
WHERE name = 'Power Attack';

UPDATE public.attack SET
  prepare_time_multiplier = 1.6,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.8,
  cooldown_time_multiplier_range = 0
WHERE name = 'Fireball';

UPDATE public.attack SET
  prepare_time_multiplier = 1.2,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.4,
  cooldown_time_multiplier_range = 0
WHERE name = 'Arcane Bolt';

UPDATE public.attack SET
  prepare_time_multiplier = 1.5,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.8,
  cooldown_time_multiplier_range = 0
WHERE name = 'Lightning Rod';

UPDATE public.attack SET
  prepare_time_multiplier = 1.0,
  prepare_time_multiplier_range = 0,
  cooldown_time_multiplier = 1.4,
  cooldown_time_multiplier_range = 0
WHERE name = 'Ice Shard';
