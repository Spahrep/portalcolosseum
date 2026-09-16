-- PC-52r2: mark the starter weapon template (SSS) explicitly in the DB.
-- The signup grant previously looked up the template by hardcoded name ('SSS').
-- Now the template row itself declares it is the starter, and the schema
-- enforces that at most one template can be the starter.

-- 1. Flag on the template row: either a template is the starter or it isn't.
alter table public.weapon_template
  add column if not exists is_starter boolean not null default false;

-- 2. At most one starter, enforced by the schema itself.
create unique index if not exists weapon_template_one_starter
  on public.weapon_template (is_starter)
  where is_starter;

-- 3. The SSS row is the starter. Idempotent: safe on fresh DBs (row seeded
--    by 20260916000000) and on the live DB (row inserted by the PM, id 8).
update public.weapon_template
  set is_starter = true
  where name = 'SSS';

-- 4. Grant trigger reads the flag instead of the name. Same body as before,
--    only the template lookup changed.
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

  -- PC-52r2 SSS grant: starter template is the one flagged is_starter = true.
  select id into sss_template_id from weapon_template where is_starter limit 1;
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
