import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Timeline } from '../src/timeline.js';

function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sign"></div></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  global.requestAnimationFrame = () => 0; // no-op for tests
  global.cancelAnimationFrame = () => {};
  // Use a simple performance.now to avoid jsdom recursion
  global.performance = { now: () => Date.now() };
  return dom;
}

function mockRenderer() {
  return {
    getContainerWidth: () => 500,
    measureText: (text) => (text || '').length * 30,
    render: () => {},
  };
}

describe('Timeline', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('starts in IDLE state', () => {
    const tl = new Timeline(mockRenderer(), {});
    assert.equal(tl.state, 0); // IDLE
  });

  it('setSequence resets state', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.setSequence([
      { text: 'A', phase: 'pause', duration: 100, color: '#ff0000' },
    ]);
    assert.equal(tl.currentIndex, 0);
    assert.deepEqual(tl.phases, []);
  });

  it('play transitions to PLAYING', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.setSequence([
      { text: 'A', phase: 'pause', duration: 100, color: '#ff0000' },
    ]);
    tl.play();
    assert.equal(tl.state, 1); // PLAYING
    tl.destroy();
  });

  it('pause transitions to PAUSED', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.setSequence([
      { text: 'A', phase: 'pause', duration: 1000, color: '#ff0000' },
    ]);
    tl.play();
    tl.pause();
    assert.equal(tl.state, 2); // PAUSED
    tl.destroy();
  });

  it('stop transitions to IDLE', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.setSequence([
      { text: 'A', phase: 'pause', duration: 1000, color: '#ff0000' },
    ]);
    tl.play();
    tl.stop();
    assert.equal(tl.state, 0); // IDLE
    tl.destroy();
  });

  it('emits phaseStart on play', () => {
    const tl = new Timeline(mockRenderer(), {});
    let emitted = false;
    tl.on('phaseStart', () => { emitted = true; });
    tl.setSequence([
      { text: 'A', phase: 'pause', duration: 100, color: '#ff0000' },
    ]);
    tl.play();
    assert.ok(emitted);
    tl.destroy();
  });

  it('does nothing when play is called with no sequence', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.play();
    assert.equal(tl.state, 0); // stays IDLE
  });

  it('destroy clears listeners', () => {
    const tl = new Timeline(mockRenderer(), {});
    tl.on('phaseStart', () => {});
    tl.destroy();
    assert.deepEqual(tl.listeners, {});
  });
});
