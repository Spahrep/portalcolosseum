import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHpWord } from '../js/combat/hp-words.js';

describe('HP words', () => {
  it('band boundaries exact', () => {
    assert.equal(getHpWord(100, 100), 'Healthy');
    assert.equal(getHpWord(76, 100), 'Healthy');
    assert.equal(getHpWord(75, 100), 'Injured');
    assert.equal(getHpWord(51, 100), 'Injured');
    assert.equal(getHpWord(50, 100), 'Battered');
    assert.equal(getHpWord(26, 100), 'Battered');
    assert.equal(getHpWord(25, 100), 'Critical');
    assert.equal(getHpWord(0, 100), 'Critical');
  });
});
