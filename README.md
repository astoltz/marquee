# Marquee Sign Library

Programmable marquee sign library for the browser. Scroll, flash, fade, slide, and float text with LED dot-matrix, split-flap, flip-tile, incandescent bulb, and modern text rendering modes. Simulates real hardware sign limitations — restricted color palettes, mechanical flip-tile cascades, split-flap character wheels, warm bulb glow.

## Quick Start

```html
<div id="my-sign"></div>
<script src="marquee.umd.js"></script>
<script>
  const sign = new Marquee('#my-sign', {
    preset: 'led-mono',
    cols: 80,
    rows: 9,
  });

  sign.sequence([
    { text: 'Hello World', phase: 'scroll-left', until: 'center', speed: 100 },
    { phase: 'flash', times: 3, interval: 300, color: '#ffff00' },
    { phase: 'pause', duration: 2000 },
    { phase: 'fade-out', duration: 500 },
  ]);

  sign.play();
</script>
```

## ES Module

```js
import { Marquee } from 'marquee-sign';

const sign = new Marquee('#el', { preset: 'flip-tile', cols: 60, rows: 9 });
sign.sequence([...]).play();
```

## Hardware Presets

These simulate real-world sign hardware with constrained palettes, dot shapes, and animation feel.

| Preset | Description | Colors |
|--------|-------------|--------|
| `flip-tile` | Waseca-style green/black mechanical flip dots with cascade animation | 1 (configurable) |
| `flip-tile-yellow` | Yellow/black transit flip dots | 1 (configurable) |
| `bulb` | Bank-style incandescent bulbs with warm glow and flicker | 2 (amber, red) |
| `bulb-theater` | Theater marquee with bright warm bulbs | 2 (white, warm) |
| `led-mono` | Early LED, red only | 1 (configurable) |
| `led-mono-green` | Early LED, green only | 1 (configurable) |
| `led-mono-amber` | Early LED, amber only | 1 (configurable) |
| `led-14` | 90s/2000s multi-color LED (~14 fixed colors) | 14 |
| `led-rgb` | Modern full-color RGB LED | Unlimited |
| `split-flap` | Airport departure board with character wheel cycling | N/A |
| `split-flap-clock` | Flip alarm clock (5 cells, numeric wheel) | N/A |

When using a preset with a restricted palette, colors are automatically snapped to the nearest allowed color. Flip-tile presets render a visible column-by-column cascade when dots change.

### Configurable Mono-Color Presets

Mono-color presets (`flip-tile`, `flip-tile-yellow`, `led-mono`, `led-mono-green`, `led-mono-amber`) accept a custom `color` option:

```js
new Marquee('#el', { preset: 'flip-tile', color: '#ff0000' }); // Red flip tiles
new Marquee('#el', { preset: 'led-mono', color: '#00ccff' });  // Cyan LED
```

To bypass the mono-color restriction entirely (impossible on real hardware, but fun):

```js
new Marquee('#el', { preset: 'flip-tile', forceMultiColor: true });
```

## Animation Phases

| Phase | Key Options | Description |
|-------|-------------|-------------|
| `scroll-left` | `speed`, `until` | Scroll text from right to left |
| `scroll-right` | `speed`, `until` | Scroll text from left to right |
| `slide-in` | `duration`, `from`, `easing` | Slide text in from side to center |
| `slide-out` | `duration`, `from`, `easing` | Slide text out from center to side |
| `flash` | `times`, `interval` | Blink text on/off |
| `pause` | `duration` | Hold current state |
| `float-up` | `duration`, `distance`, `easing` | Float text upward |
| `float-down` | `duration`, `distance`, `easing` | Float text downward |
| `fade-in` | `duration`, `easing` | Fade text from transparent |
| `fade-out` | `duration`, `easing` | Fade text to transparent |
| `wipe-in` | `duration`, `easing` | Reveal text left-to-right |
| `wipe-out` | `duration`, `easing` | Hide text left-to-right |
| `split-flap` | `text` | Split-flap character wheel cycling |
| `random` | *(inherits from chosen)* | Picks a random phase each time |

### Scroll `until` options

- `'center'` — stop when text reaches horizontal center
- `'offscreen'` — continue until fully off-screen (default)
- `number` — stop at specific pixel/dot offset

## Colors

Colors can be specified three ways:

```js
// Single color
color: '#ff3300'

// Array (wraps for each character)
color: ['#ff0000', '#00ff00', '#0000ff']

// Function (per character, animated)
color: (charIndex, char, progress) => `hsl(${charIndex * 30}, 100%, 50%)`
```

### Tri-color stripes

```js
// Red-white-blue per character
const rwb = ['#ff0000', '#ffffff', '#0066ff'];
color: (i) => rwb[i % 3]
```

### Horizontal stripes

Use `stripeDirection: 'horizontal'` to apply array colors per row instead of per character:

```js
{
  text: 'America!',
  phase: 'scroll-left',
  color: ['#ff0000','#ff0000','#ff0000', '#ffffff','#ffffff','#ffffff', '#0066ff','#0066ff','#0066ff'],
  stripeDirection: 'horizontal',
  until: 'center',
  speed: 100,
}
```

On preset signs with limited palettes, colors are snapped to the nearest available color.

## Cycling Messages

Use `phase: 'random'` to pick a random animation for each message:

```js
sign.sequence([
  { text: 'Message one', phase: 'random', speed: 100, until: 'center', duration: 800 },
  { phase: 'pause', duration: 1500 },
  { phase: 'fade-out', duration: 400 },
  { text: 'Message two', phase: 'random', speed: 100, until: 'center', duration: 800 },
  { phase: 'pause', duration: 1500 },
  { phase: 'fade-out', duration: 400 },
]);
```

## Split-Flap Display

Simulates airport departure boards and flip alarm clocks. Each character position independently cycles through a character wheel.

```js
const board = new Marquee('#departures', { preset: 'split-flap' });
board.sequence([
  { text: 'FLIGHT 247 ON TIME', phase: 'split-flap' },
  { phase: 'pause', duration: 3000 },
  { text: 'FLIGHT 247 DELAYED', phase: 'split-flap' },
]);
board.play();
```

Split-flap options: `cellCount` (characters), `charWidth`, `charHeight`, `cellGap`, `flipDuration` (ms per flip), `splitFlapStagger` (ms between cells), `splitFlapCase` (`'upper'` or `'mixed'`), `wheelOrder` (custom character wheel string).

The `split-flap-clock` preset is optimized for time display with a 5-cell numeric wheel.

## Token System

Dynamic text tokens are resolved at render time:

```js
const sign = new Marquee('#el', {
  preset: 'led-mono',
  tokens: { location: 'GATE B12' },
});

sign.sequence([
  { text: 'TIME: {time} — {location}', phase: 'scroll-left', liveTokens: true },
]);
```

Built-in tokens: `{time}`, `{date}`, `{datetime}`, `{year}`, `{date:FORMAT}` (PHP-style: Y, m, d, H, i, s, A, g, F, l). Data attributes: `{data:ATTR}` reads `data-ATTR` from the container element. Custom tokens: `{key}` from the `tokens` option or `setTokens()`.

Use `liveTokens: true` on a step to re-resolve tokens every frame (for clocks).

## Stuck Tiles (Simulated Hardware Failures)

Simulate broken/stuck dots for realistic wear effects:

```js
sign.setStuckTiles({
  '3,15': 'on',   // row 3, col 15 always lit
  '5,22': 'off',  // row 5, col 22 always dark
});
```

Wear tracking: `sign.getFlipCounts()` returns a `Uint32Array` of flip counts per tile.

## JSON File Loading

Load sequences from an external JSON file. A dynamic app can write this file and the sign picks it up automatically.

```js
sign.loadURL('sign-sequence.json', {
  pollInterval: 600000,   // reload every 10 minutes
  // pollAt: '06:00',     // or reload at a specific time of day
});
```

JSON file format (`sign-sequence.json`):

```json
{
  "options": { "loop": true },
  "sequence": [
    { "text": "Hello", "phase": "scroll-left", "until": "center", "speed": 100 },
    { "phase": "pause", "duration": 2000 },
    { "phase": "fade-out", "duration": 500 }
  ]
}
```

The `options` block can include any Marquee option (preset, colors, loop, etc.). Edit the file and the sign updates on the next poll.

### Self-Describing Refresh

The JSON file can specify its own refresh interval and chain-load other URLs:

```json
{
  "refreshInterval": 60000,
  "loadUrl": "https://api.example.com/sign-data.json",
  "sequence": [...]
}
```

Chain-loading respects same-origin policy by default. Configure `allowedOrigins` to permit cross-origin chain-loads. Maximum chain depth: 3 (configurable via `maxChainDepth`).

## WebSocket Live Control

```js
sign.connectWS('ws://localhost:8080');
```

Server sends JSON messages:

```json
{ "action": "sequence", "steps": [...] }
{ "action": "setText", "text": "New message", "color": "#00ff00" }
{ "action": "play" }
{ "action": "pause" }
{ "action": "stop" }
{ "action": "setColor", "color": "#00ff00" }
{ "action": "setStuckTiles", "tiles": { "3,15": "on" } }
{ "action": "config", "options": { "loop": true } }
{ "action": "tokenUpdate", "tokens": { "temp": "72F" } }
```

Auto-reconnect is enabled by default. Clients auto-register with the server on connect.

### WebSocket Server & Admin Panel

A Node.js WebSocket server with admin panel is included:

```bash
npm run serve:ws   # starts server on port 8080
```

The admin panel (`admin/index.html`) provides:
- Dashboard with live viewer count and current sequence
- Sequences CRUD with JSON editor and live preview
- Global config: preset, color, stuck tiles visual grid editor
- Scheduler: time ranges and cron expressions for automated sequence changes
- Viewer management: list connected viewers, push to specific clients

Admin authentication uses HTTP Basic Auth (set `ADMIN_USER`/`ADMIN_PASS` env vars).

## Performance DevTools

A separate bundle for development performance monitoring:

```js
import { MarqueeDevTools } from 'marquee-sign/devtools';

const dt = new MarqueeDevTools(marqueeInstance);
dt.enable();   // shows FPS overlay
dt.getStats(); // { fps, avgFrameTime, totalDots, frameCount }
dt.disable();
```

Not included in the main bundle — import from `dist/marquee.devtools.js`.

## API

See [API.md](API.md) for full reference.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for code structure and design decisions.

## Embedding on a Website

See [`embed.html`](embed.html) for a copy-paste example. Two variants are included:

- **Self-hosted**: Load `marquee.umd.js` from your server and configure inline
- **JSON-driven**: Load the sequence from a JSON endpoint so content can be updated without code changes

Minimal embed:

```html
<div id="sign"></div>
<link rel="stylesheet" href="marquee.css">
<script src="marquee.umd.js"></script>
<script>
  var sign = new MarqueeLib.Marquee('#sign', {
    preset: 'led-mono', cols: 80, rows: 9, loop: true,
  });
  sign.sequence([
    { text: 'Hello', phase: 'scroll-left', until: 'center', speed: 100 },
    { phase: 'pause', duration: 2000 },
    { phase: 'fade-out', duration: 500 },
  ]);
  sign.play();
</script>
```

## Demo

Open `demo/index.html` in a browser (after building with `npm run build`).

The demo uses a tabbed interface with lazy-loaded sections — each sign only initializes when its tab is first selected. URL hash anchors (`#featured`, `#builder`, etc.) preserve the active tab across page refreshes. A **Demo Mode** button auto-rotates through all tabs every 8 seconds.

Sections:
- Featured sequence (scroll, flash, float, fade with new text)
- Cycling messages with random phase selection
- Tri-color stripe with `stripeDirection: 'horizontal'` (including mono-color preset demo and `forceMultiColor` demo)
- Flip-tile with wipe transitions and 14-row tall sign (Waseca-style page cycling)
- Split-flap departure board and clock displays
- Modern CSS text mode
- JSON file polling
- All 11 hardware presets
- Visual sequence builder with GUI step cards, context-sensitive form fields, and bi-directional JSON sync

## Reproduction Prompt

See [`PROMPT.md`](PROMPT.md) for a comprehensive description of the entire project — enough detail for an AI or developer to reproduce it from scratch.

## Build

```bash
npm install
npm run build    # produces dist/
npm run dev      # watch mode
npm run lint     # ESLint
npm test         # unit tests (node:test + jsdom)
npm run serve:ws # WebSocket server + admin panel
```

## License

MIT
