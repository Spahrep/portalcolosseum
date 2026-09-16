-- PC-52r2: move the starter-template marker out of weapon_template into a
-- single-row game_config table (the DB-native equivalent of a config file).
-- Rationale (Spahrep 2026-09-16): "which template is the starter" is a
-- game-level fact, not a property of each weapon row. A flag column on every
-- template row is the wrong shape; a one-row config table carries the same
-- info with zero columns on the 99% of rows that aren't the starter, plus an
-- FK so the configured starter can never point at a nonexistent template.
-- A literal .json file is NOT an option here: the grant runs inside the
-- handle_new_user trigger, and Postgres cannot read files from disk.

-- 1. Drop the is_starter column and its uniqueness index (added in 20260916010000).
drop index if exists weapon_template_one_starter;
alter table public.weapon_template
  drop column if exists is_starter;

-- 2. Single-row config table. CHECK (id = 1) enforces at most one row.
create table if not exists public.game_config (
  id integer primary key check (id = 1),
  starter_weapon_template_id bigint not null references weapon_template(id),
  updated_at timestamptz not null default now()
);

-- 3. Seed the one row: the starter is the SSS template.
--    Looked up by unique name (not hardcoded id) so fresh DBs that seed
--    the template with a different id still resolve correctly.
insert into public.game_config (id, starter_weapon_template_id)
select 1, id from public.weapon_template where name = 'SSS'
on conflict (id) do nothing;

-- 4. Grant trigger reads the starter id from game_config instead of the flag.
--    Same body as before, only the template lookup changed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sss_template_id bigint;
  tmpl record;
  d int; s int; a int;
  zd numeric; zs numeric; za numeric; z numeric;
  g char(1);
  has_weapon int;
begin
  -- profile insert (original behavior preserved)
  insert into public.profiles (id, username)
  values (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'username')::varchar(32),
      (NEW.raw_user_meta_data->>'preferred_username')::varchar(32),
      split_part(NEW.email, '@', 1)::varchar(32)
    )
  );

  -- PC-52r2 SSS grant: starter template id comes from game_config.
  select starter_weapon_template_id into sss_template_id from public.game_config limit 1;
  if sss_template_id is null then
    return NEW;
  end if;

  select count(*) into has_weapon from weapon_instance where user_id = NEW.id and template_id = sss_template_id;
  if has_weapon > 0 then
    return NEW;
  end if;

  select * into tmpl from weapon_template where id = sss_template_id;

  -- rollStat(base, range) exact replica (range<=0 returns base clamped >=1)
  if coalesce(tmpl.damage_range, 0) <= 0 then
    d := greatest(1, tmpl.base_damage);
  else
    d := greatest(1, tmpl.base_damage + floor(random() * (tmpl.damage_range * 2 + 1)) - tmpl.damage_range);
  end if;
  if coalesce(tmpl.speed_range, 0) <= 0 then
    s := greatest(1, tmpl.base_speed);
  else
    s := greatest(1, tmpl.base_speed + floor(random() * (tmpl.speed_range * 2 + 1)) - tmpl.speed_range);
  end if;
  if coalesce(tmpl.accuracy_range, 0) <= 0 then
    a := greatest(1, tmpl.base_accuracy);
  else
    a := greatest(1, tmpl.base_accuracy + floor(random() * (tmpl.accuracy_range * 2 + 1)) - tmpl.accuracy_range);
  end if;

  -- grade computation exact (zs uses inverted sign for speed)
  zd := case when tmpl.damage_range > 0 then (d - tmpl.base_damage)::numeric / tmpl.damage_range else 0 end;
  zs := case when tmpl.speed_range > 0 then (tmpl.base_speed - s)::numeric / tmpl.speed_range else 0 end;
  za := case when tmpl.accuracy_range > 0 then (a - tmpl.base_accuracy)::numeric / tmpl.accuracy_range else 0 end;
  z := (zd + zs + za) / 3;
  g := case when z >= 3 then 'S'
            when z >= 2 then 'A'
            when z >= 1 then 'B'
            when z >= 0 then 'C'
            when z >= -1 then 'D'
            when z >= -2 then 'E'
            else 'F' end;

  insert into public.weapon_instance (user_id, template_id, slot_0_attack_id, damage, speed, accuracy, grade)
  values (NEW.id, sss_template_id, coalesce(tmpl.slot_0_attack_id, 1), d, s, a, g);

  return NEW;
end;
$$;
