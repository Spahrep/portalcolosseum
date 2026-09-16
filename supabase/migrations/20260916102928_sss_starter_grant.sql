-- PC-52r2: idempotent SSS starter grant inside handle_new_user
-- Template seed (idempotent; row also exists in live DB as created by PM, id 8)
-- Stats per Spahrep directive 2026-09-16: damage 5 delta 0, speed 20 delta 0, accuracy 70 delta 0
insert into public.weapon_template (name, weapon_type, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range, slot_0_attack_id)
values ('SSS', 'sword', 5, 0, 20, 0, 70, 0, 1)
on conflict (name) do nothing;

-- Grant trigger: idempotent existence guard + exact roll + grade (rollStat replica)
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

  -- PC-52r2 SSS grant: idempotent existence guard + exact roll + grade
  select id into sss_template_id from weapon_template where name = 'SSS' limit 1;
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
