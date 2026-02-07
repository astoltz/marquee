// Timeline — the animation sequencer
//
// Drives a requestAnimationFrame loop, advancing through phases.

import { createPhase } from './phases.js';

const STATE = { IDLE: 0, PLAYING: 1, PAUSED: 2 };

export class Timeline {
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    this.options = options;
    this.phases = [];
    this.currentIndex = 0;
    this.state = STATE.IDLE;
    this.rafId = null;
    this.lastTimestamp = 0;
    this.listeners = {};
    this.containerWidth = 0;
    this.presetColors = options.presetColors || null;
    this.tokenContext = null;
  }

  /**
   * Set the sequence of phase configs.
   */
  setSequence(steps) {
    this.stop();
    this.stepConfigs = steps;
    this.phases = [];
    this.currentIndex = 0;
  }

  /**
   * Build a phase instance from config at the given index.
   */
  _buildPhase(index) {
    const step = this.stepConfigs[index];
    const prevState = index > 0 && this.phases[index - 1]
      ? this.phases[index - 1].getState()
      : null;

    this.containerWidth = this.renderer.getContainerWidth();
    const textWidth = this.renderer.measureText(step.text || (prevState && prevState.text) || '');

    return createPhase(step, this.containerWidth, textWidth, prevState, this.presetColors, this.tokenContext);
  }

  play() {
    if (this.state === STATE.PLAYING) return;

    if (this.state === STATE.IDLE) {
      if (!this.stepConfigs || this.stepConfigs.length === 0) return;
      this.currentIndex = 0;
      this.phases = [];
      const phase = this._buildPhase(0);
      this.phases[0] = phase;
      phase.start();
      this.emit('phaseStart', { index: 0, step: this.stepConfigs[0] });
    }

    this.state = STATE.PLAYING;
    this.lastTimestamp = 0;
    this.rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  stop() {
    this.state = STATE.IDLE;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.currentIndex = 0;
    this.phases = [];
  }

  _tick(timestamp) {
    if (this.state !== STATE.PLAYING) return;

    // FPS cap: skip frame if not enough time has elapsed.
    // Don't update lastTimestamp on skipped frames so elapsed time accumulates.
    if (this.options.maxFps && this.options.maxFps > 0 && this.lastTimestamp) {
      const elapsed = timestamp - this.lastTimestamp;
      const minFrameTime = 1000 / this.options.maxFps;
      if (elapsed < minFrameTime * 0.8) {
        this.rafId = requestAnimationFrame((ts) => this._tick(ts));
        return;
      }
    }

    const dt = this.lastTimestamp ? timestamp - this.lastTimestamp : 16;
    this.lastTimestamp = timestamp;

    const phase = this.phases[this.currentIndex];
    if (!phase) { this.stop(); return; }

    const done = phase.update(dt);
    this.renderer.render(phase.getState());

    if (done) {
      this.emit('phaseEnd', { index: this.currentIndex, step: this.stepConfigs[this.currentIndex] });
      this.currentIndex++;

      if (this.currentIndex >= this.stepConfigs.length) {
        if (this.options.loop) {
          this.currentIndex = 0;
          this.phases = [];
          const nextPhase = this._buildPhase(0);
          this.phases[0] = nextPhase;
          nextPhase.start();
          this.emit('sequenceEnd', {});
          this.emit('phaseStart', { index: 0, step: this.stepConfigs[0] });
        } else {
          this.emit('sequenceEnd', {});
          this.state = STATE.IDLE;
          return;
        }
      } else {
        const nextPhase = this._buildPhase(this.currentIndex);
        this.phases[this.currentIndex] = nextPhase;
        nextPhase.start();
        this.emit('phaseStart', { index: this.currentIndex, step: this.stepConfigs[this.currentIndex] });
      }
    }

    this.rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  // Simple event emitter
  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return () => {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }

  destroy() {
    this.stop();
    this.listeners = {};
  }
}
