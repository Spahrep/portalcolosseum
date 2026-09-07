-- Monster generation schema
-- Mirrors weapon_template/weapon_instance structure but for combat encounters
-- Shares attack table with weapons, but has its own template/instance/mapping tables

-- Monster templates: define base stats, slot chances, and base attack
CREATE TABLE monster_template (
    id bigint primary key generated always as identity,
    name text not null,
    
    base_damage int not null,
    damage_range int not null,
    base_speed int not null,
    speed_variance int not null,
    base_accuracy int not null,
    accuracy_range int not null,
    
    -- Slot 0: mandatory base attack (FK to attack.id)
    slot_0_attack_id bigint not null references attack(id),
    -- Slots 1-4: chance thresholds (0.0 - 1.0)
    slot_1_chance real default 0,
    slot_2_chance real default 0,
    slot_3_chance real default 0,
    slot_4_chance real default 0,
    
    created_at timestamp with time zone default now()
);

-- Monster template -> attack mapping (weighted, slot-specific)
-- Separate from weapon_template_attack_mapping per requirement
CREATE TABLE monster_template_attack_mapping (
    id bigint primary key generated always as identity,
    monster_template_id bigint not null references monster_template(id) on delete cascade,
    attack_id bigint not null references attack(id),
    slot int not null check (slot between 1 and 4),
    weight real not null default 1.0,
    
    created_at timestamp with time zone default now(),
    
    constraint monster_template_attack_mapping_unique 
        unique (monster_template_id, attack_id, slot)
);

-- Instantiated monsters: generated with rolled stats and resolved attacks
-- No user_id -- monsters are environmental encounters, not player-owned
CREATE TABLE monster_instance (
    id bigint primary key generated always as identity,
    template_id bigint not null references monster_template(id),
    
    -- Rolled stats
    damage int not null,
    speed int not null,
    accuracy int not null,
    
    -- Resolved attacks (slot 0 always present from template FK)
    slot_0_attack_id bigint not null references attack(id),
    slot_1_attack_id bigint null references attack(id),
    slot_2_attack_id bigint null references attack(id),
    slot_3_attack_id bigint null references attack(id),
    slot_4_attack_id bigint null references attack(id),
    
    created_at timestamp with time zone default now()
);

-- Indexes for performance
CREATE INDEX idx_monster_template_attack_mapping_template 
    ON monster_template_attack_mapping(monster_template_id, slot);
CREATE INDEX idx_monster_instance_template 
    ON monster_instance(template_id);

-- Monster generation functions
-- Mirrors generate_weapon() structure but for monster encounters

-- Helper: Resolve a random attack for a given monster template and slot
-- Uses weighted random selection based on monster_template_attack_mapping.weight
create or replace function get_random_monster_attack_for_slot(p_template_id bigint, p_slot int)
returns jsonb as $func$
declare
    v_total_weight double precision;
    v_roll double precision;
    v_selected_attack_id bigint;
begin
    -- Calculate total weight for all eligible attacks in this slot
    select sum(m.weight::double precision)
    into v_total_weight
    from monster_template_attack_mapping m
    where m.monster_template_id = p_template_id
      and m.slot = p_slot;

    -- If no attacks are mapped or total weight is 0/null, return null
    if v_total_weight is null or v_total_weight = 0 then
        return null;
    end if;

    -- Roll a random value between 0 and total_weight
    v_roll := random() * v_total_weight;

    -- Select the attack using cumulative weights
    select m.attack_id
    into v_selected_attack_id
    from (
        select 
            m.attack_id,
            sum(m.weight::double precision) over (
                order by m.id
                rows between unbounded preceding and current row
            ) as cumulative_weight
        from monster_template_attack_mapping m
        where m.monster_template_id = p_template_id
          and m.slot = p_slot
        order by m.id
    ) m
    where m.cumulative_weight > v_roll
    limit 1;

    -- Fallback: if edge case, pick first attack
    if v_selected_attack_id is null then
        select m.attack_id
        into v_selected_attack_id
        from monster_template_attack_mapping m
        where m.monster_template_id = p_template_id
          and m.slot = p_slot
        order by m.id
        limit 1;
    end if;

    if v_selected_attack_id is null then
        return null;
    end if;

    -- Get the full attack row as JSONB
    return (
        select to_jsonb(a)
        from attack a
        where a.id = v_selected_attack_id
        limit 1
    );
end;
$func$ language plpgsql volatile set search_path = public, pg_temp;

-- Main: Generate a monster instance from a template
-- Returns JSON with rolled stats and selected per-slot attacks
create or replace function generate_monster(p_template_id bigint)
returns jsonb as $func$
declare
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;

    v_row monster_instance%rowtype;
begin
    -- Fetch template
    select *
    into v_tmpl
    from monster_template
    where id = p_template_id;

    if not found then
        raise exception 'Monster template id % not found', p_template_id;
    end if;

    -- Fetch slot 0 attack (mandatory, comes directly from template FK)
    select to_jsonb(a)
    into v_attack0
    from attack a
    where a.id = v_tmpl.slot_0_attack_id
    limit 1;

    -- Roll stats using normal distribution (Box-Muller)
    v_damage := normal_int(v_tmpl.base_damage, v_tmpl.damage_range);
    v_speed := normal_int(v_tmpl.base_speed, v_tmpl.speed_variance);
    v_accuracy := normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range);

    -- Slot 1: Always granted, weighted random from mapping table
    v_attack1 := get_random_monster_attack_for_slot(p_template_id, 1);

    -- Slot 2: conditional chain
    if random() < coalesce(v_tmpl.slot_1_chance, 0) then
        v_attack2 := get_random_monster_attack_for_slot(p_template_id, 2);
    end if;

    if v_attack2 is not null and random() < coalesce(v_tmpl.slot_2_chance, 0) then
        v_attack3 := get_random_monster_attack_for_slot(p_template_id, 3);
    end if;

    if v_attack3 is not null and random() < coalesce(v_tmpl.slot_3_chance, 0) then
        v_attack4 := get_random_monster_attack_for_slot(p_template_id, 4);
    end if;

    -- Build result as JSON
    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    -- Persist to monster_instance (always persisted -- monsters are encounters)
    insert into monster_instance (
        template_id, damage, speed, accuracy,
        slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
    )
    values (
        p_template_id,
        v_damage,
        v_speed,
        v_accuracy,
        nullif(v_attack0->>'id', '')::bigint,
        nullif(v_attack1->>'id', '')::bigint,
        nullif(v_attack2->>'id', '')::bigint,
        nullif(v_attack3->>'id', '')::bigint,
        nullif(v_attack4->>'id', '')::bigint
    )
    returning id, created_at
    into v_row.id, v_row.created_at;

    -- Merge persist-only fields into the result object
    v_result := v_result || jsonb_build_object(
        'id', v_row.id,
        'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    return v_result;
end;
$func$ language plpgsql volatile set search_path = public, pg_temp;
