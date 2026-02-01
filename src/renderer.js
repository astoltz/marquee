// Renderer — DOM rendering for modern text mode and LED dot-matrix mode
//
// Two rendering paths:
// 1. Modern: character spans with CSS transforms
// 2. LED: grid of dot divs with bitmap font

import { DOT_FONT, CHAR_WIDTH, CHAR_HEIGHT } from './defaults.js';
import { dimColor } from './colors.js';

export class Renderer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.isLed = options.led || false;
    this.prevState = null;

    // LED grid state
    this.dots = null;
    this.dotElements = null;
    this.gridCols = 0;
    this.gridRows = 0;

    // Modern mode elements
    this.textEl = null;
    this.charEls = [];

    // Preset overrides
    this.preset = options._preset || null;

    // Flip-tile cascade state
    this._flipTargetDots = null;  // what dots SHOULD be
    this._flipVisibleDots = null; // what dots ARE (delayed cascade)
    this._flipQueue = [];         // pending flip events {index, targetOn, time}
    this._flipTimer = null;

    this._setup();
  }

  _setup() {
    this.container.classList.add('marquee-container');

    if (this.isLed) {
      this._setupLed();
    } else {
      this._setupModern();
    }
  }

  // --- Pixel math helpers ---
  // CSS grid gap goes BETWEEN items, not after the last one.
  // Actual grid pixel width = cols * dotSize + (cols - 1) * dotGap

  _gridPixelWidth() {
    const ds = this.options.dotSize || 4;
    const dg = this.options.dotGap || 1;
    return this.gridCols * ds + (this.gridCols - 1) * dg;
  }

  _gridPixelHeight() {
    const ds = this.options.dotSize || 4;
    const dg = this.options.dotGap || 1;
    return this.gridRows * ds + (this.gridRows - 1) * dg;
  }

  _pxPerDot() {
    return (this.options.dotSize || 4) + (this.options.dotGap || 1);
  }

  // --- Modern text mode ---

  _setupModern() {
    this.container.innerHTML = '';
    this.textEl = document.createElement('div');
    this.textEl.className = 'marquee-text';
    this.textEl.style.fontSize = (this.options.fontSize || 32) + 'px';
    this.textEl.style.fontFamily = this.options.fontFamily || 'monospace';
    this.container.appendChild(this.textEl);

    if (this.options.background) {
      this.container.style.background = this.options.background;
    }
  }

  _renderModern(state) {
    // Rebuild char spans if text changed
    if (!this.prevState || this.prevState.text !== state.text) {
      this.textEl.innerHTML = '';
      this.charEls = [];
      for (let i = 0; i < state.text.length; i++) {
        const span = document.createElement('span');
        span.className = 'marquee-char';
        span.textContent = state.text[i];
        this.textEl.appendChild(span);
        this.charEls.push(span);
      }
    }

    // Position
    this.textEl.style.transform = `translate3d(${state.offsetX}px, ${state.offsetY}px, 0)`;

    // Opacity
    this.textEl.style.opacity = state.opacity;

    // Visibility (flash)
    this.textEl.style.visibility = state.visible ? 'visible' : 'hidden';

    // Per-character colors
    if (state.colors) {
      for (let i = 0; i < this.charEls.length; i++) {
        const color = state.colors[i] || state.colors[0] || '#ff3300';
        if (!this.prevState || !this.prevState.colors || this.prevState.colors[i] !== color) {
          this.charEls[i].style.color = color;
        }
      }
    }

    // Wipe effect
    if (state.wipeProgress !== undefined) {
      const visibleChars = Math.floor(state.text.length * state.wipeProgress);
      for (let i = 0; i < this.charEls.length; i++) {
        this.charEls[i].style.opacity = i < visibleChars ? '1' : '0';
      }
    }
  }

  // --- LED dot-matrix mode ---

  _setupLed() {
    this.container.innerHTML = '';
    this.container.classList.add('marquee-led');

    const cols = this.options.cols || 80;
    const rows = this.options.rows || 12;
    const dotSize = this.options.dotSize || 4;
    const dotGap = this.options.dotGap || 1;
    const dotShape = this.options.dotShape || 'circle';
    const dotRadius = this.options.dotRadius || (dotShape === 'circle' ? '50%' : '0');

    this.gridCols = cols;
    this.gridRows = rows;

    // Size the container to exactly fit the grid + padding
    const gridW = cols * dotSize + (cols - 1) * dotGap;
    const gridH = rows * dotSize + (rows - 1) * dotGap;
    this.container.style.width = (gridW + 16) + 'px';  // +16 for 8px padding each side
    this.container.style.height = (gridH + 16) + 'px';

    if (this.options.background) {
      this.container.style.background = this.options.background;
    }

    const grid = document.createElement('div');
    grid.className = 'marquee-led-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${dotSize}px)`;
    grid.style.gridTemplateRows = `repeat(${rows}, ${dotSize}px)`;
    grid.style.gap = `${dotGap}px`;
    grid.style.width = gridW + 'px';
    grid.style.height = gridH + 'px';

    const offColor = this.options.offColor || '#1a1a1a';
    this.dotElements = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dot = document.createElement('div');
        dot.className = 'marquee-dot';
        dot.style.width = dotSize + 'px';
        dot.style.height = dotSize + 'px';
        dot.style.borderRadius = typeof dotRadius === 'number' ? dotRadius + 'px' : dotRadius;
        dot.style.background = offColor;
        grid.appendChild(dot);
        this.dotElements.push(dot);
      }
    }

    this.container.appendChild(grid);

    // Scanline overlay
    if (this.options.scanlineEffect) {
      const scanline = document.createElement('div');
      scanline.className = 'marquee-scanline';
      scanline.style.position = 'absolute';
      scanline.style.top = '0';
      scanline.style.left = '0';
      scanline.style.right = '0';
      scanline.style.bottom = '0';
      scanline.style.pointerEvents = 'none';
      scanline.style.background = `repeating-linear-gradient(
        0deg,
        transparent,
        transparent ${dotSize}px,
        rgba(0,0,0,${this.options.scanlineOpacity || 0.08}) ${dotSize}px,
        rgba(0,0,0,${this.options.scanlineOpacity || 0.08}) ${dotSize + dotGap}px
      )`;
      this.container.style.position = 'relative';
      this.container.appendChild(scanline);
    }

    // Dot state buffer (0 = off, 1 = on)
    this.dots = new Uint8Array(rows * cols);
    this.dotColors = new Array(rows * cols).fill(null);

    // Flip-tile cascade buffers
    if (this.options.flipAnimation) {
      this._flipVisibleDots = new Uint8Array(rows * cols);
      this._flipVisibleColors = new Array(rows * cols).fill(null);
    }
  }

  _renderLed(state) {
    const offColor = this.options.offColor || '#1a1a1a';
    const glowAmount = this.options.glowAmount || 0;

    // Clear dot buffer
    this.dots.fill(0);
    this.dotColors.fill(null);

    if (!state.visible) {
      // Flash off — all dots off
      if (this.options.flipAnimation) {
        this._flipApply(offColor, glowAmount, 1);
      } else {
        this._applyDots(offColor, glowAmount);
      }
      return;
    }

    // Map text to dot positions
    const text = state.text || '';
    const pxPerDot = this._pxPerDot();
    const offsetDots = Math.round(state.offsetX / pxPerDot);
    const offsetDotsY = Math.round(state.offsetY / pxPerDot);

    // Center text vertically if rows > CHAR_HEIGHT
    const baseRow = Math.max(0, Math.floor((this.gridRows - CHAR_HEIGHT) / 2)) + offsetDotsY;

    const horizontal = state.stripeDirection === 'horizontal';

    // For horizontal stripes, build a row-color lookup from the colors array
    let rowColors;
    if (horizontal && state.colors && state.colors.length > 0) {
      rowColors = state.colors;
    }

    for (let ci = 0; ci < text.length; ci++) {
      const ch = text[ci];
      const glyph = DOT_FONT[ch] || DOT_FONT['?'] || DOT_FONT[' '];
      const charColor = (!horizontal && state.colors && state.colors[ci]) || this.options.color || '#ff3300';
      const charStartCol = offsetDots + ci * CHAR_WIDTH;

      for (let row = 0; row < CHAR_HEIGHT; row++) {
        const bits = glyph[row];
        for (let bit = 0; bit < 5; bit++) {
          if (bits & (1 << (4 - bit))) {
            const dotCol = charStartCol + bit;
            const dotRow = baseRow + row;

            if (dotCol >= 0 && dotCol < this.gridCols && dotRow >= 0 && dotRow < this.gridRows) {
              const idx = dotRow * this.gridCols + dotCol;
              this.dots[idx] = 1;
              this.dotColors[idx] = horizontal
                ? (rowColors[dotRow % rowColors.length])
                : charColor;
            }
          }
        }
      }
    }

    // Handle wipe effect
    if (state.wipeProgress !== undefined) {
      const wipeCol = Math.floor(this.gridCols * state.wipeProgress);
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = wipeCol; c < this.gridCols; c++) {
          this.dots[r * this.gridCols + c] = 0;
        }
      }
    }

    // Apply opacity by dimming colors
    const opacityFactor = state.opacity !== undefined ? state.opacity : 1;

    if (this.options.flipAnimation) {
      this._flipApply(offColor, glowAmount, opacityFactor);
    } else {
      this._applyDots(offColor, glowAmount, opacityFactor);
    }
  }

  // --- Flip-tile cascade ---
  // Instead of instantly updating all dots, queue changes and apply them
  // in a column-by-column cascade with a delay between columns.

  _flipApply(offColor, glowAmount, opacityFactor) {
    const flipSpeed = this.options.flipSpeed || 30;
    const now = performance.now();

    // Find dots that changed and queue them by column
    const changedCols = new Set();
    for (let i = 0; i < this.dots.length; i++) {
      const targetOn = this.dots[i];
      const currentOn = this._flipVisibleDots[i];
      const colorChanged = targetOn && this._flipVisibleColors[i] !== this.dotColors[i];

      if (targetOn !== currentOn || colorChanged) {
        const col = i % this.gridCols;
        changedCols.add(col);
      }
    }

    // Sort columns left to right and schedule cascade
    const sortedCols = [...changedCols].sort((a, b) => a - b);
    for (let ci = 0; ci < sortedCols.length; ci++) {
      const col = sortedCols[ci];
      const delay = ci * flipSpeed;

      // Schedule all dots in this column to flip at the same time
      for (let r = 0; r < this.gridRows; r++) {
        const idx = r * this.gridCols + col;
        const targetOn = this.dots[idx];
        const targetColor = this.dotColors[idx];
        this._flipQueue.push({
          idx,
          targetOn,
          targetColor,
          time: now + delay,
        });
      }
    }

    // Process any ready flips
    this._processFlipQueue(now);

    // Apply visible state to DOM
    for (let i = 0; i < this.dotElements.length; i++) {
      const el = this.dotElements[i];
      if (this._flipVisibleDots[i]) {
        let color = this._flipVisibleColors[i] || '#ff3300';
        if (opacityFactor < 1) {
          color = dimColor(color, opacityFactor);
        }
        if (el._prevColor !== color) {
          el.style.background = color;
          if (glowAmount > 0) {
            el.style.boxShadow = `0 0 ${glowAmount}px ${Math.ceil(glowAmount / 2)}px ${color}`;
          }
          el._prevColor = color;
          el._prevOn = true;
        }
      } else {
        if (el._prevOn !== false) {
          el.style.background = offColor;
          el.style.boxShadow = 'none';
          el._prevColor = null;
          el._prevOn = false;
        }
      }
    }
  }

  _processFlipQueue(now) {
    const remaining = [];
    for (const item of this._flipQueue) {
      if (now >= item.time) {
        this._flipVisibleDots[item.idx] = item.targetOn;
        this._flipVisibleColors[item.idx] = item.targetColor;
      } else {
        remaining.push(item);
      }
    }
    this._flipQueue = remaining;
  }

  _applyDots(offColor, glowAmount, opacityFactor = 1) {
    for (let i = 0; i < this.dotElements.length; i++) {
      const el = this.dotElements[i];
      if (this.dots[i]) {
        let color = this.dotColors[i] || '#ff3300';
        if (opacityFactor < 1) {
          color = dimColor(color, opacityFactor);
        }

        // Only update if changed
        if (el._prevColor !== color) {
          el.style.background = color;
          if (glowAmount > 0) {
            el.style.boxShadow = `0 0 ${glowAmount}px ${Math.ceil(glowAmount / 2)}px ${color}`;
          }
          el._prevColor = color;
          el._prevOn = true;
        }
      } else {
        if (el._prevOn !== false) {
          el.style.background = offColor;
          el.style.boxShadow = 'none';
          el._prevColor = null;
          el._prevOn = false;
        }
      }
    }
  }

  // --- Public API ---

  render(state) {
    if (this.isLed) {
      this._renderLed(state);
    } else {
      this._renderModern(state);
    }
    this.prevState = { ...state, colors: state.colors ? [...state.colors] : null };
  }

  getContainerWidth() {
    if (this.isLed) {
      return this._gridPixelWidth();
    }
    return this.container.offsetWidth;
  }

  measureText(text) {
    if (this.isLed) {
      // Text width in pixels = charCount * CHAR_WIDTH dots * pxPerDot - trailing gap
      const charDots = text.length * CHAR_WIDTH;
      return charDots * this._pxPerDot();
    }

    // Modern: use a hidden measurement element
    const measure = document.createElement('span');
    measure.style.font = `${this.options.fontSize || 32}px ${this.options.fontFamily || 'monospace'}`;
    measure.style.visibility = 'hidden';
    measure.style.position = 'absolute';
    measure.style.whiteSpace = 'nowrap';
    measure.textContent = text;
    document.body.appendChild(measure);
    const width = measure.offsetWidth;
    document.body.removeChild(measure);
    return width;
  }

  destroy() {
    this.container.innerHTML = '';
    this.container.classList.remove('marquee-container', 'marquee-led');
    this.container.style.width = '';
    this.container.style.height = '';
    this.container.style.background = '';
    this.dotElements = null;
    this.dots = null;
    this._flipQueue = [];
    this._flipVisibleDots = null;
    this._flipVisibleColors = null;
    this.charEls = [];
    this.textEl = null;
  }
}
