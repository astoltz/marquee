# API Reference

## `new Marquee(element, options)`

Create a new marquee sign instance.

### Parameters

- **element** `string | HTMLElement` — CSS selector or DOM element to render into
- **options** `object` — Configuration options

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | `string` | `null` | Hardware preset name (see Presets below) |
| `led` | `boolean` | `false` | Enable LED dot-matrix rendering |
| `splitFlap` | `boolean` | `false` | Enable split-flap rendering |
| `dotSize` | `number` | `4` | Size of each LED dot in pixels |
| `dotGap` | `number` | `1` | Gap between dots in pixels |
| `cols` | `number` | `80` | Grid width in dots (LED mode) |
| `rows` | `number` | `12` | Grid height in dots (LED mode) |
| `background` | `string` | `'#111111'` | Container background color |
| `color` | `string` | `'#ff3300'` | Default text color |
| `fontFamily` | `string` | `'monospace'` | Font for modern text mode |
| `fontSize` | `number` | `32` | Font size for modern text mode (px) |
| `speed` | `number` | `120` | Default scroll speed (px/sec) |
| `duration` | `number` | `1000` | Default phase duration (ms) |
| `easing` | `string` | `'linear'` | Default easing function |
| `loop` | `boolean` | `false` | Loop the sequence |
| `reconnect` | `boolean` | `true` | Auto-reconnect WebSocket |
| `reconnectInterval` | `number` | `3000` | WebSocket reconnect delay (ms) |
| `cellCount` | `number` | `20` | Number of character cells (split-flap mode) |
| `charWidth` | `number` | `40` | Cell width in px (split-flap mode) |
| `charHeight` | `number` | `60` | Cell height in px (split-flap mode) |
| `cellGap` | `number` | `3` | Gap between cells in px (split-flap mode) |
| `flipDuration` | `number` | `80` | Duration per character flip in ms (split-flap mode) |
| `splitFlapStagger` | `number` | `50` | Delay between cell starts in ms (split-flap mode) |
| `splitFlapCase` | `string` | `'upper'` | `'upper'` (uppercase only) or `'mixed'` (split-flap mode) |
| `wheelOrder` | `string` | `null` | Custom character wheel string (split-flap mode) |
| `stuckTiles` | `object` | `null` | Map of `"row,col": "on"\|"off"` for stuck tile simulation |
| `tokens` | `object` | `null` | Custom token key/value map for text replacement |
| `maxFps` | `number` | `0` | Frame rate cap (0 = uncapped, auto-set to 30 on mobile) |
| `allowedOrigins` | `string[]` | `null` | Allowed origins for JSON chain-loading |
| `maxChainDepth` | `number` | `3` | Maximum depth for JSON chain-loading |
| `forceMultiColor` | `boolean` | `false` | Bypass mono-color restriction on presets (allows multi-color on flip-tile, led-mono, etc.) |

### Simple Usage (single phase in constructor)

```js
const sign = new Marquee('#el', {
  text: 'Hello',
  phase: 'scroll-left',
  speed: 100,
});
sign.play();
```

---

## Instance Methods

### `sign.sequence(steps)`

Define a sequence of animation phases. Returns `this` for chaining.

```js
sign.sequence([
  { text: 'Hello', phase: 'scroll-left', until: 'center' },
  { phase: 'flash', times: 3 },
]);
```

### `sign.play()`

Start or resume playback. Returns `this`.

### `sign.pause()`

Pause at current frame. Returns `this`.

### `sign.stop()`

Stop and reset to beginning. Returns `this`.

### `sign.setText(text, opts?)`

Change text. Stops current animation and sets up a new single-step sequence.

```js
sign.setText('New text', { phase: 'scroll-left', color: '#00ff00' });
```

### `sign.setTheme(opts)`

Update visual options live. Rebuilds the renderer.

```js
sign.setTheme({ preset: 'bulb', background: '#000' });
```

### `sign.loadURL(url, opts?)`

Load a sequence from a JSON file URL. Supports periodic polling so a dynamic app can update the file and the sign picks it up.

```js
sign.loadURL('sign-sequence.json', {
  pollInterval: 600000,  // reload every 10 minutes (ms)
  pollAt: '06:00',       // or reload at a specific time of day
});
```

JSON file format:

```json
{
  "options": { "loop": true, "preset": "led-14" },
  "sequence": [
    { "text": "Hello", "phase": "scroll-left", "until": "center" },
    { "phase": "pause", "duration": 2000 }
  ]
}
```

### `sign.connectWS(url, opts?)`

Connect to a WebSocket server for live control.

```js
sign.connectWS('ws://localhost:8080', { reconnect: true });
```

### `sign.sendWS(data)`

Send data to the connected WebSocket server.

### `sign.on(event, callback)`

Subscribe to events. Returns `this`.

### `sign.off(event, callback)`

Unsubscribe from events. Returns `this`.

### `sign.setColor(color)`

Update the sign color for mono-color presets. For presets with `monoColor: true`, updates the palette to the single new color. Returns `this`.

```js
sign.setColor('#00ccff');
```

### `sign.setStuckTiles(tiles)`

Set stuck tiles for simulated hardware failures. Tiles keyed by `"row,col"` with value `"on"` (always lit) or `"off"` (always dark). Returns `this`.

```js
sign.setStuckTiles({ '3,15': 'on', '5,22': 'off' });
```

### `sign.getFlipCounts()`

Get the flip count for each tile (wear tracking). Returns `Uint32Array` or `null`.

### `sign.setTokens(tokens)`

Set custom token values for text replacement. Returns `this`.

```js
sign.setTokens({ location: 'GATE B12', status: 'ON TIME' });
```

### `sign.destroy()`

Clean up DOM, cancel animations, close WebSocket, stop polling.

---

## Events

| Event | Data | Description |
|-------|------|-------------|
| `phaseStart` | `{ index, step }` | A phase began |
| `phaseEnd` | `{ index, step }` | A phase completed |
| `sequenceEnd` | `{}` | Entire sequence finished |
| `load` | `{ url, data }` | JSON file loaded successfully |
| `load:error` | `{ url, error }` | JSON file load failed |
| `ws:open` | `{}` | WebSocket connected |
| `ws:close` | `{ code, reason }` | WebSocket disconnected |
| `ws:message` | `(parsed JSON)` | Message received from server |
| `ws:error` | `{ error }` | WebSocket error |

---

## Static Methods

### `Marquee.presets`

Array of available preset names.

```js
console.log(Marquee.presets);
// ['flip-tile', 'flip-tile-yellow', 'bulb', 'bulb-theater', 'led-mono', ..., 'split-flap', 'split-flap-clock']
```

### `Marquee.registerPhase(name, factory)`

Register a custom animation phase.

```js
Marquee.registerPhase('wiggle', (config, containerWidth, textWidth, prevState, presetColors) => {
  // Return { start(), update(dt), getState() }
});
```

---

## Phase Step Configuration

Each step in a sequence is an object:

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Text to display (inherited from previous if omitted) |
| `phase` | `string` | Phase type: `scroll-left`, `scroll-right`, `slide-in`, `slide-out`, `flash`, `pause`, `float-up`, `float-down`, `fade-in`, `fade-out`, `wipe-in`, `wipe-out`, `split-flap`, `random` |
| `duration` | `number` | Duration in ms (timed phases) |
| `speed` | `number` | Speed in px/sec (scroll phases) |
| `until` | `'center' \| 'offscreen' \| number` | Scroll stop condition |
| `times` | `number` | Flash repetitions |
| `interval` | `number` | Flash interval in ms |
| `distance` | `number` | Float distance in px/dots |
| `from` | `'left' \| 'right'` | Slide direction (slide-in/slide-out) |
| `color` | `string \| string[] \| Function` | Text color |
| `background` | `string` | Phase-specific background |
| `easing` | `string` | Easing: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `step` |
| `stripeDirection` | `string` | `'horizontal'` to apply array colors per row instead of per character |
| `liveTokens` | `boolean` | Re-resolve tokens every frame (for clocks/live data) |
| `onStart` | `Function` | Callback when phase begins |
| `onEnd` | `Function` | Callback when phase ends |

---

## WebSocket Protocol

The server sends JSON objects with an `action` field:

```json
{ "action": "sequence", "steps": [...], "autoPlay": true }
{ "action": "setText", "text": "Hello", "color": "#ff0000" }
{ "action": "play" }
{ "action": "pause" }
{ "action": "stop" }
{ "action": "setTheme", "preset": "led-14" }
{ "action": "setColor", "color": "#00ff00" }
{ "action": "setStuckTiles", "tiles": { "3,15": "on" } }
{ "action": "getStatus" }
{ "action": "config", "options": { "loop": true, "color": "#ff0000" } }
{ "action": "tokenUpdate", "tokens": { "temp": "72F" } }
```

Clients auto-register on connect with `{ type: "register", role: "viewer" }`. Admin clients include a token: `{ type: "register", role: "admin", token: "..." }`.

The `getStatus` action causes the client to respond with its current state (playing/paused, current step, etc.).

The `config` action applies global configuration changes (any Marquee option).

The `tokenUpdate` action updates custom tokens for live text replacement.

---

## Token System

Tokens in text strings are replaced at render time:

| Token | Description |
|-------|-------------|
| `{time}` | Current time (HH:MM:SS) |
| `{date}` | Current date (YYYY-MM-DD) |
| `{datetime}` | Date and time combined |
| `{year}` | Current year (4 digits) |
| `{date:FORMAT}` | Formatted date (PHP-style: Y, m, d, H, i, s, A, g, F, l) |
| `{data:ATTR}` | Value of `data-ATTR` attribute on the container element |
| `{custom}` | Any key from the `tokens` option or `setTokens()` |

Use `liveTokens: true` on a step to re-resolve tokens every frame.

---

## Presets

### `flip-tile`
Waseca-style mechanical flip dots. Green on black (configurable color). Square dots, no glow. Dots flip with a visible cascade delay.

### `flip-tile-yellow`
Same mechanics, yellow tiles (configurable color). Common on transit signs.

### `bulb`
Bank-style incandescent bulbs. Amber and red. Large round dots with warm glow. Bulbs have visible warm-up and cool-down time. Occasional flicker.

### `bulb-theater`
Theater marquee. Bright white and warm tones. Larger bulbs, more glow.

### `led-mono` / `led-mono-green` / `led-mono-amber`
Early LED signs. Single color only (configurable). Small dots with slight glow and scanline effect.

### `led-14`
90s/2000s multi-color LED signs. Fixed palette of 14 colors. Any requested color is snapped to the nearest available. Slight glow and scanlines.

### `led-rgb`
Modern full-color RGB LED. Any CSS color. Small dots, minimal glow, no scanlines.

### `split-flap`
Airport departure board style. 20 character cells, dark background, white text. Characters cycle through the wheel with staggered timing and CSS 3D flip animations. Default wheel: uppercase letters, digits, and common punctuation.

### `split-flap-clock`
Flip alarm clock variant. 5 cells, larger character size, numeric-only wheel (`0-9`, `:`, `.`, space).
