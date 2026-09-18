-- PC-67: backfill SSS starter weapon for every existing account
-- Mirrors handle_new_user() grant logic exactly (PC-52r2): idempotent
-- existence guard + exact roll + grade (rollStat replica). SSS has zero
-- deltas so the roll is deterministic (5/20/70, grade C), but the full
-- replica is kept so this stays correct if the starter template changes.
do $$
declare
  sss_template_id bigint;
  tmpl record;
  d int; s int; a int;
  zd numeric; zs numeric; za numeric; z numeric;
  g char(1);
  has_weapon int;
  u record;
begin
  select id into sss_template_id from public.weapon_template where name = 'SSS' limit 1;
  if sss_template_id is null then
    raise notice 'SSS template missing; nothing to backfill';
    return;
  end if;

  select * into tmpl from public.weapon_template where id = sss_template_id;

  for u in
    select id from auth.users
    where not exists (
      select 1 from public.weapon_instance wi
      where wi.user_id = auth.users.id and wi.template_id = sss_template_id
    )
  loop
    -- rollStat replica (range<=0 returns base clamped >=1)
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
    values (u.id, sss_template_id, coalesce(tmpl.slot_0_attack_id, 1), d, s, a, g);
  end loop;
end $$;
