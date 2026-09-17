-- PC-63: RLS lockdown — the anon key alone must not reach any public table.
-- Browser code never queries tables directly (all DB access is service-role
-- via the API/edge functions), so anon/authenticated grants are dead weight.
--
-- 1) game_config: the ONLY table with RLS disabled (Spahrep 2026-09-17).
--    Enable RLS + revoke everything from anon and authenticated. No policies
--    needed: deny-by-default is correct for a service-role-only table.
-- 2) Six RLS-protected tables still carry anon grants from early dev (policies
--    already deny anon all rows, but TRUNCATE/TRIGGER/REFERENCES bypass RLS —
--    a real data-loss hole). Revoke all anon grants so "anon key alone"
--    resolves to zero privileges on every public table.
--    NOTE: authenticated grants are intentionally left intact on these tables
--    (admin/user policies are the designed access path there).

alter table public.game_config enable row level security;

revoke all on table public.game_config from anon, authenticated;

revoke all on table
  public.consumable_instance,
  public.consumable_template,
  public.monster_loot_mapping,
  public.portal_loot_mapping,
  public.portal_monster_mapping,
  public.portal_template
from anon;
