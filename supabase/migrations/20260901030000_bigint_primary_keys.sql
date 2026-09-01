-- Migration: Convert game tables from UUID to BIGINT primary keys
-- Created: 2026-09-01
-- Purpose: Game data tables (attack, weapon_template, weapon_template_attack)
-- use BIGINT auto-increment IDs for readability and performance.
-- The profiles table keeps UUID because it must reference auth.users (Supabase Auth).

-- Since no application code references these tables yet (combat is unimplemented)
-- and all seed data is in re-runnable SQL, we can safely drop and recreate.

-- ============================================================
-- 1. Drop junction table first (depends on the two main tables)
-- ============================================================
drop table if exists public.weapon_template_attack cascade;
drop index if exists idx_weapon_template_attack_unique;
drop index if exists idx_weapon_template_attack_wt_id;
drop index if exists idx_weapon_template_attack_atk_id;
drop index if exists idx_weapon_template_attack_slot;

-- ============================================================
-- 2. Drop the two main tables
-- ============================================================
drop table if exists public.weapon_template cascade;
drop table if exists public.attack cascade;
drop index if exists idx_attack_weapon_type;
drop index if exists idx_weapon_template_type;

-- Old sequences (auto-created by UUID PK — actually gen_random_uuid
-- doesn't create a sequence, but clean up any leftovers)
drop sequence if exists public.attack_id_seq;
drop sequence if exists public.weapon_template_id_seq;
drop sequence if exists public.weapon_template_attack_id_seq;

-- ============================================================
-- 3. Recreate tables with BIGINT auto-increment primary keys
-- ============================================================

-- ATTACK TABLE
create table if not exists public.attack (
  id              bigint    primary key generated always as identity,
  name            text      not null unique,
  description     text,
  attack_type     text      not null check (attack_type in ('simple', 'advanced', 'magic', 'multi_enemy', 'buff', 'debuff')),
  base_damage_multiplier   float    not null default 1.0,
  prepare_time    int       not null default 10,
  cooldown_time   int       not null default 10,
  is_multi_target boolean   not null default false,
  is_spell        boolean   not null default false,
  weight          float     not null default 1.0,
  allowed_weapon_types text[],
  created_at      timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at      timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.attack is 'All attacks available for weapon generation (simple, advanced, magic, multi-enemy, buffs/debuffs)';
comment on column public.attack.id is 'BigInt auto-increment primary key (better readability in logs/debugging than UUID)';
comment on column public.attack.is_spell is 'If true, this attack is only eligible for optional (Slot 3) pools, not guaranteed slots';
comment on column public.attack.allowed_weapon_types is 'NULL means all weapon types; otherwise this attack is restricted to the listed types';

-- WEAPON_TEMPLATE TABLE
create table if not exists public.weapon_template (
  id              bigint    primary key generated always as identity,
  name            text      not null unique,
  weapon_type     text      not null,
  base_damage     int       not null,
  damage_range    int       not null default 0,
  base_speed      int       not null,
  speed_variance  int       not null default 0,
  base_accuracy   int       not null,
  accuracy_range  int       not null default 0,
  slot_1_pool     text[]    not null default '{}',
  slot_2_pool     text[]    not null default '{}',
  slot_3_pool     text[]    not null default '{}',
  slot_1_chance   float     not null default 1.0,
  slot_2_chance   float     not null default 0.8,
  slot_3_chance   float     not null default 0.4,
  created_at      timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at      timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.weapon_template is 'Weapon definitions with procedurally-generated stat ranges and attack slot pools (3-slot system)';
comment on column public.weapon_template.id is 'BigInt auto-increment primary key (better readability in logs/debugging than UUID)';
comment on column public.weapon_template.slot_1_pool is 'Attacks eligible for Slot 1 (always granted, chance=1.0) — base attack pool';
comment on column public.weapon_template.slot_2_pool is 'Attacks eligible for Slot 2 (default 80% chance) — secondary attack pool';
comment on column public.weapon_template.slot_3_pool is 'Attacks eligible for Slot 3 (default 40% chance) — rare/strongest attack pool';
comment on column public.weapon_template.slot_1_chance is 'Probability (0.0–1.0) of Slot 1 activating (default 1.0 = always)';
comment on column public.weapon_template.slot_2_chance is 'Probability (0.0–1.0) of Slot 2 activating (default 0.8)';
comment on column public.weapon_template.slot_3_chance is 'Probability (0.0–1.0) of Slot 3 activating (default 0.4)';

-- WEAPON_TEMPLATE_ATTACK MAPPING TABLE
create table if not exists public.weapon_template_attack (
  id               bigint    primary key generated always as identity,
  weapon_template_id bigint  not null references public.weapon_template(id) on delete cascade,
  attack_id        bigint    not null references public.attack(id) on delete cascade,
  slot             int       not null check (slot in (1, 2, 3)),
  created_at       timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.weapon_template_attack is 'Mapping weapon templates to attacks, identifying which slot pool each attack belongs to';
comment on column public.weapon_template_attack.id is 'BigInt auto-increment primary key — formal relational link';

-- ============================================================
-- 4. Recreate indexes
-- ============================================================
create index if not exists idx_attack_weapon_type on public.attack using GIN (allowed_weapon_types);
create index if not exists idx_weapon_template_type on public.weapon_template(weapon_type);
create unique index if not exists idx_weapon_template_attack_unique on public.weapon_template_attack(weapon_template_id, attack_id);
create index if not exists idx_weapon_template_attack_wt_id on public.weapon_template_attack(weapon_template_id);
create index if not exists idx_weapon_template_attack_atk_id on public.weapon_template_attack(attack_id);
create index if not exists idx_weapon_template_attack_slot on public.weapon_template_attack(slot);

-- ============================================================
-- 5. Recreate RLS policies (same as original)
-- ============================================================

-- ATTACK TABLE
alter table public.attack enable row level security;
create policy "Authenticated users can view all attacks"
  on public.attack for select
  using (auth.role() = 'authenticated');
create policy "Only service_role can modify attacks"
  on public.attack for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- WEAPON_TEMPLATE TABLE
alter table public.weapon_template enable row level security;
create policy "Authenticated users can view all weapon templates"
  on public.weapon_template for select
  using (auth.role() = 'authenticated');
create policy "Only service_role can modify weapon templates"
  on public.weapon_template for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- WEAPON_TEMPLATE_ATTACK MAPPING TABLE
alter table public.weapon_template_attack enable row level security;
create policy "Authenticated users can view weapon template attack mappings"
  on public.weapon_template_attack for select
  using (auth.role() = 'authenticated');
create policy "Only service_role can modify weapon template attack mappings"
  on public.weapon_template_attack for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- 6. Recreate updated_at trigger (same logic as original)
-- ============================================================
create or replace function public.handle_weapon_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger handle_attack_updated_at
  before update on public.attack
  for each row execute function public.handle_weapon_updated_at();

create trigger handle_weapon_template_updated_at
  before update on public.weapon_template
  for each row execute function public.handle_weapon_updated_at();

-- ============================================================
-- 7. Re-insert seed data (same as 20260901020000_seed_attacks.sql)
--    Note: seed inserts now use name-based lookups instead of UUID references
-- ============================================================

-- ATTACK SEED DATA
insert into public.attack (name, description, attack_type, base_damage_multiplier, prepare_time, cooldown_time, is_multi_target, is_spell, weight) values
  ('Attack', 'A basic weapon strike using your weapon''s base stats.', 'simple', 1.0, 10, 10, false, false, 1.0),
  ('Heavy Chop', 'A slow but powerful overhead strike.', 'advanced', 1.5, 18, 15, false, false, 0.8),
  ('Quick Slash', 'A fast, light strike with reduced damage.', 'simple', 0.7, 6, 5, false, false, 1.2),
  ('Precision Strike', 'A carefully aimed thrust that has a higher chance to hit.', 'advanced', 1.2, 15, 12, false, false, 0.6);

insert into public.attack (name, description, attack_type, base_damage_multiplier, prepare_time, cooldown_time, is_multi_target, is_spell, weight) values
  ('Cleave', 'Swing your weapon in a wide arc, hitting enemies on both sides.', 'multi_enemy', 1.0, 14, 15, true, false, 0.9),
  ('Whirlwind', 'Spin in place, striking all adjacent enemies.', 'multi_enemy', 0.9, 20, 25, true, false, 0.7),
  ('Triple Strike', 'Deliver three rapid slashes in sequence, hitting the same target multiple times.', 'advanced', 0.75, 25, 20, false, false, 0.5);

insert into public.attack (name, description, attack_type, base_damage_multiplier, prepare_time, cooldown_time, is_multi_target, is_spell, weight) values
  ('Power Attack', 'Channel raw strength into a devastating blow. High damage, slow to execute.', 'advanced', 2.0, 25, 30, false, true, 0.5),
  ('Fireball', 'Hurl a ball of flame that explodes on impact, dealing fire damage to the target.', 'magic', 1.3, 18, 20, false, true, 0.8),
  ('Arcane Bolt', 'A concentrated bolt of arcane energy that pierces armor.', 'magic', 1.1, 12, 15, false, true, 1.0),
  ('Lightning Rod', 'Summon a bolt of lightning from above, striking the target with electrical damage.', 'magic', 1.4, 16, 22, false, true, 0.6),
  ('Ice Shard', 'Launch sharp icicles that may slow the target''s attack speed.', 'magic', 1.0, 10, 15, false, true, 0.7);

insert into public.attack (name, description, attack_type, prepare_time, cooldown_time, is_spell, weight) values
  ('Battle Cry', 'Let out a fearsome shout, briefly increasing your damage output.', 'buff', 8, 30, true, 0.5),
  ('Adrenaline Rush', 'Enter a brief state of heightened reflexes, increasing attack speed.', 'buff', 10, 35, true, 0.4);

insert into public.attack (name, description, attack_type, prepare_time, cooldown_time, is_spell, weight) values
  ('Shield Bash', 'Bash the target with your shield, interrupting their current action and reducing their accuracy.', 'debuff', 12, 20, true, 0.6),
  ('Weaken Strike', 'Strike the target to reduce their damage output for a short time.', 'debuff', 14, 25, true, 0.5);

-- WEAPON_TEMPLATE SEED DATA
insert into public.weapon_template (
  name, weapon_type, base_damage, damage_range, base_speed, speed_variance,
  base_accuracy, accuracy_range,
  slot_1_pool, slot_2_pool, slot_3_pool,
  slot_1_chance, slot_2_chance, slot_3_chance
) values
  ('Wristblade', 'dagger', 25, 5, 18, 2, 88, 4,
    ARRAY['Attack'], ARRAY['Quick Slash', 'Precision Strike'], ARRAY['Power Attack'],
    1.0, 0.8, 0.15),
  ('Short Sword', 'sword', 35, 6, 27, 3, 85, 5,
    ARRAY['Attack'], ARRAY['Heavy Chop', 'Cleave'], ARRAY['Fireball'],
    1.0, 0.8, 0.4),
  ('Greatsword', 'sword', 55, 8, 35, 4, 82, 6,
    ARRAY['Attack'], ARRAY['Heavy Chop', 'Whirlwind'], ARRAY['Lightning Rod'],
    1.0, 0.85, 0.45),
  ('Hand Axe', 'axe', 32, 5, 29, 3, 84, 5,
    ARRAY['Attack'], ARRAY['Heavy Chop', 'Cleave'], ARRAY['Ice Shard'],
    1.0, 0.75, 0.35),
  ('Battle Axe', 'axe', 50, 7, 38, 4, 80, 6,
    ARRAY['Attack'], ARRAY['Whirlwind', 'Power Attack'], ARRAY['Arcane Bolt'],
    1.0, 0.9, 0.5),
  ('Quarterstaff', 'staff', 28, 4, 24, 2, 87, 4,
    ARRAY['Attack'], ARRAY['Arcane Bolt', 'Ice Shard'], ARRAY['Fireball'],
    1.0, 0.8, 0.5),
  ('Warhammer', 'hammer', 42, 6, 33, 3, 83, 5,
    ARRAY['Attack'], ARRAY['Heavy Chop', 'Shield Bash'], ARRAY['Adrenaline Rush'],
    1.0, 0.85, 0.4);

-- WEAPON-TEMPLATE-ATTACK MAPPING (name-based lookups now work with int IDs)
insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Wristblade' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Wristblade' and a.name IN ('Quick Slash', 'Precision Strike');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Short Sword' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Short Sword' and a.name IN ('Heavy Chop', 'Cleave');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Greatsword' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Greatsword' and a.name IN ('Heavy Chop', 'Whirlwind');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Hand Axe' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Hand Axe' and a.name IN ('Heavy Chop', 'Cleave');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Battle Axe' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Battle Axe' and a.name IN ('Whirlwind', 'Power Attack');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Quarterstaff' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Quarterstaff' and a.name IN ('Arcane Bolt', 'Ice Shard');

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 1
  from public.weapon_template wt, public.attack a
  where wt.name = 'Warhammer' and a.name = 'Attack';

insert into public.weapon_template_attack (weapon_template_id, attack_id, slot)
  select wt.id, a.id, 2
  from public.weapon_template wt, public.attack a
  where wt.name = 'Warhammer' and a.name IN ('Heavy Chop', 'Shield Bash');
