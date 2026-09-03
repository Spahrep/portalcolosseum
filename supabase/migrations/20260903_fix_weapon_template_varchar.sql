-- Migration: Change text columns to varchar with explicit length limits
-- attack: name=32, description=255, attack_type=32
-- weapon_template: name=32, weapon_type=32
-- Slot chances (slot_1_chance, slot_2_chance, slot_3_chance) remain double precision

alter table attack
    alter column name type varchar(32),
    alter column description type varchar(255),
    alter column attack_type type varchar(32);

alter table weapon_template
    alter column name type varchar(32),
    alter column weapon_type type varchar(32);
