-- Migration: Add weapon_instance table for tracking generated weapons
-- Created: 2026-09-03
-- Purpose: Store instances of weapons generated from templates
--            (rolled stats + selected attack slots per instance)

-- ============================================================
-- 1. Create weapon_instance table
-- ============================================================

create table if not exists public.weapon_instance (
  id              bigint     primary key generated always as identity,
  user_id         uuid       not null references auth.users on delete cascade,
  template_id     bigint     not null references public.weapon_template on delete cascade,
  
  -- Rolled stats (generated via normal distribution around template base values)
  damage          int        not null,
  speed           int        not null,
  accuracy        int        not null,
  
  -- Granted attacks from conditional slot rolls
  -- Slot 0 ("Attack") is always present — not stored as a column
  -- Slot 1: Always rolled (chance only affects pool selection, not whether slot activates)
  -- Slots 2-4: Only checked if the previous slot succeeded
  slot_1_attack_id bigint     references public.attack,
  slot_2_attack_id bigint     references public.attack,
  slot_3_attack_id bigint     references public.attack,
  slot_4_attack_id bigint     references public.attack,
  
  -- Metadata
  created_at      timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at      timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for common queries
create index if not exists idx_weapon_instance_user_id on public.weapon_instance(user_id);
create index if not exists idx_weapon_instance_template_id on public.weapon_instance(template_id);

-- ============================================================
-- 2. Enable RLS
-- ============================================================

alter table public.weapon_instance enable row level security;

create policy "Users can view their own weapon instances"
  on public.weapon_instance for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weapon instances"
  on public.weapon_instance for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weapon instances"
  on public.weapon_instance for update
  using (auth.uid() = user_id);

create policy "Users can delete their own weapon instances"
  on public.weapon_instance for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. Updated at trigger
-- ============================================================

create trigger handle_weapon_instance_updated_at
  before update on public.weapon_instance
  for each row execute function public.handle_weapon_updated_at();