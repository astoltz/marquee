import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, snapToPresetColor, getPresetDefaultColor } from '../src/presets.js';

describe('PRESETS', () => {
  const presetNames = [
    'flip-tile', 'flip-tile-yellow', 'bulb', 'bulb-theater',
    'led-mono', 'led-mono-green', 'led-mono-amber', 'led-14', 'led-rgb',
  ];

  it('contains all 9 base presets', () => {
    for (const name of presetNames) {
      assert.ok(PRESETS[name], `Missing preset: ${name}`);
    }
  });

  for (const name of presetNames) {
    describe(`preset: ${name}`, () => {
      const preset = PRESETS[name];

      it('has a background color', () => {
        assert.equal(typeof preset.background, 'string');
      });

      it('has dotShape', () => {
        assert.ok(['circle', 'square'].includes(preset.dotShape));
      });

      it('has numeric dotSize > 0', () => {
        assert.equal(typeof preset.dotSize, 'number');
        assert.ok(preset.dotSize > 0);
      });

      it('has numeric dotGap >= 0', () => {
        assert.equal(typeof preset.dotGap, 'number');
        assert.ok(preset.dotGap >= 0);
      });

      it('has offColor', () => {
        assert.equal(typeof preset.offColor, 'string');
      });

      it('has transitionStyle', () => {
        assert.ok(['instant', 'warm', 'flip'].includes(preset.transitionStyle));
      });

      it('colors is array or null', () => {
        assert.ok(preset.colors === null || Array.isArray(preset.colors));
      });
    });
  }
});

describe('getPresetDefaultColor', () => {
  it('returns first color for flip-tile', () => {
    assert.equal(getPresetDefaultColor('flip-tile'), '#33cc33');
  });

  it('returns null for led-rgb (unrestricted)', () => {
    assert.equal(getPresetDefaultColor('led-rgb'), null);
  });

  it('returns null for unknown preset', () => {
    assert.equal(getPresetDefaultColor('nonexistent'), null);
  });
});

describe('snapToPresetColor distances', () => {
  it('red snaps to red in led-14', () => {
    assert.equal(snapToPresetColor('#ff0000', PRESETS['led-14'].colors), '#ff0000');
  });

  it('pure white snaps to white in led-14', () => {
    assert.equal(snapToPresetColor('#ffffff', PRESETS['led-14'].colors), '#ffffff');
  });

  it('any color snaps to green in flip-tile (mono)', () => {
    assert.equal(snapToPresetColor('#ff0000', PRESETS['flip-tile'].colors), '#33cc33');
    assert.equal(snapToPresetColor('#0000ff', PRESETS['flip-tile'].colors), '#33cc33');
  });
});
