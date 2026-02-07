// MarqueeDevTools — performance monitoring overlay
//
// Not included in the main bundle. Built as a separate dist/marquee.devtools.js.
// Usage:
//   import { MarqueeDevTools } from 'marquee-sign/devtools';
//   const dt = new MarqueeDevTools(marqueeInstance);
//   dt.enable();

export class MarqueeDevTools {
  constructor(marquee) {
    this.marquee = marquee;
    this.enabled = false;
    this._overlay = null;
    this._stats = {
      fps: 0,
      avgFrameTime: 0,
      dotUpdates: 0,
      totalDots: 0,
      frameCount: 0,
    };
    this._frameTimes = [];
    this._originalRender = null;
    this._updateInterval = null;
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    // Create FPS overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'marquee-devtools-overlay';
    this._overlay.style.cssText = `
      position: absolute; top: 4px; right: 4px; z-index: 9999;
      background: rgba(0,0,0,0.8); color: #0f0; font-family: monospace;
      font-size: 11px; padding: 4px 8px; border-radius: 4px; pointer-events: none;
      line-height: 1.4;
    `;
    this.marquee.container.style.position = 'relative';
    this.marquee.container.appendChild(this._overlay);

    // Monkey-patch renderer.render to measure timing
    const renderer = this.marquee.renderer;
    this._originalRender = renderer.render.bind(renderer);
    const self = this;

    renderer.render = function(state) {
      const start = performance.now();
      self._originalRender(state);
      const elapsed = performance.now() - start;
      self._frameTimes.push(elapsed);
      if (self._frameTimes.length > 60) self._frameTimes.shift();
      self._stats.frameCount++;

      // Count dot updates
      if (renderer.dotElements) {
        self._stats.totalDots = renderer.dotElements.length;
      }
    };

    // Update overlay every 500ms
    this._updateInterval = setInterval(() => this._updateOverlay(), 500);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    // Restore original render
    if (this._originalRender) {
      this.marquee.renderer.render = this._originalRender;
      this._originalRender = null;
    }

    // Remove overlay
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;

    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  getStats() {
    const times = this._frameTimes;
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const fps = avgTime > 0 ? Math.round(1000 / avgTime) : 0;

    return {
      fps: Math.min(fps, 999), // cap display
      avgFrameTime: Math.round(avgTime * 100) / 100,
      totalDots: this._stats.totalDots,
      frameCount: this._stats.frameCount,
    };
  }

  _updateOverlay() {
    if (!this._overlay) return;
    const stats = this.getStats();
    this._overlay.innerHTML = `FPS: ${stats.fps}<br>Frame: ${stats.avgFrameTime}ms<br>Dots: ${stats.totalDots}`;
  }
}

export default MarqueeDevTools;
