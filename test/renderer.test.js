import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Renderer } from '../src/renderer.js';

function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sign"></div></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  global.performance = { now: () => Date.now() };
  return dom.window.document.getElementById('sign');
}

describe('Renderer (modern mode)', () => {
  let container;

  beforeEach(() => {
    container = setupDOM();
  });

  it('sets up modern mode by default', () => {
    const r = new Renderer(container, { led: false, fontSize: 32 });
    assert.ok(container.classList.contains('marquee-container'));
    assert.ok(container.querySelector('.marquee-text'));
    r.destroy();
  });

  it('renders text with character spans', () => {
    const r = new Renderer(container, { led: false, fontSize: 32 });
    r.render({
      text: 'AB',
      offsetX: 0,
      offsetY: 0,
      opacity: 1,
      visible: true,
      colors: ['#ff0000', '#00ff00'],
      progress: 0,
    });
    const chars = container.querySelectorAll('.marquee-char');
    assert.equal(chars.length, 2);
    assert.equal(chars[0].textContent, 'A');
    assert.equal(chars[1].textContent, 'B');
    r.destroy();
  });

  it('applies per-character colors', () => {
    const r = new Renderer(container, { led: false, fontSize: 32 });
    r.render({
      text: 'AB',
      offsetX: 0, offsetY: 0, opacity: 1, visible: true,
      colors: ['#ff0000', '#00ff00'],
      progress: 0,
    });
    const chars = container.querySelectorAll('.marquee-char');
    // jsdom normalizes hex colors to rgb()
    assert.ok(chars[0].style.color, 'char 0 should have a color');
    assert.ok(chars[1].style.color, 'char 1 should have a color');
    r.destroy();
  });

  it('sets visibility for flash', () => {
    const r = new Renderer(container, { led: false, fontSize: 32 });
    r.render({
      text: 'HI', offsetX: 0, offsetY: 0, opacity: 1, visible: false,
      colors: ['#ff0000', '#ff0000'], progress: 0,
    });
    const textEl = container.querySelector('.marquee-text');
    assert.equal(textEl.style.visibility, 'hidden');
    r.destroy();
  });

  it('destroy cleans up', () => {
    const r = new Renderer(container, { led: false, fontSize: 32 });
    r.destroy();
    assert.equal(container.innerHTML, '');
    assert.ok(!container.classList.contains('marquee-container'));
  });
});

describe('Renderer (LED mode)', () => {
  let container;

  beforeEach(() => {
    container = setupDOM();
  });

  it('creates a dot grid', () => {
    const r = new Renderer(container, {
      led: true, cols: 10, rows: 7, dotSize: 4, dotGap: 1,
      background: '#111', offColor: '#1a1a1a',
    });
    const dots = container.querySelectorAll('.marquee-dot');
    assert.equal(dots.length, 70); // 10 * 7
    r.destroy();
  });

  it('adds marquee-led class', () => {
    const r = new Renderer(container, {
      led: true, cols: 10, rows: 7, dotSize: 4, dotGap: 1,
      background: '#111', offColor: '#1a1a1a',
    });
    assert.ok(container.classList.contains('marquee-led'));
    r.destroy();
  });

  it('getContainerWidth returns grid pixel width', () => {
    const r = new Renderer(container, {
      led: true, cols: 10, rows: 7, dotSize: 4, dotGap: 1,
      background: '#111', offColor: '#1a1a1a',
    });
    // 10 * 4 + 9 * 1 = 49
    assert.equal(r.getContainerWidth(), 49);
    r.destroy();
  });

  it('measureText in LED mode', () => {
    const r = new Renderer(container, {
      led: true, cols: 10, rows: 7, dotSize: 4, dotGap: 1,
      background: '#111', offColor: '#1a1a1a',
    });
    // 'AB' = 2 chars * 6 char_width * 5 pxPerDot = 60
    const w = r.measureText('AB');
    assert.equal(w, 60); // 2 * 6 * (4+1) = 60
    r.destroy();
  });
});
