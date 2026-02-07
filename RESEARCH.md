# Animation Research — Additional Patterns from Real Signs

This document catalogs animation patterns observed in real-world programmable signs
that could be implemented as registered phases via `Marquee.registerPhase()`.

Each pattern is described with its visual effect and typical usage context.

## Border Chase

LEDs chase sequentially around the sign border. Common on movie theater marquees
and casino signs. Usually runs as a background animation behind text.

- **Implementation**: Track border dot indices in a ring buffer. Advance a "head" position
  each frame, trailing N lit dots behind it.
- **Options**: `speed`, `trailLength`, `direction` (cw/ccw), `color`

## Sparkle / Twinkle

Random dots flash briefly at random positions. Creates a glittering effect.
Common on Christmas-themed signs and nightclub displays.

- **Implementation**: Each frame, randomly select N dots to flash on for 2-3 frames.
  Maintain a set of active sparkle positions with remaining frame counts.
- **Options**: `density`, `color`, `sparkleFrames`

## Rain / Snow

Dots cascade downward from random top positions. Rain moves faster with streaks;
snow moves slower with single dots.

- **Implementation**: Spawn particles at random columns in the top row. Each frame,
  move particles down one row. Remove when reaching bottom.
- **Options**: `density`, `speed`, `particleLength` (1 for snow, 3-5 for rain)

## Checkerboard Reveal

Text is revealed through an alternating checkerboard mask that progressively fills.
Common on LED signs from the 2000s era.

- **Implementation**: Generate a checkerboard mask. In phase 1, reveal odd cells.
  In phase 2, reveal even cells.
- **Options**: `duration`, `cellSize`

## Spiral In / Out

Dots illuminate in a spiral pattern from the outside edge inward (or reverse).
Used for dramatic reveals on large LED displays.

- **Implementation**: Pre-compute a spiral traversal order of all dot positions.
  Progressively light dots along the spiral path.
- **Options**: `duration`, `direction` (in/out), `startCorner`

## Split Open / Close

Text splits horizontally at the center — top half slides up, bottom half slides down,
revealing new text beneath. Common on flip-dot signs.

- **Implementation**: Use two render passes. Mask the top/bottom halves with offsetY
  animations in opposite directions.
- **Options**: `duration`, `easing`, `gap`

## Stack

Lines of text drop in from the top one at a time, stacking up from the bottom.
Common on multi-line LED message centers.

- **Implementation**: For multi-line text, animate each line from above the sign
  to its final Y position with a stagger delay between lines.
- **Options**: `lineDelay`, `dropDuration`, `easing`

## Typewriter

Characters appear one by one from left to right, simulating typing.
Sometimes includes a blinking cursor.

- **Implementation**: Progressively increase the number of visible characters
  over time. Optionally render a block cursor at the current position.
- **Options**: `charDelay`, `showCursor`, `cursorBlinkRate`

## Lottery Ticker / Slot Machine

Numbers rapidly randomize then settle one by one from left to right.
Common on gas station price signs and lottery displays.

- **Implementation**: For each character position, cycle through random characters
  for a duration, then lock to the final character. Stagger lock times left-to-right.
- **Options**: `scrambleDuration`, `settleDuration`, `stagger`
- **Note**: Similar to split-flap but with random cycling rather than sequential wheel.

## Price Flash

Price numbers alternate between two values rapidly (or between price and blank)
to create an attention-grabbing flashing effect. Ubiquitous on gas station and
retail LED signs.

- **Implementation**: Alternate between two text states at a configurable rate.
  Unlike regular flash, only specific character positions (the price) alternate.
- **Options**: `interval`, `altText`, `flashPositions`

## Arrow Animation

An arrow shape (►, ◄, ▲, ▼) moves across the sign, leading the eye toward text.
Used on directional signs in parking structures and retail.

- **Implementation**: Render arrow dots at a position that advances each frame.
  The arrow can be a predefined 5x7 glyph or a wider custom shape.
- **Options**: `direction`, `speed`, `arrowStyle`

---

## Implementation Notes

All patterns above can be implemented using the existing phase extension system:

```js
Marquee.registerPhase('border-chase', (step, containerWidth, textWidth, prevState, presetColors) => {
  // Return { start(), update(dt), getState() }
});
```

The state object supports `text`, `offsetX`, `offsetY`, `opacity`, `visible`,
`colors`, `progress`, and `wipeProgress`. For patterns that need per-dot control
in LED mode, the renderer's dot buffer can be manipulated through the state.

Priority for implementation (by user demand and visual impact):
1. Typewriter
2. Border chase
3. Sparkle/twinkle
4. Rain/snow
5. Slot machine
