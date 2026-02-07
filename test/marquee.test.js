import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Set up DOM globals before importing Marquee
function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sign"></div></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.performance = { now: () => Date.now() };
  global.WebSocket = class { constructor() {} close() {} };
  return dom;
}

// Must setup DOM before importing
setupDOM();
const { Marquee } = await import('../src/index.js');

describe('Marquee class', () => {
  beforeEach(() => {
    setupDOM();
    // Reset style injection flag
    Marquee._stylesInjected = false;
  });

  it('constructs with a CSS selector', () => {
    const m = new Marquee('#sign', {});
    assert.ok(m.container);
    assert.ok(m.renderer);
    assert.ok(m.timeline);
    m.destroy();
  });

  it('constructs with a DOM element', () => {
    const el = document.getElementById('sign');
    const m = new Marquee(el, {});
    assert.equal(m.container, el);
    m.destroy();
  });

  it('throws for missing element', () => {
    assert.throws(() => new Marquee('#nonexistent', {}), /element not found/);
  });

  it('applies preset options', () => {
    const m = new Marquee('#sign', { preset: 'led-14' });
    assert.equal(m.options.led, true);
    assert.ok(m._presetColors);
    assert.equal(m._presetColors.length, 14);
    m.destroy();
  });

  it('sequence returns this for chaining', () => {
    const m = new Marquee('#sign', {});
    const result = m.sequence([{ text: 'A', phase: 'pause', duration: 100 }]);
    assert.equal(result, m);
    m.destroy();
  });

  it('play/pause/stop return this', () => {
    const m = new Marquee('#sign', {});
    m.sequence([{ text: 'A', phase: 'pause', duration: 100 }]);
    assert.equal(m.play(), m);
    assert.equal(m.pause(), m);
    assert.equal(m.stop(), m);
    m.destroy();
  });

  it('setText changes text', () => {
    const m = new Marquee('#sign', {});
    m.setText('HELLO', { phase: 'pause', duration: 100 });
    assert.ok(m.timeline.stepConfigs);
    assert.equal(m.timeline.stepConfigs[0].text, 'HELLO');
    m.destroy();
  });

  it('on/off/emit event system', () => {
    const m = new Marquee('#sign', {});
    let received = null;
    const handler = (data) => { received = data; };
    m.on('test', handler);
    m.emit('test', { hello: true });
    assert.deepEqual(received, { hello: true });
    m.off('test', handler);
    received = null;
    m.emit('test', { hello: true });
    assert.equal(received, null);
    m.destroy();
  });

  it('static presets lists available presets', () => {
    const presets = Marquee.presets;
    assert.ok(Array.isArray(presets));
    assert.ok(presets.includes('flip-tile'));
    assert.ok(presets.includes('led-14'));
    assert.ok(presets.includes('led-rgb'));
  });

  it('setTheme rebuilds renderer', () => {
    const m = new Marquee('#sign', { preset: 'led-14' });
    const oldRenderer = m.renderer;
    m.setTheme({ preset: 'flip-tile' });
    assert.notEqual(m.renderer, oldRenderer);
    assert.ok(m._presetColors);
    assert.equal(m._presetColors[0], '#33cc33');
    m.destroy();
  });

  it('supports simple text in constructor options', () => {
    const m = new Marquee('#sign', { text: 'HELLO', phase: 'pause', duration: 100 });
    assert.ok(m.timeline.stepConfigs);
    assert.equal(m.timeline.stepConfigs[0].text, 'HELLO');
    m.destroy();
  });

  it('destroy cleans up', () => {
    const m = new Marquee('#sign', {});
    m.destroy();
    assert.deepEqual(m._listeners, {});
  });
});
