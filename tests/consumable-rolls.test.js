import test from 'node:test';
import assert from 'node:assert/strict';

// Simulated roll logic from consumable template (mirrors DB function for test)
function rollConsumableEffect(template) {
  const { floor_base, floor_delta, window_base, window_delta } = template;
  const floor = floor_base + Math.floor(Math.random() * (floor_delta + 1));
  const window = window_base + Math.floor(Math.random() * (window_delta + 1));
  return { floor, max: floor + window };
}

function getLabel(template, rolled) {
  return `${rolled.floor}+, up to ${rolled.max}`;
}

test('consumable roll produces floor within bounds and label format', () => {
  const tpl = { floor_base: 90, floor_delta: 10, window_base: 20, window_delta: 10 };
  for (let i = 0; i < 50; i++) {
    const r = rollConsumableEffect(tpl);
    assert.ok(r.floor >= 90 && r.floor <= 100, `floor out of range: ${r.floor}`);
    assert.ok(r.max >= r.floor + 20 && r.max <= r.floor + 30, `max out of range: ${r.max}`);
    const label = getLabel(tpl, r);
    assert.ok(label.includes('+,'), 'label missing +,');
    assert.ok(label.includes('up to'), 'label missing up to');
  }
});

test('consumable label preview matches expected format', () => {
  const tpl = { floor_base: 50, floor_delta: 5, window_base: 10, window_delta: 5 };
  const r = { floor: 52, max: 67 };
  assert.equal(getLabel(tpl, r), '52+, up to 67');
});
