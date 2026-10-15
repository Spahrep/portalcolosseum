-- AP daily reset (PC-DEC-073): 100 AP per elapsed day, cap 500, lazy grant-on-access 
-- at screen/state transitions + client backstop.
-- Spahrep 2026-10-15: cadence 00:00 GMT, start 250, 100/day (config), cap 500 (config), 
-- missed days accumulate. Checks fire only on screen switches (store, run start). All decided.

-- 1. Player-side: track the last reset date the player has been granted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_ap date;

COMMENT ON COLUMN public.profiles.last_daily_ap IS
  'Last 00:00 GMT reset date whose daily AP grant has been applied. NULL = never granted (treat as today).';

-- 2. Config values (columns already exist from 20260916104221).
UPDATE public.game_config
SET starting_ap   = 250,
    max_ap        = 500,
    daily_ap_gain = 100
WHERE id = 1;

-- 3. New-player seed: start at starting_ap (config) and mark today granted.
--    MUST be the winning definition — a CREATE OR REPLACE FUNCTION executed
--    last in this file. Preserves the full existing body (SSS starter-grant
--    from 20260916103520) and only changes the profile insert.
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
  start_ap int;
begin
  -- profile insert (original behavior preserved, but seed AP from config and
  -- mark today as the grant date so a fresh player starts whole on day one).
  select coalesce(starting_ap, 250) into start_ap from public.game_config limit 1;

  insert into public.profiles (id, username, ap, last_daily_ap)
  values (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'username')::varchar(32),
      (NEW.raw_user_meta_data->>'preferred_username')::varchar(32),
      split_part(NEW.email, '@', 1)::varchar(32)
    ),
    start_ap,
    current_date
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
