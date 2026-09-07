CREATE TABLE portal_template (
  id bigint primary key generated always as identity,
  name text not null,
  tier integer not null default 1,
  description text,
  green_dice_count integer not null default 4,
  yellow_dice_count integer not null default 3,
  red_dice_count integer not null default 3,
  green_faces integer[] not null default '{10,10,10,20,20,30}',
  yellow_faces integer[] not null default '{10,10,20,20,30,30}',
  red_faces integer[] not null default '{10,20,20,30,30,30}',
  created_at timestamptz not null default now()
);

CREATE TABLE portal_monster_mapping (
  id bigint primary key generated always as identity,
  portal_template_id bigint not null references portal_template(id) on delete cascade,
  monster_template_id bigint not null references monster_template(id) on delete restrict,
  point_cost integer not null,
  weight real not null default 1.0,
  created_at timestamptz not null default now(),
  unique(portal_template_id, monster_template_id)
);

CREATE TABLE portal_loot_mapping (
  id bigint primary key generated always as identity,
  portal_template_id bigint not null references portal_template(id) on delete cascade,
  item_name text not null,
  lp_cost integer not null,
  weight real not null default 1.0,
  created_at timestamptz not null default now(),
  unique(portal_template_id, item_name)
);
