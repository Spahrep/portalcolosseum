-- Migration: Add slot_4 pools and chances to weapon_template
-- Slot 0 is always "Attack" (default, not stored)
-- Slots 1-4 each have configurable _chance and _pool from weapon_template
-- Max attacks on a weapon = 1 (slot 0) + up to 4 (slots 1-4) = 5

alter table weapon_template
    add column if not exists slot_4_pool text[] default '{}',
    add column if not exists slot_4_chance double precision default 0;

-- Add documentation comment
comment on table weapon_template is 'Weapon generation template. Slot 0 is always Attack. Slots 1-4 each have configurable _chance and _pool.';
comment on column weapon_template.slot_4_pool is 'Attack names that can roll for slot 4 (e.g. [Power Attack, Battle Cry])';
comment on column weapon_template.slot_4_chance is 'Probability (0.0-1.0) that slot 4 is granted when generating a weapon instance';
