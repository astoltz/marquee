import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, EASINGS, DOT_FONT, CHAR_WIDTH, CHAR_HEIGHT } from '../src/defaults.js';

describe('DEFAULTS', () => {
  it('has expected default values', () => {
    assert.equal(DEFAULTS.led, false);
    assert.equal(DEFAULTS.cols, 80);
    assert.equal(DEFAULTS.rows, 12);
    assert.equal(DEFAULTS.speed, 120);
    assert.equal(DEFAULTS.duration, 1000);
    assert.equal(DEFAULTS.easing, 'linear');
    assert.equal(DEFAULTS.loop, false);
    assert.equal(DEFAULTS.preset, null);
    assert.equal(DEFAULTS.reconnect, true);
    assert.equal(DEFAULTS.reconnectInterval, 3000);
  });
});

describe('EASINGS', () => {
  it('linear returns input', () => {
    assert.equal(EASINGS.linear(0), 0);
    assert.equal(EASINGS.linear(0.5), 0.5);
    assert.equal(EASINGS.linear(1), 1);
  });

  it('ease-in starts slow', () => {
    assert.ok(EASINGS['ease-in'](0.5) < 0.5);
    assert.equal(EASINGS['ease-in'](0), 0);
    assert.equal(EASINGS['ease-in'](1), 1);
  });

  it('ease-out starts fast', () => {
    assert.ok(EASINGS['ease-out'](0.5) > 0.5);
    assert.equal(EASINGS['ease-out'](0), 0);
    assert.equal(EASINGS['ease-out'](1), 1);
  });

  it('ease-in-out is symmetric', () => {
    assert.equal(EASINGS['ease-in-out'](0), 0);
    assert.equal(EASINGS['ease-in-out'](1), 1);
    assert.ok(EASINGS['ease-in-out'](0.25) < 0.25);
    assert.ok(EASINGS['ease-in-out'](0.75) > 0.75);
  });

  it('step jumps at 1', () => {
    assert.equal(EASINGS.step(0), 0);
    assert.equal(EASINGS.step(0.5), 0);
    assert.equal(EASINGS.step(0.99), 0);
    assert.equal(EASINGS.step(1), 1);
  });
});

describe('DOT_FONT', () => {
  it('contains uppercase letters A-Z', () => {
    for (let code = 65; code <= 90; code++) {
      const char = String.fromCharCode(code);
      assert.ok(DOT_FONT[char], `Missing font for ${char}`);
      assert.equal(DOT_FONT[char].length, 7, `${char} should have 7 rows`);
    }
  });

  it('contains lowercase letters a-z', () => {
    for (let code = 97; code <= 122; code++) {
      const char = String.fromCharCode(code);
      assert.ok(DOT_FONT[char], `Missing font for ${char}`);
      assert.equal(DOT_FONT[char].length, 7, `${char} should have 7 rows`);
    }
  });

  it('contains digits 0-9', () => {
    for (let d = 0; d <= 9; d++) {
      const char = String(d);
      assert.ok(DOT_FONT[char], `Missing font for ${char}`);
      assert.equal(DOT_FONT[char].length, 7, `${char} should have 7 rows`);
    }
  });

  it('contains common punctuation', () => {
    const punctuation = ' .!?,-:;+=/()\'\"#$%&@*_';
    for (const ch of punctuation) {
      assert.ok(DOT_FONT[ch], `Missing font for "${ch}"`);
    }
  });

  it('each row fits in 5 bits', () => {
    for (const [char, rows] of Object.entries(DOT_FONT)) {
      for (let r = 0; r < rows.length; r++) {
        assert.ok(rows[r] >= 0 && rows[r] <= 0b11111, `${char} row ${r} exceeds 5 bits: ${rows[r]}`);
      }
    }
  });
});

describe('CHAR_WIDTH / CHAR_HEIGHT', () => {
  it('CHAR_WIDTH is 6 (5 dots + 1 gap)', () => {
    assert.equal(CHAR_WIDTH, 6);
  });

  it('CHAR_HEIGHT is 7', () => {
    assert.equal(CHAR_HEIGHT, 7);
  });
});
