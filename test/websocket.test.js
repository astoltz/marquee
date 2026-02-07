import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SignSocket } from '../src/websocket.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    // Auto-fire onopen
    setTimeout(() => this.onopen && this.onopen(), 0);
  }
  send(data) { this.sent.push(data); }
  close() { this.onclose && this.onclose({ code: 1000, reason: 'normal' }); }
}

function mockMarquee() {
  const calls = [];
  const events = [];
  return {
    calls,
    events,
    sequence(steps) { calls.push({ method: 'sequence', steps }); },
    play() { calls.push({ method: 'play' }); },
    pause() { calls.push({ method: 'pause' }); },
    stop() { calls.push({ method: 'stop' }); },
    setText(text, opts) { calls.push({ method: 'setText', text, opts }); },
    setTheme(opts) { calls.push({ method: 'setTheme', opts }); },
    emit(event, data) { events.push({ event, data }); },
  };
}

describe('SignSocket', () => {
  beforeEach(() => {
    MockWebSocket.OPEN = 1;
    global.WebSocket = MockWebSocket;
    global.setTimeout = globalThis.setTimeout;
    global.clearTimeout = globalThis.clearTimeout;
  });

  it('constructs without connecting', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', {});
    assert.equal(socket.ws, null);
    assert.equal(socket.destroyed, false);
  });

  it('connects and emits ws:open', async () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    // Wait for async onopen
    await new Promise(r => setTimeout(r, 10));
    const openEvent = marquee.events.find(e => e.event === 'ws:open');
    assert.ok(openEvent, 'Should emit ws:open');
    socket.destroy();
  });

  it('dispatches sequence action', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    // Simulate message
    socket._handleMessage({ action: 'sequence', steps: [{ text: 'A', phase: 'pause' }] });
    assert.equal(marquee.calls[0].method, 'sequence');
    assert.equal(marquee.calls[1].method, 'play');
    socket.destroy();
  });

  it('dispatches setText action', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    socket._handleMessage({ action: 'setText', text: 'HELLO' });
    assert.equal(marquee.calls[0].method, 'setText');
    assert.equal(marquee.calls[0].text, 'HELLO');
    socket.destroy();
  });

  it('dispatches play/pause/stop', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    socket._handleMessage({ action: 'play' });
    socket._handleMessage({ action: 'pause' });
    socket._handleMessage({ action: 'stop' });
    assert.equal(marquee.calls[0].method, 'play');
    assert.equal(marquee.calls[1].method, 'pause');
    assert.equal(marquee.calls[2].method, 'stop');
    socket.destroy();
  });

  it('dispatches setTheme action', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    socket._handleMessage({ action: 'setTheme', preset: 'led-14' });
    assert.equal(marquee.calls[0].method, 'setTheme');
    socket.destroy();
  });

  it('emits ws:unknown for unrecognized actions', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    socket._handleMessage({ action: 'bogus' });
    const unknownEvent = marquee.events.find(e => e.event === 'ws:unknown');
    assert.ok(unknownEvent);
    socket.destroy();
  });

  it('send sends JSON', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', { reconnect: false });
    socket.connect();
    socket.send({ type: 'hello' });
    assert.equal(socket.ws.sent.length, 1);
    assert.equal(socket.ws.sent[0], '{"type":"hello"}');
    socket.destroy();
  });

  it('destroy prevents reconnect', () => {
    const marquee = mockMarquee();
    const socket = new SignSocket(marquee, 'ws://test', {});
    socket.destroy();
    assert.equal(socket.destroyed, true);
    socket.connect(); // should be a no-op
    assert.equal(socket.ws, null);
  });
});
