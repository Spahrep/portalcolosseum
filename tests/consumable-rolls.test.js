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

// Mirrors the DB RPC roll math (generate_consumable_instance):
//   floor  = floor_base + rand[0..floor_delta]
//   window = window_base + rand[0..window_delta]   (+only: never negative)
//   speed  = speed_base + rand[0..speed_delta]
//   EV     = floor + window/2; grade = template-relative z-score bell curve
function roll(t) {
  const floor = t.floor_base + Math.floor(Math.random() * (t.floor_delta + 1));
  const window = t.window_base + Math.floor(Math.random() * (t.window_delta + 1));
  const speed = t.speed_base + Math.floor(Math.random() * (t.speed_delta + 1));
  const expEv = t.floor_base + t.floor_delta / 2 + (t.window_base + t.window_delta / 2) / 2;
  const sigma = Math.max((t.window_base + t.window_delta) / 2, 1);
  const z = (floor + window / 2 - expEv) / sigma;
  const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
  return { floor, window, speed, grade };
}

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

test('roll bounds hold for all 4 templates: +only deltas, window never negative', () => {
  for (const t of SEED_TEMPLATES) {
    for (let i = 0; i < 200; i++) {
      const r = roll(t);
      assert.ok(r.floor >= t.floor_base && r.floor <= t.floor_base + t.floor_delta,
        `${t.name}: floor out of range ${r.floor}`);
      assert.ok(r.window >= t.window_base && r.window <= t.window_base + t.window_delta,
        `${t.name}: window out of range ${r.window}`);
      assert.ok(r.window >= 0, `${t.name}: +only violated (negative window)`);
      assert.ok(r.speed >= t.speed_base && r.speed <= t.speed_base + t.speed_delta,
        `${t.name}: speed out of range ${r.speed}`);
    }
  }
});

test('grade is monotonic in rolled EV: higher roll never grades lower', () => {
  const t = SEED_TEMPLATES[0];
  const expEv = t.floor_base + t.floor_delta / 2 + (t.window_base + t.window_delta / 2) / 2;
  const sigma = Math.max((t.window_base + t.window_delta) / 2, 1);
  let prevRank = -Infinity;
  for (const bonus of [-12, -8, -4, -2, -1, 0, 1, 2, 4, 8, 12]) {
    const z = bonus / sigma;
    const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
    const rank = 'FEDCBAS'.indexOf(grade);
    assert.ok(rank >= prevRank, `grade regressed at bonus ${bonus} (EV ${expEv + bonus}): ${grade}`);
    prevRank = rank;
  }
});

test('RPC contract: SECURITY DEFINER, auth.uid() only, no caller-supplied user_id', () => {
  assert.ok(migrationSql.includes('SECURITY DEFINER'), 'RPC must be SECURITY DEFINER');
  assert.ok(migrationSql.includes('auth.uid()'), 'RPC must derive user from auth.uid()');
  assert.ok(migrationSql.includes("RAISE EXCEPTION 'Not authenticated'"), 'RPC must reject unauthenticated calls');
  assert.ok(!/p_user_id|p_userid/i.test(migrationSql), 'RPC must NOT accept a caller-supplied user_id');
});
