import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260914143600_consumables_v2_pc37.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

// Seed templates per the LOCKED design (docs/consumables.md, decided 2026-09-08).
// Kept in sync with the migration's seed section.
const SEED_TEMPLATES = [
  { name: 'Health Potion', effect_type: 'heal', floor_base: 90, floor_delta: 10, window_base: 20, window_delta: 10, speed_base: 2, speed_delta: 1, duration_ticks: null },
  { name: 'Damage Tonic', effect_type: 'damage', floor_base: 5, floor_delta: 2, window_base: 3, window_delta: 2, speed_base: 1, speed_delta: 1, duration_ticks: 8 },
  { name: 'Swift Tonic', effect_type: 'speed', floor_base: 2, floor_delta: 1, window_base: 1, window_delta: 1, speed_base: 1, speed_delta: 1, duration_ticks: 8 },
  { name: 'Accuracy Tonic', effect_type: 'accuracy', floor_base: 10, floor_delta: 5, window_base: 5, window_delta: 5, speed_base: 1, speed_delta: 1, duration_ticks: 8 },
];

test('seed set matches locked design: exactly the 4 templates, no Smoke Bomb, no buff', () => {
  for (const t of SEED_TEMPLATES) {
    assert.ok(migrationSql.includes(`'${t.name}'`), `missing seed ${t.name}`);
  }
  // Smoke Bomb is a PMVP throwable, hard-deleted from prod 2026-09-14. The migration
  // may mention it only in the explicit DELETE that retires it (plus a doc comment) —
  // it must NEVER appear in an INSERT that could resurrect it.
  assert.ok(migrationSql.includes("DELETE FROM public.consumable_template WHERE name = 'Smoke Bomb';"),
    'Smoke Bomb must be explicitly deleted');
  assert.ok(!/INSERT[^;]*Smoke Bomb/i.test(migrationSql), 'Smoke Bomb must not be re-seeded');
  const sqlLines = migrationSql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.ok(!sqlLines.includes("'buff'"), "effect_type 'buff' must not appear in executable SQL");
});

test('RPC contract: SECURITY DEFINER, auth.uid() only, no caller-supplied user_id', () => {
  assert.ok(migrationSql.includes('SECURITY DEFINER'), 'RPC must be SECURITY DEFINER');
  assert.ok(migrationSql.includes('auth.uid()'), 'RPC must derive user from auth.uid()');
  assert.ok(migrationSql.includes("RAISE EXCEPTION 'Not authenticated'"), 'RPC must reject unauthenticated calls');
  assert.ok(!/p_user_id|p_userid/i.test(migrationSql), 'RPC must NOT accept a caller-supplied user_id');
});
