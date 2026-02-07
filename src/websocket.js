// WebSocket client for live sign control
//
// Connects to a server, receives JSON commands that map
// directly to Marquee public API methods.

export class SignSocket {
  constructor(marquee, url, options = {}) {
    this.marquee = marquee;
    this.url = url;
    this.options = options;
    this.ws = null;
    this.reconnectTimer = null;
    this.destroyed = false;
  }

  connect() {
    if (this.destroyed) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.marquee.emit('ws:error', { error: e });
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.marquee.emit('ws:open', {});
      // Send registration
      this.send({
        type: 'register',
        role: this.options.role || 'viewer',
        token: this.options.token || undefined,
      });
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        this.marquee.emit('ws:error', { error: e, raw: event.data });
        return;
      }

      this.marquee.emit('ws:message', msg);
      this._handleMessage(msg);
    };

    this.ws.onclose = (event) => {
      this.marquee.emit('ws:close', { code: event.code, reason: event.reason });
      this._scheduleReconnect();
    };

    this.ws.onerror = (event) => {
      this.marquee.emit('ws:error', { error: event });
    };
  }

  _handleMessage(msg) {
    const { action, ...params } = msg;

    switch (action) {
      case 'sequence':
        this.marquee.sequence(params.steps || []);
        if (params.autoPlay !== false) this.marquee.play();
        break;
      case 'setText':
        this.marquee.setText(params.text, params);
        break;
      case 'play':
        this.marquee.play();
        break;
      case 'pause':
        this.marquee.pause();
        break;
      case 'stop':
        this.marquee.stop();
        break;
      case 'setTheme':
        this.marquee.setTheme(params);
        break;
      case 'setColor':
        if (params.color) this.marquee.setColor(params.color);
        break;
      case 'setStuckTiles':
        if (params.tiles) this.marquee.setStuckTiles(params.tiles);
        break;
      case 'getStatus':
        this.send({
          type: 'status',
          playing: this.marquee.timeline.state === 1,
          preset: this.marquee.options.preset || null,
          color: this.marquee.options.color,
        });
        break;
      case 'config':
        // Catch-all global config push
        if (params.preset || params.led) {
          this.marquee.setTheme(params);
        }
        if (params.color) {
          this.marquee.setColor(params.color);
        }
        if (params.stuckTiles) {
          this.marquee.setStuckTiles(params.stuckTiles);
        }
        if (params.tokens) {
          this.marquee.setTokens(params.tokens);
        }
        break;
      case 'tokenUpdate':
        if (params.tokens) {
          this.marquee.setTokens(params.tokens);
        }
        break;
      default:
        this.marquee.emit('ws:unknown', msg);
    }
  }

  _scheduleReconnect() {
    if (this.destroyed) return;
    if (this.options.reconnect === false) return;

    const interval = this.options.reconnectInterval || 3000;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, interval);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
    }
    this.ws = null;
  }
}
