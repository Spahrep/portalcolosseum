/**
 * Portal Colosseum - Alpha Invite Keys Table
 * =================================================
 * Stores invite codes for the alpha signup system.
 * Each key can be used a limited number of times (one-time use for alpha).
 *
 * The hardcoded key "EyeOfTheWorld" is checked in the Edge Function via env var,
 * bypassing this table entirely (for testing purposes, unlimited uses).
 */

create table public.invite_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

-- Indexes for fast lookups
create index if not exists invite_keys_key_idx on public.invite_keys (key);
create index if not exists invite_keys_used_idx on public.invite_keys (used);
