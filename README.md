# Marquee Sign Library

Programmable marquee sign library for the browser. Scroll, flash, fade, slide, and float text with LED dot-matrix, flip-tile, incandescent bulb, and modern text rendering modes. Simulates real hardware sign limitations — restricted color palettes, mechanical flip-tile cascades, warm bulb glow.

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
| `flip-tile` | Waseca-style green/black mechanical flip dots with cascade animation | 1 (green) |
| `flip-tile-yellow` | Yellow/black transit flip dots | 1 (yellow) |
| `bulb` | Bank-style incandescent bulbs with warm glow and flicker | 2 (amber, red) |
| `bulb-theater` | Theater marquee with bright warm bulbs | 2 (white, warm) |
| `led-mono` | Early LED, red only | 1 (red) |
| `led-mono-green` | Early LED, green only | 1 (green) |
| `led-mono-amber` | Early LED, amber only | 1 (amber) |
| `led-14` | 90s/2000s multi-color LED (~14 fixed colors) | 14 |
| `led-rgb` | Modern full-color RGB LED | Unlimited |

When using a preset with a restricted palette, colors are automatically snapped to the nearest allowed color. Flip-tile presets render a visible column-by-column cascade when dots change.

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
```

Auto-reconnect is enabled by default.

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

The demo uses a tabbed interface with lazy-loaded sections — each sign only initializes when its tab is first selected. A **Demo Mode** button auto-rotates through all tabs every 8 seconds.

Sections:
- Featured sequence (scroll, flash, float, fade with new text)
- Cycling messages with random phase selection
- Tri-color stripe with `stripeDirection: 'horizontal'`
- Flip-tile with visible cascade animation
- Modern CSS text mode
- JSON file polling
- All 9 hardware presets
- Interactive sequence builder with preset switcher

## Reproduction Prompt

See [`PROMPT.md`](PROMPT.md) for a comprehensive description of the entire project — enough detail for an AI or developer to reproduce it from scratch.

## Build

```bash
npm install
npm run build    # produces dist/
npm run dev      # watch mode
```
