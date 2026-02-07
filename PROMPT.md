# Reproduction Prompt — Marquee Sign Library

This document describes the Marquee Sign Library in enough detail that an AI or developer could reproduce it from scratch.

## Project Goal

Build a browser-based programmable marquee sign library. It should simulate real-world sign hardware — LED dot-matrix, split-flap display, mechanical flip-tile, incandescent bulb, and modern CSS text — with animation phases that can be sequenced, looped, and driven from JSON files or WebSocket.

The library ships as three bundles: an ES module for `import` usage, a UMD/IIFE bundle that exposes `window.MarqueeLib` for `<script>` tag usage, and a separate DevTools bundle for performance monitoring.

## Philosophy

- **Hardware realism**: Presets restrict color palettes, dot shapes, glow, and transition styles to match actual physical signs. A flip-tile preset only allows one color and animates dots in a mechanical column-by-column cascade. A bulb preset has warm-up/cool-down time and occasional flicker.
- **Simple sequencing**: Users define a flat array of phase steps. Each step has a `phase` type and options. The library plays them in order.
- **Minimal DOM**: LED mode uses a CSS Grid of `<div>` dots rather than Canvas. Modern mode uses positioned `<span>` elements with `translate3d()` for GPU acceleration. No Canvas, no WebGL — everything is debuggable in DevTools.
- **Zero dependencies**: Pure vanilla JavaScript, no framework.

## Features

### Rendering Modes

**Modern text mode** (default when no preset): Standard DOM spans, any CSS font, arbitrary colors. Good for large text.

**LED dot-matrix mode** (forced on by LED/flip-tile/bulb presets): A grid of `<div>` dots laid out with CSS Grid. Each dot is styled individually (color, glow, shape). A 5x7 bitmap font maps characters to dot positions. For an 80-column, 9-row grid that's 720 dots — DOM performance is fine.

**Split-flap mode** (forced on by split-flap presets): A row of fixed-width `<div>` cells, each with upper/lower flap halves. Characters cycle through a wheel with CSS `rotateX()` 3D transforms. Staggered per-cell timing creates the cascading mechanical effect of real split-flap displays.

### Hardware Presets

Eleven presets defined as plain option objects:

| Preset | Colors | Dot | Transition | Notes |
|--------|--------|-----|------------|-------|
| `flip-tile` | 1 (green) | square, 6px, gap 2 | flip (cascade) | Column-by-column flip delay |
| `flip-tile-yellow` | 1 (yellow) | square, 6px, gap 2 | flip (cascade) | Transit signs |
| `bulb` | 2 (amber, red) | circle, 8px, gap 3 | warm (80ms up, 120ms down) | Flicker 0.2% chance/frame |
| `bulb-theater` | 2 (white, warm) | circle, 10px, gap 4 | warm (60ms up, 100ms down) | Larger glow |
| `led-mono` | 1 (red) | circle, 4px, gap 1 | instant | Scanline effect |
| `led-mono-green` | 1 (green) | circle, 4px, gap 1 | instant | Scanline effect |
| `led-mono-amber` | 1 (amber) | circle, 4px, gap 1 | instant | Scanline effect |
| `led-14` | 14 fixed | circle, 4px, gap 1 | instant | Scanline effect, palette snapping |
| `led-rgb` | unlimited | circle, 3px, gap 1 | instant | No restrictions |
| `split-flap` | N/A | 20 cells, 40x60px | character wheel | Airport departure board |
| `split-flap-clock` | N/A | 5 cells, 60x90px | numeric wheel | Flip alarm clock |

When a user specifies a color that isn't in a preset's palette, the library snaps it to the nearest palette color using Euclidean RGB distance. Mono-color presets (`flip-tile`, `led-mono` variants) accept a custom `color` option to override the default palette.

### Animation Phases

Phases are stateless factory functions. Each factory receives `(config, containerWidth, textWidth, prevState, presetColors)` and returns `{ start(), update(dt), getState() }`.

| Phase | Behavior |
|-------|----------|
| `scroll-left` | Move text from right edge leftward. `until: 'center'` stops at center, `'offscreen'` scrolls fully off. `speed` in px/sec. |
| `scroll-right` | Same, opposite direction. |
| `slide-in` | Slide from `from: 'left'|'right'` to center over `duration` ms with easing. |
| `slide-out` | Slide from center to off-screen. |
| `flash` | Toggle `visible` on/off for `times` repetitions at `interval` ms. |
| `pause` | Hold current state for `duration` ms. |
| `float-up` | Move text upward by `distance` over `duration` with easing. |
| `float-down` | Move text downward. |
| `fade-in` | Animate `opacity` from 0 to 1. |
| `fade-out` | Animate `opacity` from 1 to 0. |
| `wipe-in` | Reveal text left-to-right via `wipeProgress`. |
| `wipe-out` | Hide text left-to-right. |
| `split-flap` | Set text on split-flap display, cycles characters through wheel. Duration calculated from worst-case wheel distance. |
| `random` | Not its own implementation — picks randomly from the animated phases and delegates. |

All phases produce the same state shape:

```js
{
  text: 'Hello',
  offsetX: 42.5,
  offsetY: 0,
  opacity: 1,
  visible: true,
  colors: ['#f00'],
  progress: 0.65,
  stripeDirection: undefined,  // or 'horizontal'
  wipeProgress: 0.5,          // optional, wipe phases only
}
```

### Color System

Colors resolve through three forms:
1. **String** — applied to all characters
2. **Array** — wraps for each character index (or each row when `stripeDirection: 'horizontal'`)
3. **Function** — `(charIndex, char, progress) => colorString` for animated effects

`stripeDirection: 'horizontal'` on a phase step makes array colors apply per row instead of per character, enabling horizontal stripe patterns (e.g., red/white/blue flag bands).

After resolution, colors are snapped to the preset's palette if the preset has restricted colors.

### Flip-Tile Cascade

When `flipAnimation: true` (flip-tile presets), the renderer maintains two buffers: target state and visible state. When the target changes, column-by-column flip events are queued with `flipSpeed` ms delay between columns. Each render frame applies pending flips whose time has arrived. This creates the mechanical wave effect.

### Token System

Dynamic text tokens resolved at render time: `{time}`, `{date}`, `{datetime}`, `{year}`, `{date:FORMAT}` (PHP-style), `{data:ATTR}` (HTML data attributes), custom tokens from `tokens` option. `liveTokens: true` re-resolves every frame for clocks.

### Stuck Tiles & Wear Tracking

`setStuckTiles({ "row,col": "on"|"off" })` overrides individual dots. `getFlipCounts()` returns a Uint32Array of flip counts per tile for wear simulation.

### JSON File Loading

`loadURL(url, opts)` fetches JSON with `cache: 'no-store'`. Format: `{ options: {...}, sequence: [...] }`. Options can include any Marquee option. Polling is via `pollInterval` (ms) using `setInterval`, or `pollAt` (time-of-day string like `'06:00'`) using self-rescheduling `setTimeout`. JSON files can self-describe their refresh interval via `refreshInterval` and chain-load other URLs via `loadUrl` (with same-origin/allowedOrigins whitelist and maxChainDepth).

### WebSocket Live Control

`connectWS(url)` opens a WebSocket. Server sends JSON with an `action` field mapped directly to Marquee methods: `sequence`, `setText`, `play`, `pause`, `stop`, `setTheme`, `setColor`, `setStuckTiles`, `getStatus`, `config`, `tokenUpdate`. Clients auto-register on connect. Auto-reconnect on disconnect.

### Easing Functions

Five built-in: `linear`, `ease-in` (t^2), `ease-out` (t*(2-t)), `ease-in-out`, `step` (0 until t=1).

### Events

`phaseStart`, `phaseEnd`, `sequenceEnd`, `load`, `load:error`, `ws:open`, `ws:close`, `ws:message`, `ws:error`.

## File Structure

```
src/
  index.js       — Marquee class (public API), merges preset + defaults + user options,
                   manages lifecycle, event emitter
  timeline.js    — Animation sequencer, requestAnimationFrame loop, builds phases lazily,
                   advances on completion, maxFps frame cap
  phases.js      — Phase factory functions, makeState() helper, random phase delegation,
                   split-flap phase, token resolution integration
  renderer.js    — DOM rendering: modern text (spans + translate3d), LED mode
                   (CSS Grid of div dots), split-flap mode (3D flip cells),
                   flip cascade buffers, wipe clipping, stuck tiles, flip counts
  colors.js      — resolveColor(config, charIndex, char, progress), snapToPresetColor()
  presets.js     — PRESETS object (11 presets), snapToPresetColor(), getPresetDefaultColor()
  defaults.js    — DEFAULTS object, EASINGS, DOT_FONT (5x7 bitmap), CHAR_WIDTH (6), CHAR_HEIGHT (7)
  tokens.js      — Token resolution: {time}, {date}, {date:FORMAT}, {data:ATTR}, custom tokens
  styles.css     — Base styles + split-flap 3D flip animations
  websocket.js   — SignSocket class, JSON action dispatch, auto-register, auto-reconnect
  devtools.js    — Performance monitoring overlay (separate bundle)

dist/            — esbuild output
  marquee.esm.js      — ES module bundle
  marquee.umd.js      — UMD/IIFE bundle (window.MarqueeLib)
  marquee.devtools.js — DevTools bundle (not included in main)
  marquee.css         — Compiled CSS

server/
  ws-server.mjs       — HTTP + WebSocket server with admin auth
  store.mjs           — In-memory state store, persists to data.json
  scheduler.mjs       — Schedule evaluator (time ranges + cron)
  viewer-tracker.mjs  — Connected viewer management

admin/
  index.html          — Admin panel (dashboard, sequences, config, scheduler, viewers)

demo/
  index.html     — Full demo page with tabbed sections, lazy-loaded demos, Demo Mode
  sign-sequence.json — Example JSON for loadURL() polling

test/            — Unit tests (node:test + jsdom)
embed.html       — Drop-in embed example (self-hosted + JSON-driven variants)
server.mjs       — Dev server for local testing (node server.mjs)
API.md           — Full API reference
ARCHITECTURE.md  — Code structure and design decisions
PROMPT.md        — This file
README.md        — User-facing documentation
RESEARCH.md      — Animation pattern research for future phases
```

## Key Implementation Details

### 5x7 Dot Font

`defaults.js` contains `DOT_FONT`: a map from character to an array of 7 numbers, each a 5-bit bitmask (MSB = leftmost dot). Covers A-Z, a-z, 0-9, and common punctuation. `CHAR_WIDTH` is 6 (5 dots + 1 gap). `CHAR_HEIGHT` is 7.

### Grid Pixel Math

In LED mode, the grid is `cols * rows` dots. Each dot occupies `dotSize + dotGap` pixels. To render text, the renderer maps each character to its 5x7 bitmap and lights the corresponding dots in the grid, offset by `state.offsetX` (converted to dot columns).

### Phase State Inheritance

When a new phase starts, it receives the previous phase's final state. This allows text and position to carry over — e.g., after `scroll-left` stops at center, a `flash` phase inherits that centered position and text.

### Timeline State Machine

IDLE -> PLAYING -> (phase complete) -> next phase -> ... -> DONE. Single `requestAnimationFrame` loop. Phases are constructed lazily — only built when the sequencer reaches them.

### Style Injection

On first `Marquee` instantiation, minimal CSS is injected into `<head>` with a `[data-marquee-styles]` attribute. If that element already exists (user included `marquee.css` manually), injection is skipped.

### Build

esbuild produces ESM, UMD, and DevTools bundles. CSS is copied from `src/styles.css` to `dist/marquee.css`. No transpilation beyond what esbuild does by default. Unit tests use `node:test` with `jsdom`. ESLint enforces code quality.

## Demo Page

`demo/index.html` has a tabbed interface with 9 sections:

1. **Featured** — Showcase sequence: scroll, flash, float, fade with changing text
2. **Cycling** — Multiple messages with `phase: 'random'` selection
3. **Tri-Color** — Red/white/blue stripe demo using `stripeDirection: 'horizontal'`, including mono-color preset demo
4. **Flip-Tile** — Mechanical flip-dot display with visible cascade
5. **Split-Flap** — Airport departure board and flip clock demos
6. **Modern Text** — CSS text mode (no LED grid)
7. **Live Polling** — JSON file polling with `loadURL()`
8. **All Presets** — Grid of all 11 hardware presets side by side
9. **Builder** — Interactive sequence builder with preset switcher, side-by-side JSON editor and live preview

Each demo section is lazy-loaded: the sign is only initialized when its tab is first selected. A **Demo Mode** button auto-rotates through all tabs every 8 seconds. Mobile-responsive layout adjusts to viewport width.

## Embedding

To embed on any website, include `marquee.umd.js` and `marquee.css`, create a container `<div>`, and instantiate `new MarqueeLib.Marquee(selector, options)`. See `embed.html` for a copy-paste example with inline and JSON-driven variants.
