import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPhase, PHASE_REGISTRY } from '../src/phases.js';

describe('PHASE_REGISTRY', () => {
  it('contains all 12 built-in phases', () => {
    const expected = [
      'scroll-left', 'scroll-right', 'flash', 'pause',
      'float-up', 'float-down', 'fade-in', 'fade-out',
      'wipe-in', 'wipe-out', 'slide-in', 'slide-out',
    ];
    for (const name of expected) {
      assert.ok(PHASE_REGISTRY[name], `Missing phase: ${name}`);
    }
  });
});

describe('createPhase', () => {
  it('throws on unknown phase', () => {
    assert.throws(() => createPhase({ phase: 'nonexistent' }, 500, 100, null, null), /Unknown phase/);
  });
});

describe('scroll-left phase', () => {
  it('produces valid state shape', () => {
    const phase = createPhase(
      { text: 'HELLO', phase: 'scroll-left', color: '#ff0000', speed: 100, until: 'center' },
      500, 100, null, null
    );
    phase.start();
    const state = phase.getState();
    assert.equal(state.text, 'HELLO');
    assert.equal(typeof state.offsetX, 'number');
    assert.equal(state.opacity, 1);
    assert.equal(state.visible, true);
    assert.ok(Array.isArray(state.colors));
    assert.equal(state.colors.length, 5);
    assert.equal(typeof state.progress, 'number');
  });

  it('completes when reaching target', () => {
    const phase = createPhase(
      { text: 'HI', phase: 'scroll-left', color: '#ff0000', speed: 10000, until: 'center' },
      100, 20, null, null
    );
    phase.start();
    let done = false;
    for (let i = 0; i < 100 && !done; i++) {
      done = phase.update(100);
    }
    assert.ok(done, 'scroll-left should complete');
    assert.ok(phase.getState().progress >= 1);
  });
});

describe('scroll-right phase', () => {
  it('produces valid state', () => {
    const phase = createPhase(
      { text: 'HI', phase: 'scroll-right', color: '#ff0000', speed: 100 },
      500, 50, null, null
    );
    phase.start();
    assert.equal(phase.getState().text, 'HI');
  });
});

describe('flash phase', () => {
  it('toggles visibility', () => {
    const phase = createPhase(
      { text: 'FLASH', phase: 'flash', times: 2, interval: 100, color: '#ff0000' },
      500, 100, null, null
    );
    phase.start();
    assert.equal(phase.getState().visible, true);
    phase.update(100); // first toggle
    phase.update(100); // second toggle
    // After some toggles, should eventually complete
    let done = false;
    for (let i = 0; i < 20 && !done; i++) {
      done = phase.update(100);
    }
    assert.ok(done, 'flash should complete');
  });
});

describe('pause phase', () => {
  it('completes after duration', () => {
    const phase = createPhase(
      { text: 'WAIT', phase: 'pause', duration: 500 },
      500, 80, null, null
    );
    phase.start();
    assert.equal(phase.update(250), false);
    assert.equal(phase.update(250), true);
  });

  it('preserves previous state text', () => {
    const prevState = { text: 'PREV', offsetX: 50, offsetY: 0 };
    const phase = createPhase(
      { phase: 'pause', duration: 100 },
      500, 80, prevState, null
    );
    phase.start();
    assert.equal(phase.getState().text, 'PREV');
  });
});

describe('float-up phase', () => {
  it('moves text upward', () => {
    const phase = createPhase(
      { text: 'UP', phase: 'float-up', duration: 500, distance: 60, color: '#ff0000' },
      500, 40, null, null
    );
    phase.start();
    const startY = phase.getState().offsetY;
    phase.update(500);
    assert.ok(phase.getState().offsetY < startY);
  });
});

describe('float-down phase', () => {
  it('moves text downward', () => {
    const phase = createPhase(
      { text: 'DOWN', phase: 'float-down', duration: 500, distance: 60, color: '#ff0000' },
      500, 60, null, null
    );
    phase.start();
    const startY = phase.getState().offsetY;
    phase.update(500);
    assert.ok(phase.getState().offsetY > startY);
  });
});

describe('fade-in phase', () => {
  it('starts at opacity 0 and ends at 1', () => {
    const phase = createPhase(
      { text: 'FADE', phase: 'fade-in', duration: 500, color: '#ff0000' },
      500, 80, null, null
    );
    phase.start();
    assert.equal(phase.getState().opacity, 0);
    phase.update(500);
    const op = phase.getState().opacity;
    assert.ok(op >= 0.99, `Expected opacity ~1, got ${op}`);
  });
});

describe('fade-out phase', () => {
  it('starts at opacity 1 and ends at 0', () => {
    const phase = createPhase(
      { text: 'FADE', phase: 'fade-out', duration: 500, color: '#ff0000' },
      500, 80, null, null
    );
    phase.start();
    assert.equal(phase.getState().opacity, 1);
    phase.update(500);
    const op = phase.getState().opacity;
    assert.ok(op <= 0.01, `Expected opacity ~0, got ${op}`);
  });
});

describe('wipe-in phase', () => {
  it('has wipeProgress from 0 to 1', () => {
    const phase = createPhase(
      { text: 'WIPE', phase: 'wipe-in', duration: 500, color: '#ff0000' },
      500, 80, null, null
    );
    phase.start();
    assert.equal(phase.getState().wipeProgress, 0);
    phase.update(500);
    assert.ok(phase.getState().wipeProgress >= 0.99);
  });
});

describe('wipe-out phase', () => {
  it('has wipeProgress from 1 to 0', () => {
    const phase = createPhase(
      { text: 'WIPE', phase: 'wipe-out', duration: 500, color: '#ff0000' },
      500, 80, null, null
    );
    phase.start();
    assert.equal(phase.getState().wipeProgress, 1);
    phase.update(500);
    assert.ok(phase.getState().wipeProgress <= 0.01);
  });
});

describe('slide-in phase', () => {
  it('slides to center', () => {
    const phase = createPhase(
      { text: 'SLIDE', phase: 'slide-in', duration: 500, color: '#ff0000' },
      500, 100, null, null
    );
    phase.start();
    const done = phase.update(500);
    assert.ok(done);
    // Should be centered: (500-100)/2 = 200
    const x = phase.getState().offsetX;
    assert.ok(Math.abs(x - 200) < 1, `Expected ~200, got ${x}`);
  });
});

describe('slide-out phase', () => {
  it('slides away from position', () => {
    const prevState = { text: 'SLIDE', offsetX: 200, offsetY: 0 };
    const phase = createPhase(
      { text: 'SLIDE', phase: 'slide-out', duration: 500, color: '#ff0000' },
      500, 100, prevState, null
    );
    phase.start();
    phase.update(500);
    const state = phase.getState();
    assert.ok(state.offsetX < 0 || state.offsetX > 500);
  });
});
