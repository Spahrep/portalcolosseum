import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, weightedPick } from '../js/pure-utils.js';

describe('escapeHtml', () => {
  it('happy path: escapes basic HTML', () => {
    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('edge: empty string/null/undefined', () => {
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
  it('edge: special chars', () => {
    assert.equal(escapeHtml('a&b"c\'d'), 'a&amp;b&quot;c&#39;d');
  });
});

describe('weightedPick', () => {
  it('happy path: selects from pool', () => {
    const pool = [{id:1, w:1}, {id:2, w:2}];
    const res = weightedPick(pool, x => x.w);
    assert.ok(res && (res.id === 1 || res.id === 2));
  });
  it('edge: empty pool returns null', () => {
    assert.equal(weightedPick([], x => x.w), null);
  });
  it('edge: zero/negative weights ignored or handled as 0', () => {
    const pool = [{id:1, w:0}, {id:2, w:-1}, {id:3, w:1}];
    const res = weightedPick(pool, x => x.w);
    assert.equal(res.id, 3);
  });
  it('edge: bounds respected (single item)', () => {
    assert.equal(weightedPick([{id:42, w:5}], x => x.w).id, 42);
  });
});
