-- PC-100: per-run gold entry cost on portal_template.
-- Design (portal-runs.md): a run costs X AP + Y gold. ap_cost already exists.
-- Deduction is PC-99. This column only stores the amount. Default 0 so
-- Default 0 so existing portals stay free until an admin sets a price.

ALTER TABLE public.portal_template
  ADD COLUMN IF NOT EXISTS entry_gold_cost integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.portal_template.entry_gold_cost IS
  'Gold charged to enter one run of this portal (Y in "X AP + Y gold"). 0 = free. Deduction lives in the API, not in this column.';
