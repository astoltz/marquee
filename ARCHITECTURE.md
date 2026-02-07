# Architecture

This document describes the code structure, data flow, and design decisions for the Marquee Sign Library. It is written for AI assistants and developers who need to understand or modify the codebase.

## File Structure

```
src/
  index.js      — Public API (Marquee class), wires together all components
  timeline.js   — Animation sequencer, drives requestAnimationFrame loop
  phases.js     — Animation phase implementations (scroll, slide, flash, fade, float, wipe, split-flap, random)
  renderer.js   — DOM rendering (modern text + LED dot-matrix + split-flap modes)
  colors.js     — Color resolution (string, array, function) and palette snapping
  presets.js    — Hardware sign presets (flip-tile, bulb, LED, split-flap variants)
  defaults.js   — Default options, easing functions, 5x7 dot-matrix font data
  tokens.js     — Token resolution engine ({time}, {date}, {data:ATTR}, custom tokens)
  styles.css    — Base CSS including split-flap 3D flip animations
  websocket.js  — WebSocket client for live sign control
  devtools.js   — Performance monitoring overlay (separate bundle)

dist/           — Build output (esbuild)
  marquee.esm.js      — ES module bundle
  marquee.umd.js      — UMD/IIFE bundle (window.MarqueeLib)
  marquee.devtools.js — DevTools bundle (not included in main)
  marquee.css          — Compiled CSS

server/
  ws-server.mjs       — HTTP + WebSocket server with admin auth
  store.mjs           — In-memory state store with JSON persistence
  scheduler.mjs       — Schedule evaluator (time ranges + cron)
  viewer-tracker.mjs  — Connected viewer management

admin/
  index.html          — Admin panel (dashboard, sequences, config, scheduler, viewers)

demo/
  index.html          — Full demo: tabbed UI with lazy-loaded sections, Demo Mode auto-rotation
  sign-sequence.json  — Example JSON file for loadURL() polling

test/
  colors.test.js      — Color resolution and palette snapping tests
  defaults.test.js    — Defaults, easings, and font data tests
  phases.test.js      — All 13 phase factory tests
  presets.test.js     — Preset structure and validation tests
  renderer.test.js    — DOM rendering tests (modern + LED modes)
  timeline.test.js    — Sequencer state machine tests
  websocket.test.js   — WebSocket message dispatch tests
  marquee.test.js     — Integration tests

embed.html            — Drop-in embed example (self-hosted + JSON-driven variants)
server.mjs            — Dev server for local testing (node server.mjs)
```

## Data Flow

```
User Code
  │
  ▼
Marquee (index.js)          ◄── Public API
  │  - merges preset + defaults + user options
  │  - manages lifecycle (play/pause/stop/destroy)
  │  - event emitter for phaseStart/phaseEnd/sequenceEnd
  │
  ├──► Timeline (timeline.js)    ◄── Animation loop
  │      - holds array of step configs
  │      - runs requestAnimationFrame loop (with optional maxFps cap)
  │      - builds Phase instances on demand
  │      - advances to next phase when current completes
  │      │
  │      ├──► Phase (phases.js)   ◄── Per-phase logic
  │      │      - start(), update(dt), getState()
  │      │      - each phase type is a factory function
  │      │      - returns a state object each frame:
  │      │        { text, offsetX, offsetY, opacity, visible, colors, progress }
  │      │      - token resolution via tokens.js before text reaches phase
  │      │
  │      ├──► Tokens (tokens.js)  ◄── Dynamic text replacement
  │      │      - resolves {time}, {date}, {data:ATTR}, custom tokens
  │      │      - liveTokens: re-resolves every frame
  │      │
  │      └──► Colors (colors.js)  ◄── Color resolution
  │             - resolves string/array/function color configs
  │             - snaps to preset palette if constrained
  │
  ├──► Renderer (renderer.js)    ◄── DOM updates
  │      - receives state object from Timeline each frame
  │      - three modes: modern (CSS spans), LED (dot grid), split-flap (3D flip cells)
  │      - diffs against previous state to minimize DOM writes
  │      - stuck tile overrides and flip count tracking
  │
  ├──► SignSocket (websocket.js) ◄── WebSocket client
  │      - receives JSON commands from server
  │      - maps actions to Marquee public methods
  │      - auto-registers on connect, supports admin tokens
  │      - handles config push, token updates, status requests
  │      - auto-reconnects on disconnect
  │
  └──► loadURL / polling           ◄── JSON file loading
         - fetches JSON from URL via fetch()
         - applies sequence + options from file
         - polls on interval or at scheduled time-of-day
         - self-describing refresh via refreshInterval in JSON
         - chain-loading via loadUrl with origin whitelist
```

### Server Architecture

```
WebSocket Server (server/ws-server.mjs)
  │
  ├──► Store (store.mjs)           ◄── State persistence
  │      - sequences CRUD, activeSequence, globalConfig
  │      - persists to server/data.json
  │
  ├──► Scheduler (scheduler.mjs)   ◄── Automated sequencing
  │      - time range entries (start/end)
  │      - cron expressions (minute hour dom month dow)
  │      - evaluates every 60s, activates matching sequence
  │
  └──► ViewerTracker (viewer-tracker.mjs)  ◄── Connection management
         - tracks viewers with unique IDs and roles
         - broadcast to all, send to specific viewer
         - stats broadcast every 30s
```

## Key Design Decisions

### Three Rendering Modes

**Modern mode** uses standard DOM: a container div with character `<span>` elements positioned via `translate3d()` for GPU acceleration. Good for large text, accessible to screen readers.

**LED mode** uses a CSS Grid of `<div>` dots. Each dot is styled individually. A 5x7 bitmap font maps characters to dot positions. For an 80x12 grid (960 dots), DOM performance is acceptable. This approach keeps everything in DOM (no Canvas) for simplicity and debuggability.

**Split-flap mode** creates a row of fixed-width `<div class="marquee-sf-cell">` elements, each with upper/lower flap halves. When text changes, each cell cycles through a character wheel with staggered timing and CSS `rotateX()` 3D transforms. The renderer tracks current vs. target characters per cell and reports completion via a `splitFlapComplete` flag.

### Hardware Presets

Presets are plain objects in `presets.js` that override visual options to simulate real sign hardware:

- **Color palette restriction**: Each preset defines an array of allowed colors. Any user-specified color is snapped to the nearest palette color using RGB distance.
- **Mono-color presets**: Presets with `monoColor: true` (flip-tile, led-mono variants) accept a custom `color` option that overrides the default palette. Setting `forceMultiColor: true` bypasses this restriction entirely, allowing per-character colors on hardware that normally supports only a single color.
- **Dot appearance**: Shape (circle/square), size, gap, glow amount, and off-state color.
- **Transition style**: How dots change state — `instant` (LED), `warm` (incandescent bulb warm-up/cool-down), or `flip` (mechanical tile).
- **Split-flap presets**: Define cell count, dimensions, flip duration, stagger, and character wheel.

When a preset is selected, the appropriate rendering mode (LED or split-flap) is forced on automatically.

### Phase System

Phases are stateless factories. Each factory receives config and returns an object with `start()`, `update(dt)`, and `getState()`. The Timeline calls `update()` each frame and passes the returned state to the Renderer.

All phases produce the same state shape, so the Renderer doesn't need to know which phase is active:

```js
{
  text: 'Hello',
  offsetX: 42.5,            // horizontal position
  offsetY: 0,               // vertical position
  opacity: 1,               // 0-1
  visible: true,            // flash toggle
  colors: ['#f00'],         // per-character colors
  progress: 0.65,           // 0-1 phase progress
  stripeDirection: undefined, // 'horizontal' or undefined (per-char default)
  wipeProgress: 0.5,        // optional: wipe reveal progress
}
```

### Flip-Tile Cascade Animation

Flip-tile presets (`flipAnimation: true`) don't update all dots at once. Instead, the renderer maintains two buffers: the *target* state (what dots should be) and the *visible* state (what dots currently are). When the target changes, the renderer queues column-by-column flip events with a configurable delay (`flipSpeed`, default 30ms per column). On each render frame, pending flips whose time has arrived are applied to the visible buffer. This creates the mechanical wave effect of real flip-dot displays.

### Random Phase

The `'random'` phase type doesn't have its own implementation. When `createPhase()` encounters `phase: 'random'`, it picks a random type from the available animated phases (scroll, flash, fade, wipe, float) and delegates to that factory. This means all phase options (speed, duration, times, etc.) are passed through and used by whichever phase is randomly selected.

### Token Resolution

The token system (`tokens.js`) resolves `{placeholder}` patterns in text strings. Resolution happens in `createPhase()` before the text reaches phase factories. Built-in tokens (`{time}`, `{date}`, `{year}`, `{date:FORMAT}`) use client-side date/time. `{data:ATTR}` reads HTML `data-*` attributes from the container element. Custom tokens come from the `tokens` option or `setTokens()` method. When `liveTokens: true` is set on a step, the phase's `update()` function is wrapped to re-resolve tokens every frame, enabling real-time clock displays.

### Stuck Tiles & Wear Tracking

The renderer maintains a `_stuckTiles` Map (keyed by `"row,col"`) that overrides dot states after normal rendering. Stuck `"on"` tiles always show the active color; stuck `"off"` tiles always show the off-state color. A `_flipCounts` Uint32Array tracks how many times each tile has flipped, incremented during `_processFlipQueue`. Both features are accessible via public API methods.

### JSON File Loading

`loadURL(url, opts)` uses `fetch()` with `cache: 'no-store'` to load a JSON file. The file format is `{ options: {...}, sequence: [...] }`. Options are applied via `setTheme()` if they change the preset, otherwise merged directly. The sequence is applied and auto-played. Polling is supported via `setInterval` (for periodic reload) or a self-rescheduling `setTimeout` (for time-of-day reload with `pollAt`).

The JSON file can specify `refreshInterval` to self-describe its polling rate, and `loadUrl` for chain-loading another JSON endpoint. Chain-loading respects same-origin policy and an optional `allowedOrigins` whitelist, with `maxChainDepth: 3` to prevent infinite loops.

### Lazy-Loading Demo

The demo page (`demo/index.html`) uses a tabbed interface where each demo section's sign is only initialized when the tab is first selected. An `initialized` map tracks which demos have been set up. A Demo Mode button auto-rotates through all tabs every 8 seconds, triggering lazy initialization as it goes. URL hash anchors (`#featured`, `#builder`, etc.) persist the active tab across page refreshes. The Builder tab features a visual GUI sequence builder with step cards, context-sensitive form fields, and bi-directional sync with a JSON code editor.

### Timeline Sequencer

The Timeline is a simple state machine: IDLE → PLAYING → (phase done) → next phase or DONE. It uses a single `requestAnimationFrame` loop. Phases are built lazily — only constructed when reached in the sequence. Each phase receives the previous phase's final state so it can inherit position/text.

### Color System

Colors resolve through three forms:
1. **String**: Applied to all characters
2. **Array**: Wraps around for each character index
3. **Function**: Called per-character with `(index, char, progress)` — enables animated rainbow effects

After resolution, colors are optionally snapped to the preset's palette using simple RGB Euclidean distance.

### WebSocket Protocol

The WebSocket client is intentionally thin. It receives JSON, extracts the `action` field, and calls the corresponding Marquee method. This means any new API method is automatically available over WebSocket without protocol changes.

Additional actions beyond method-mapping: `setColor` (update mono-preset palette), `setStuckTiles` (hardware failure simulation), `getStatus` (client responds with state), `config` (catch-all global config push), and `tokenUpdate` (live token updates). Clients auto-register on connect with role and optional admin token.

### Mobile Performance

On mobile devices (detected via UA string), `maxFps` defaults to 30. The Timeline's `_tick()` loop skips frames when `dt` is below the threshold, reducing CPU/GPU load. This is configurable via the `maxFps` option.

### Style Injection

The library auto-injects minimal CSS into `<head>` on first instantiation. If the page already has a `[data-marquee-styles]` element, injection is skipped. This allows users to include `marquee.css` manually for full control.

## Build System

esbuild produces three bundles:
- **ESM** (`marquee.esm.js`) — for `import` usage, tree-shakeable
- **UMD** (`marquee.umd.js`) — for `<script>` tags, exposes `window.MarqueeLib`
- **DevTools** (`marquee.devtools.js`) — performance monitoring, not included in main bundle

CSS is copied from `src/styles.css` to `dist/marquee.css`.

## Testing

Tests use `node:test` (built-in Node 20+) with `jsdom` for DOM simulation. Test files cover colors, defaults, phases, presets, renderer, timeline, websocket, and integration. Run with `npm test`.

## Extension Points

### Custom Phases

```js
Marquee.registerPhase('wiggle', (config, containerWidth, textWidth, prevState, presetColors) => {
  const state = { /* initial state */ };
  return {
    start() { /* init */ },
    update(dt) { /* advance, return true when done */ },
    getState() { return state; },
  };
});
```

### Custom Presets

Presets are just option objects. Users can pass any preset properties directly:

```js
new Marquee('#el', {
  led: true,
  dotSize: 8,
  dotShape: 'square',
  dotGap: 3,
  cols: 40,
  rows: 7,
  background: '#000',
  color: '#ff0000',
  glowAmount: 0,
  offColor: '#110000',
});
```

### WebSocket Server

Any WebSocket server that sends JSON with `{ action: "...", ... }` will work. Example Node.js server:

```js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  // Send a sequence
  ws.send(JSON.stringify({
    action: 'sequence',
    steps: [
      { text: 'BREAKING NEWS', phase: 'scroll-left', color: '#ff0000', until: 'center' },
      { phase: 'flash', times: 5, interval: 200 },
    ],
  }));
});
```
