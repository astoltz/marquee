// Marquee — programmable sign library
//
// Public API entry point. Ties together Timeline, Renderer, and WebSocket.

import { DEFAULTS } from './defaults.js';
import { PRESETS, getPresetDefaultColor } from './presets.js';
import { Renderer } from './renderer.js';
import { Timeline } from './timeline.js';
import { SignSocket } from './websocket.js';
import { registerPhase } from './phases.js';

export class Marquee {
  /**
   * @param {string|HTMLElement} el - CSS selector or DOM element
   * @param {object} options
   */
  constructor(el, options = {}) {
    this.container = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.container) throw new Error(`Marquee: element not found: ${el}`);

    // Merge preset -> defaults -> user options
    const presetName = options.preset || null;
    const presetOpts = presetName && PRESETS[presetName] ? { ...PRESETS[presetName] } : {};

    // If using a preset, force LED mode (unless split-flap)
    if (presetName && PRESETS[presetName]) {
      if (PRESETS[presetName].splitFlap) {
        presetOpts.splitFlap = true;
      } else {
        presetOpts.led = true;
      }
    }

    this.options = { ...DEFAULTS, ...presetOpts, ...options };

    // If preset has a restricted color palette, store it
    this._presetColors = null;
    if (presetName && PRESETS[presetName] && PRESETS[presetName].colors) {
      this._presetColors = [...PRESETS[presetName].colors];
    }

    // Mono-color preset: allow user to override the single color
    // forceMultiColor bypasses mono restriction (undocumented)
    if (presetName && PRESETS[presetName] && PRESETS[presetName].monoColor && !options.forceMultiColor) {
      if (options.color) {
        this._presetColors = [options.color];
        this.options.color = options.color;
      }
    } else if (options.forceMultiColor) {
      this._presetColors = null; // unrestricted palette
    }

    // Default color from preset
    if (!options.color && presetName) {
      const pc = getPresetDefaultColor(presetName);
      if (pc) this.options.color = pc;
    }

    // Store preset config for renderer
    this.options._preset = presetName ? PRESETS[presetName] : null;

    // Inject styles if needed
    Marquee._injectStyles();

    // Create renderer
    this.renderer = new Renderer(this.container, this.options);

    // Auto-detect mobile for performance cap
    if (!this.options.maxFps && typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
      this.options.maxFps = 30;
    }

    // Create timeline
    this.timeline = new Timeline(this.renderer, {
      loop: this.options.loop,
      presetColors: this._presetColors,
      maxFps: this.options.maxFps || 0,
    });

    // Token context for text replacements
    this.timeline.tokenContext = {
      container: this.container,
      tokens: options.tokens || {},
    };

    // Stuck tiles
    if (options.stuckTiles) {
      this.renderer.setStuckTiles(options.stuckTiles);
    }

    // Event listeners
    this._listeners = {};

    // Forward timeline events
    this.timeline.on('phaseStart', (data) => this.emit('phaseStart', data));
    this.timeline.on('phaseEnd', (data) => this.emit('phaseEnd', data));
    this.timeline.on('sequenceEnd', (data) => this.emit('sequenceEnd', data));

    // WebSocket
    this._socket = null;

    // File polling state
    this._pollTimer = null;
    this._pollUrl = null;

    // If simple text+phase was passed in options, set up a single-step sequence
    if (options.text) {
      this.sequence([{
        text: options.text,
        phase: options.phase || 'scroll-left',
        color: options.color,
        speed: options.speed,
        duration: options.duration,
        until: options.until,
      }]);
    }
  }

  /**
   * Define a sequence of animation phases.
   * @param {object[]} steps
   */
  sequence(steps) {
    // Apply default color to steps that don't specify one
    const defaultColor = this.options.color || '#ff3300';
    const processedSteps = steps.map(s => ({
      color: defaultColor,
      ...s,
    }));
    this.timeline.setSequence(processedSteps);
    return this;
  }

  play() {
    this.timeline.play();
    return this;
  }

  pause() {
    this.timeline.pause();
    return this;
  }

  stop() {
    this.timeline.stop();
    return this;
  }

  /**
   * Change text and optionally restart.
   */
  setText(text, opts = {}) {
    const wasPlaying = this.timeline.state === 1; // PLAYING
    this.stop();
    this.sequence([{
      text,
      phase: opts.phase || 'scroll-left',
      color: opts.color || this.options.color,
      speed: opts.speed || this.options.speed,
      duration: opts.duration,
      until: opts.until,
    }]);
    if (wasPlaying || opts.autoPlay) this.play();
    return this;
  }

  /**
   * Update theme/options live. Rebuilds the renderer.
   */
  setTheme(opts) {
    this.stop();
    Object.assign(this.options, opts);

    // Rebuild preset if changed
    if (opts.preset && PRESETS[opts.preset]) {
      const presetOpts = PRESETS[opts.preset];
      Object.assign(this.options, presetOpts, opts);
      if (presetOpts.splitFlap) {
        this.options.splitFlap = true;
        this.options.led = false;
      } else {
        this.options.led = true;
        this.options.splitFlap = false;
      }
      this._presetColors = presetOpts.colors ? [...presetOpts.colors] : null;
      this.options._preset = presetOpts;
      // Mono-color override (unless forceMultiColor)
      if (presetOpts.monoColor && !this.options.forceMultiColor) {
        if (opts.color) this._presetColors = [opts.color];
      } else if (this.options.forceMultiColor) {
        this._presetColors = null;
      }
    }

    this.renderer.destroy();
    this.renderer = new Renderer(this.container, this.options);
    this.timeline.renderer = this.renderer;
    this.timeline.presetColors = this._presetColors;
    return this;
  }

  /**
   * Load a sequence from a JSON file URL. Fetches the file, parses it,
   * and applies the sequence. Supports periodic polling.
   *
   * JSON format:
   * {
   *   "options": { "preset": "led-14", "loop": true },   // optional
   *   "sequence": [ { "text": "Hello", "phase": "scroll-left" }, ... ]
   * }
   *
   * @param {string} url - URL to fetch (file:// or http://)
   * @param {object} opts
   * @param {number} opts.pollInterval - ms between reloads (0 = once)
   * @param {string} opts.pollAt - time-of-day to reload, e.g. "06:00"
   */
  loadURL(url, opts = {}) {
    this._pollUrl = url;

    const doLoad = async () => {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        this._applyLoadedData(data);
        this.emit('load', { url, data });
      } catch (e) {
        this.emit('load:error', { url, error: e });
      }
    };

    // Initial load
    doLoad();

    // Set up polling
    if (opts.pollInterval && opts.pollInterval > 0) {
      this._stopPolling();
      this._pollTimer = setInterval(doLoad, opts.pollInterval);
    }

    // Set up time-of-day reload
    if (opts.pollAt) {
      this._schedulePollAt(opts.pollAt, doLoad);
    }

    return this;
  }

  _applyLoadedData(data, depth = 0) {
    // Apply options if provided
    if (data.options) {
      if (data.options.preset || data.options.led) {
        this.setTheme(data.options);
      } else {
        Object.assign(this.options, data.options);
        this.timeline.options.loop = this.options.loop;
      }
    }

    // Self-describing refresh interval
    if (data.refreshInterval && data.refreshInterval > 0 && this._pollUrl) {
      this._stopPolling();
      const doLoad = async () => {
        try {
          const resp = await fetch(this._pollUrl, { cache: 'no-store' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const newData = await resp.json();
          this._applyLoadedData(newData);
          this.emit('load', { url: this._pollUrl, data: newData });
        } catch (e) {
          this.emit('load:error', { url: this._pollUrl, error: e });
        }
      };
      this._pollTimer = setInterval(doLoad, data.refreshInterval);
    }

    // Chain-loading: load another URL from JSON
    if (data.loadUrl && depth < (this.options.maxChainDepth || 3)) {
      const allowed = this.options.allowedOrigins;
      let isAllowed = false;
      try {
        const loadOrigin = new URL(data.loadUrl, window.location.href).origin;
        if (!allowed || loadOrigin === window.location.origin) {
          isAllowed = true;
        } else if (Array.isArray(allowed) && allowed.includes(loadOrigin)) {
          isAllowed = true;
        }
      } catch (_urlErr) {
        // Invalid URL — skip chain-loading
      }

      if (isAllowed) {
        fetch(data.loadUrl, { cache: 'no-store' })
          .then(resp => {
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.json();
          })
          .then(chainData => this._applyLoadedData(chainData, depth + 1))
          .catch(e => this.emit('load:error', { url: data.loadUrl, error: e }));
        return; // Don't apply sequence yet — chain will handle it
      }
    }

    // Apply sequence
    if (data.sequence && Array.isArray(data.sequence)) {
      this.stop();
      this.sequence(data.sequence);
      this.play();
    }
  }

  _schedulePollAt(timeStr, fn) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduleNext = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target - now;
      this._pollAtTimer = setTimeout(() => {
        fn();
        scheduleNext(); // reschedule for next day
      }, delay);
    };
    scheduleNext();
  }

  _stopPolling() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    if (this._pollAtTimer) { clearTimeout(this._pollAtTimer); this._pollAtTimer = null; }
  }

  /**
   * Connect to a WebSocket server for live control.
   */
  connectWS(url, options = {}) {
    if (this._socket) this._socket.destroy();
    this._socket = new SignSocket(this, url, {
      reconnect: this.options.reconnect,
      reconnectInterval: this.options.reconnectInterval,
      ...options,
    });
    this._socket.connect();
    return this;
  }

  /**
   * Send a message to the WebSocket server.
   */
  sendWS(data) {
    if (this._socket) this._socket.send(data);
    return this;
  }

  /**
   * Listen to events.
   * Events: phaseStart, phaseEnd, sequenceEnd, load, load:error,
   *         ws:open, ws:close, ws:message, ws:error
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
    return this;
  }

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(fn => fn(data));
    }
  }

  /**
   * Update the sign color for mono-color presets.
   */
  setColor(color) {
    if (this.options._preset && this.options._preset.monoColor && !this.options.forceMultiColor) {
      this._presetColors = [color];
      this.options.color = color;
      this.timeline.presetColors = this._presetColors;
    } else {
      this.options.color = color;
    }
    return this;
  }

  /**
   * Set stuck tiles for simulated hardware failures.
   * @param {object} tiles - Map of "row,col": "on"|"off"
   */
  setStuckTiles(tiles) {
    this.renderer.setStuckTiles(tiles);
    return this;
  }

  /**
   * Get the flip count for each tile (wear tracking).
   * @returns {Uint32Array|null}
   */
  getFlipCounts() {
    return this.renderer.getFlipCounts();
  }

  /**
   * Set custom token values for text replacement.
   * @param {object} tokens - key/value map
   */
  setTokens(tokens) {
    if (this.timeline.tokenContext) {
      this.timeline.tokenContext.tokens = tokens;
    }
    return this;
  }

  /**
   * Get available preset names.
   */
  static get presets() {
    return Object.keys(PRESETS);
  }

  /**
   * Register a custom animation phase.
   */
  static registerPhase(name, factory) {
    registerPhase(name, factory);
  }

  /**
   * Clean up everything.
   */
  destroy() {
    this.timeline.destroy();
    this.renderer.destroy();
    this._stopPolling();
    if (this._socket) this._socket.destroy();
    this._listeners = {};
  }

  // --- Style injection ---

  static _stylesInjected = false;

  static _injectStyles() {
    if (Marquee._stylesInjected) return;
    if (document.querySelector('[data-marquee-styles]')) {
      Marquee._stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-marquee-styles', '');
    style.textContent = INJECTED_CSS;
    document.head.appendChild(style);
    Marquee._stylesInjected = true;
  }
}

// Minimal CSS injected at runtime (users can override via external CSS)
const INJECTED_CSS = `
.marquee-container {
  position: relative;
  overflow: hidden;
  font-family: monospace;
  min-height: 40px;
}
.marquee-text {
  display: inline-block;
  white-space: nowrap;
  will-change: transform, opacity;
  position: absolute;
  top: 50%;
  margin-top: -0.6em;
}
.marquee-char {
  display: inline-block;
}
.marquee-container.marquee-led {
  border-radius: 8px;
  padding: 8px;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
}
.marquee-dot {
  transition: background 0.04s, box-shadow 0.04s;
}
`;

// Default export for UMD
export default Marquee;
