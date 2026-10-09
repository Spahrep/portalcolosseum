import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTimingMarkers } from '../js/combat/tic-queue.js';

describe('PC-56 timing markers (computeTimingMarkers)', () => {
  // Mockup semantics (dw-app.js:220-261): single '>' on first row tics >= maxT
  // when nothing strictly inside (minT < tics < maxT); bounding pair (last
  // before minT + first after maxT) when something IS strictly inside.
  // Window is multiplicative: minT = weaponSpeed * prepare_time_multiplier,
  // maxT = minT + weaponSpeed * prepare_time_multiplier_range.
  // 1.5 ± 1 at speed 2 => window 3..5, same bounds the old flat 3±2 cases used.
  const mk = (tics) => tics.map((t, i) => ({ id: `r${i}`, tics: t }));
  const atk = { prepare_time_multiplier: 1.5, prepare_time_multiplier_range: 1 };
  const speed = 2;

  it('empty queue returns []', () => {
    assert.strictEqual(computeTimingMarkers([], atk, speed), null);
  });

  it('nothing strictly inside -> bar on first row at/after maxT', () => {
    const q = mk([1, 2, 5, 6]); // minT=3, maxT=5; tics=5 is inside (inclusive)
    const res = computeTimingMarkers(q, atk, speed);
    assert.deepEqual(res, { kind: 'bar', firstId: 'r2', lastId: 'r2', minT: 3, maxT: 5, hasInside: true });
  });

  it('row strictly inside -> bar spans the inside row', () => {
    const q = mk([1, 2, 4, 6]); // tics=4 strictly inside (3<4<5)
    const res = computeTimingMarkers(q, atk, speed);
    assert.deepEqual(res, { kind: 'bar', firstId: 'r2', lastId: 'r2', minT: 3, maxT: 5, hasInside: true });
  });

  it('boundary tics exactly at minT/maxT are inside (inclusive) -> bar spans boundaries', () => {
    const q = mk([3, 5]); // tics==3 (minT) and tics==5 (maxT) both >= minT and <= maxT
    const res = computeTimingMarkers(q, atk, speed);
    assert.deepEqual(res, { kind: 'bar', firstId: 'r0', lastId: 'r1', minT: 3, maxT: 5, hasInside: true });
  });

  it('all rows strictly inside -> bar spans the innermost pair', () => {
    const q = mk([0, 3.5, 4, 9]);
    const res = computeTimingMarkers(q, atk, speed);
    assert.deepEqual(res, { kind: 'bar', firstId: 'r1', lastId: 'r2', minT: 3, maxT: 5, hasInside: true });
  });

  it('no row at/after maxT and nothing inside -> bar in gap (hasInside=false)', () => {
    const q = mk([1, 2]); // maxT=5, nothing >= 5
    const res = computeTimingMarkers(q, atk, speed);
    assert.deepEqual(res, { kind: 'bar', firstId: 'r1', lastId: 'r1', minT: 3, maxT: 5, hasInside: false });
  });

  it('weaponSpeed scales the window (total = weaponSpeed × prepare multiplier)', () => {
    const q = mk([5, 6]);
    // speed 2: window 3..5, tics=5 inside -> bar on r0
    assert.deepEqual(computeTimingMarkers(q, atk, 2), { kind: 'bar', firstId: 'r0', lastId: 'r0', minT: 3, maxT: 5, hasInside: true });
    // speed 5: window 7.5..12.5, nothing >= 7.5 -> gap bar
    assert.deepEqual(computeTimingMarkers(q, atk, 5), { kind: 'bar', firstId: 'r1', lastId: 'r1', minT: 7.5, maxT: 12.5, hasInside: false });
    // speed 3: window 4.5..7.5, tics=5 and tics=6 both inside -> bar spans both
    assert.deepEqual(computeTimingMarkers(q, atk, 3), { kind: 'bar', firstId: 'r0', lastId: 'r1', minT: 4.5, maxT: 7.5, hasInside: true });
  });
});
