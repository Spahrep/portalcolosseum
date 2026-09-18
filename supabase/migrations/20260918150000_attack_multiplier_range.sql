-- PC-65: Add base_damage_multiplier_range to attack table
-- Storage: base ± range (like damage_range, accuracy_range)
-- Default 0 = no variance (existing behavior)
ALTER TABLE public.attack
  ADD COLUMN base_damage_multiplier_range float NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.attack.base_damage_multiplier_range IS '± range for base_damage_multiplier roll on attack; rollStat yields [base-range, base+range] clamped >=0; 0 = no range (existing behavior)';