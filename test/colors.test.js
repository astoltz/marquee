import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveColors, normalizeColor, dimColor } from '../src/colors.js';
import { snapToPresetColor } from '../src/presets.js';

describe('normalizeColor', () => {
  it('passes through 6-digit hex', () => {
    assert.equal(normalizeColor('#ff3300'), '#ff3300');
  });

  it('lowercases hex', () => {
    assert.equal(normalizeColor('#FF3300'), '#ff3300');
  });

  it('expands 3-digit hex', () => {
    assert.equal(normalizeColor('#f30'), '#ff3300');
  });

  it('resolves named colors', () => {
    assert.equal(normalizeColor('red'), '#ff0000');
    assert.equal(normalizeColor('green'), '#00ff00');
    assert.equal(normalizeColor('blue'), '#0000ff');
    assert.equal(normalizeColor('amber'), '#ffaa00');
  });

  it('passes through rgb/hsl', () => {
    assert.equal(normalizeColor('rgb(255,0,0)'), 'rgb(255,0,0)');
    assert.equal(normalizeColor('hsl(0,100%,50%)'), 'hsl(0,100%,50%)');
  });

  it('returns default for null/undefined', () => {
    assert.equal(normalizeColor(null), '#ff3300');
    assert.equal(normalizeColor(undefined), '#ff3300');
  });
});

describe('dimColor', () => {
  it('dims to black at factor 0', () => {
    assert.equal(dimColor('#ffffff', 0), '#000000');
  });

  it('returns same color at factor 1', () => {
    assert.equal(dimColor('#ff3300', 1), '#ff3300');
  });

  it('dims by half', () => {
    assert.equal(dimColor('#ff0000', 0.5), '#800000');
  });
});

describe('resolveColors', () => {
  it('fills a single color for all chars', () => {
    const result = resolveColors('#ff0000', 'abc', 0, null);
    assert.deepEqual(result, ['#ff0000', '#ff0000', '#ff0000']);
  });

  it('wraps an array of colors', () => {
    const result = resolveColors(['#ff0000', '#00ff00'], 'abcd', 0, null);
    assert.deepEqual(result, ['#ff0000', '#00ff00', '#ff0000', '#00ff00']);
  });

  it('calls a function per character', () => {
    const fn = (i, ch) => ch === 'a' ? '#ff0000' : '#00ff00';
    const result = resolveColors(fn, 'ab', 0, null);
    assert.deepEqual(result, ['#ff0000', '#00ff00']);
  });

  it('uses default color for null config', () => {
    const result = resolveColors(null, 'ab', 0, null);
    assert.deepEqual(result, ['#ff3300', '#ff3300']);
  });

  it('snaps to preset palette', () => {
    const presetColors = ['#ff0000', '#00ff00'];
    const result = resolveColors('#ff1111', 'a', 0, presetColors);
    assert.equal(result[0], '#ff0000');
  });
});

describe('snapToPresetColor', () => {
  it('returns exact match', () => {
    assert.equal(snapToPresetColor('#ff0000', ['#ff0000', '#00ff00']), '#ff0000');
  });

  it('snaps to nearest color', () => {
    assert.equal(snapToPresetColor('#ff1100', ['#ff0000', '#0000ff']), '#ff0000');
  });

  it('returns input when no preset colors', () => {
    assert.equal(snapToPresetColor('#abcdef', null), '#abcdef');
    assert.equal(snapToPresetColor('#abcdef', []), '#abcdef');
  });

  it('snaps to single-color palette', () => {
    assert.equal(snapToPresetColor('#ffffff', ['#33cc33']), '#33cc33');
  });
});
