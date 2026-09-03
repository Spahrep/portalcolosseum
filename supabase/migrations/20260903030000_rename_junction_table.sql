-- Migration: Rename weapon_template_attack to weapon_template_attack_mapping
-- Reason: Align with naming convention documented in docs/weapon-generation.md
-- The table serves as a mapping between weapon templates and their eligible attacks
-- per slot pool, so the _mapping suffix makes the junction table's purpose explicit

alter table public.weapon_template_attack rename to weapon_template_attack_mapping;