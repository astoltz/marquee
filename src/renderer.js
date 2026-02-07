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

    // Split-flap state
    this.isSplitFlap = options.splitFlap || false;
    this._sfCells = [];
    this._sfCurrentChars = [];
    this._sfTargetChars = [];
    this._sfFlipTimers = [];
    this.splitFlapComplete = true;

    // Flip-tile cascade state
    this._flipTargetDots = null;  // what dots SHOULD be
    this._flipVisibleDots = null; // what dots ARE (delayed cascade)
    this._flipQueue = [];         // pending flip events {index, targetOn, time}
    this._flipTimer = null;

    // Stuck tiles (simulated hardware failures)
    this._stuckTiles = null;  // Map of index -> "on"|"off"

    // Flip counts for wear tracking
    this._flipCounts = null;

    this._setup();
  }

  _setup() {
    this.container.classList.add('marquee-container');

    if (this.isSplitFlap) {
      this._setupSplitFlap();
    } else if (this.isLed) {
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

  // --- Split-flap display mode ---

  _getWheel() {
    if (this.options.wheelOrder) return this.options.wheelOrder;
    const upper = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!?-:/';
    if (this.options.splitFlapCase === 'mixed') {
      return upper + 'abcdefghijklmnopqrstuvwxyz';
    }
    return upper;
  }

  _setupSplitFlap() {
    this.container.innerHTML = '';
    this.container.classList.add('marquee-split-flap');

    const cellCount = this.options.cellCount || 20;
    const charWidth = this.options.charWidth || 40;
    const charHeight = this.options.charHeight || 60;
    const cellGap = this.options.cellGap || 3;
    const bg = this.options.background || '#1a1a1a';
    const color = this.options.color || '#e8e8d0';

    this.container.style.background = bg;
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'center';
    this.container.style.padding = '12px';

    const row = document.createElement('div');
    row.className = 'marquee-sf-row';
    row.style.display = 'flex';
    row.style.gap = cellGap + 'px';

    this._sfCells = [];
    this._sfCurrentChars = [];
    this._sfTargetChars = [];
    this._sfFlipTimers = [];

    for (let i = 0; i < cellCount; i++) {
      const cell = document.createElement('div');
      cell.className = 'marquee-sf-cell';
      cell.style.width = charWidth + 'px';
      cell.style.height = charHeight + 'px';
      cell.style.position = 'relative';
      cell.style.perspective = '200px';
      cell.style.overflow = 'hidden';

      const upper = document.createElement('div');
      upper.className = 'marquee-sf-flap-top';
      upper.style.position = 'absolute';
      upper.style.top = '0';
      upper.style.left = '0';
      upper.style.right = '0';
      upper.style.height = '50%';
      upper.style.overflow = 'hidden';
      upper.style.background = '#2a2a2a';
      upper.style.borderBottom = '1px solid #111';
      upper.style.borderRadius = '3px 3px 0 0';
      upper.style.display = 'flex';
      upper.style.alignItems = 'flex-end';
      upper.style.justifyContent = 'center';

      const upperText = document.createElement('span');
      upperText.style.color = color;
      upperText.style.fontSize = (charHeight * 0.7) + 'px';
      upperText.style.fontFamily = "'Courier New', monospace";
      upperText.style.fontWeight = this.options.fontWeight || 'bold';
      upperText.style.lineHeight = '1';
      upperText.style.transform = 'translateY(50%)';
      upperText.textContent = ' ';
      upper.appendChild(upperText);

      const lower = document.createElement('div');
      lower.className = 'marquee-sf-flap-bottom';
      lower.style.position = 'absolute';
      lower.style.bottom = '0';
      lower.style.left = '0';
      lower.style.right = '0';
      lower.style.height = '50%';
      lower.style.overflow = 'hidden';
      lower.style.background = '#333';
      lower.style.borderRadius = '0 0 3px 3px';
      lower.style.display = 'flex';
      lower.style.alignItems = 'flex-start';
      lower.style.justifyContent = 'center';

      const lowerText = document.createElement('span');
      lowerText.style.color = color;
      lowerText.style.fontSize = (charHeight * 0.7) + 'px';
      lowerText.style.fontFamily = "'Courier New', monospace";
      lowerText.style.fontWeight = this.options.fontWeight || 'bold';
      lowerText.style.lineHeight = '1';
      lowerText.style.transform = 'translateY(-50%)';
      lowerText.textContent = ' ';
      lower.appendChild(lowerText);

      cell.appendChild(upper);
      cell.appendChild(lower);
      row.appendChild(cell);

      this._sfCells.push({ cell, upperText, lowerText });
      this._sfCurrentChars.push(' ');
      this._sfTargetChars.push(' ');
      this._sfFlipTimers.push(null);
    }

    this.container.appendChild(row);

    // Size the container
    const totalWidth = cellCount * charWidth + (cellCount - 1) * cellGap + 24;
    this.container.style.width = totalWidth + 'px';
    this.container.style.height = (charHeight + 24) + 'px';
  }

  _renderSplitFlap(state) {
    if (!state.text && !state.visible) return;

    let text = state.text || '';
    if (this.options.splitFlapCase === 'upper') {
      text = text.toUpperCase();
    }

    // Pad or trim to cell count
    const cellCount = this._sfCells.length;
    // Center the text
    if (text.length < cellCount) {
      const pad = Math.floor((cellCount - text.length) / 2);
      text = ' '.repeat(pad) + text + ' '.repeat(cellCount - text.length - pad);
    } else if (text.length > cellCount) {
      text = text.slice(0, cellCount);
    }

    const wheel = this._getWheel();
    const flipDuration = this.options.flipDuration || 80;
    const stagger = this.options.splitFlapStagger || 50;

    // Check if any targets changed
    let anyChanged = false;
    for (let i = 0; i < cellCount; i++) {
      const target = text[i] || ' ';
      if (this._sfTargetChars[i] !== target) {
        this._sfTargetChars[i] = target;
        anyChanged = true;

        // Start flipping this cell with stagger delay
        if (this._sfFlipTimers[i]) clearTimeout(this._sfFlipTimers[i]);
        const delay = i * stagger;
        this._sfFlipTimers[i] = setTimeout(() => {
          this._flipCell(i, wheel, flipDuration);
        }, delay);
      }
    }

    if (anyChanged) {
      this.splitFlapComplete = false;
    }

    // Apply opacity
    if (state.opacity !== undefined) {
      this.container.style.opacity = state.opacity;
    }
    // Apply visibility
    if (state.visible !== undefined) {
      this.container.style.visibility = state.visible ? 'visible' : 'hidden';
    }
  }

  _flipCell(cellIndex, wheel, flipDuration) {
    const current = this._sfCurrentChars[cellIndex];
    const target = this._sfTargetChars[cellIndex];

    if (current === target) {
      this._checkSplitFlapComplete();
      return;
    }

    // Find positions on wheel
    let currentPos = wheel.indexOf(current);
    if (currentPos === -1) currentPos = 0;
    let targetPos = wheel.indexOf(target);
    if (targetPos === -1) targetPos = 0;

    // Advance one step on the wheel
    const nextPos = (currentPos + 1) % wheel.length;
    const nextChar = wheel[nextPos];

    // Apply the flip animation
    const cellData = this._sfCells[cellIndex];
    const cell = cellData.cell;

    // Create the flip animation element
    const flipEl = document.createElement('div');
    flipEl.className = 'marquee-sf-flip';
    flipEl.style.position = 'absolute';
    flipEl.style.top = '0';
    flipEl.style.left = '0';
    flipEl.style.right = '0';
    flipEl.style.height = '50%';
    flipEl.style.overflow = 'hidden';
    flipEl.style.background = '#2a2a2a';
    flipEl.style.borderBottom = '1px solid #111';
    flipEl.style.borderRadius = '3px 3px 0 0';
    flipEl.style.transformOrigin = 'bottom center';
    flipEl.style.display = 'flex';
    flipEl.style.alignItems = 'flex-end';
    flipEl.style.justifyContent = 'center';
    flipEl.style.zIndex = '2';

    const flipText = document.createElement('span');
    flipText.style.color = this.options.color || '#e8e8d0';
    flipText.style.fontSize = ((this.options.charHeight || 60) * 0.7) + 'px';
    flipText.style.fontFamily = "'Courier New', monospace";
    flipText.style.fontWeight = this.options.fontWeight || 'bold';
    flipText.style.lineHeight = '1';
    flipText.style.transform = 'translateY(50%)';
    flipText.textContent = current;
    flipEl.appendChild(flipText);
    cell.appendChild(flipEl);

    // Update the static panels to show the next character
    cellData.upperText.textContent = nextChar;
    cellData.lowerText.textContent = nextChar;
    this._sfCurrentChars[cellIndex] = nextChar;

    // Animate the flip
    flipEl.style.transition = `transform ${flipDuration}ms ease-in`;
    requestAnimationFrame(() => {
      flipEl.style.transform = 'rotateX(-90deg)';
    });

    setTimeout(() => {
      if (flipEl.parentNode) flipEl.parentNode.removeChild(flipEl);

      // Continue flipping if not at target
      if (nextChar !== target) {
        this._flipCell(cellIndex, wheel, flipDuration);
      } else {
        this._checkSplitFlapComplete();
      }
    }, flipDuration);
  }

  _checkSplitFlapComplete() {
    for (let i = 0; i < this._sfCurrentChars.length; i++) {
      if (this._sfCurrentChars[i] !== this._sfTargetChars[i]) return;
    }
    this.splitFlapComplete = true;
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
      this._flipCounts = new Uint32Array(rows * cols);
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

    // Apply stuck tiles override
    if (this._stuckTiles) {
      this._applyStuckTiles(offColor);
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
        if (this._flipVisibleDots[item.idx] !== item.targetOn) {
          if (this._flipCounts) this._flipCounts[item.idx]++;
        }
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

  // --- Stuck tiles ---

  setStuckTiles(tiles) {
    if (!tiles) {
      this._stuckTiles = null;
      return;
    }
    this._stuckTiles = new Map();
    for (const [key, value] of Object.entries(tiles)) {
      const [row, col] = key.split(',').map(Number);
      const idx = row * this.gridCols + col;
      this._stuckTiles.set(idx, value);
    }
  }

  getFlipCounts() {
    return this._flipCounts;
  }

  _applyStuckTiles(_offColor) {
    if (!this._stuckTiles) return;
    for (const [idx, mode] of this._stuckTiles) {
      if (mode === 'on') {
        this.dots[idx] = 1;
        if (!this.dotColors[idx]) {
          this.dotColors[idx] = this.options.color || '#ff3300';
        }
      } else if (mode === 'off') {
        this.dots[idx] = 0;
      }
    }
  }

  // --- Public API ---

  render(state) {
    if (this.isSplitFlap) {
      this._renderSplitFlap(state);
    } else if (this.isLed) {
      this._renderLed(state);
    } else {
      this._renderModern(state);
    }
    this.prevState = { ...state, colors: state.colors ? [...state.colors] : null };
  }

  getContainerWidth() {
    if (this.isSplitFlap) {
      const cellCount = this.options.cellCount || 20;
      const charWidth = this.options.charWidth || 40;
      const cellGap = this.options.cellGap || 3;
      return cellCount * charWidth + (cellCount - 1) * cellGap;
    }
    if (this.isLed) {
      return this._gridPixelWidth();
    }
    return this.container.offsetWidth;
  }

  measureText(text) {
    if (this.isSplitFlap) {
      // For split-flap, text width = number of chars * cell width
      const charWidth = this.options.charWidth || 40;
      const cellGap = this.options.cellGap || 3;
      return (text || '').length * (charWidth + cellGap);
    }
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
    // Clear split-flap timers
    if (this._sfFlipTimers) {
      this._sfFlipTimers.forEach(t => { if (t) clearTimeout(t); });
    }
    this.container.innerHTML = '';
    this.container.classList.remove('marquee-container', 'marquee-led', 'marquee-split-flap');
    this.container.style.width = '';
    this.container.style.height = '';
    this.container.style.background = '';
    this.container.style.display = '';
    this.container.style.justifyContent = '';
    this.container.style.padding = '';
    this.container.style.opacity = '';
    this.container.style.visibility = '';
    this.dotElements = null;
    this.dots = null;
    this._flipQueue = [];
    this._flipVisibleDots = null;
    this._flipVisibleColors = null;
    this._sfCells = [];
    this._sfCurrentChars = [];
    this._sfTargetChars = [];
    this._sfFlipTimers = [];
    this.charEls = [];
    this.textEl = null;
  }
}
