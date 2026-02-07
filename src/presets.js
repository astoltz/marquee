// Sign hardware presets — simulating real-world marquee sign limitations
//
// These presets constrain colors, dot appearance, and animation feel
// to match specific eras and types of physical signs.

export const PRESETS = {

  // === FLIP-TILE SIGNS ===
  // Waseca-style: mechanical flip dots, green/black only
  // These signs had physical tiles that flipped between two colors.
  // Animation was clunky — tiles flipped in visible waves.
  'flip-tile': {
    colors: ['#33cc33'],           // one foreground color only
    monoColor: true,               // accepts user color override
    defaultColor: '#33cc33',       // fallback when no user color
    background: '#111111',
    dotShape: 'square',
    dotSize: 6,
    dotGap: 2,
    dotRadius: 1,                  // slightly rounded corners
    offColor: '#1a1a1a',           // dark tile backing
    glowAmount: 0,                 // no glow — mechanical
    flipAnimation: true,           // dots flip with a slight delay cascade
    flipSpeed: 30,                 // ms delay between adjacent dot flips
    transitionStyle: 'flip',       // dots flip rather than fade
    fontWeight: 'normal',
    scanlineEffect: false,
  },

  // Yellow/black variant — some transit signs
  'flip-tile-yellow': {
    colors: ['#cccc00'],
    monoColor: true,
    defaultColor: '#cccc00',
    background: '#111111',
    dotShape: 'square',
    dotSize: 6,
    dotGap: 2,
    dotRadius: 1,
    offColor: '#1a1a1a',
    glowAmount: 0,
    flipAnimation: true,
    flipSpeed: 30,
    transitionStyle: 'flip',
    fontWeight: 'normal',
    scanlineEffect: false,
  },

  // === INCANDESCENT BULB SIGNS ===
  // Bank/theater signs with actual light bulbs.
  // Usually 1-3 colors (amber, red, sometimes green).
  // Warm glow, slight bloom, bulbs take time to heat up/cool down.
  'bulb': {
    colors: ['#ffaa00', '#ff3300'],   // amber and red
    background: '#0a0a0a',
    dotShape: 'circle',
    dotSize: 8,
    dotGap: 3,
    dotRadius: '50%',
    offColor: '#1a1200',              // warm dark (bulb still slightly visible)
    glowAmount: 6,                    // warm bloom
    glowColor: null,                  // auto from dot color
    transitionStyle: 'warm',          // slow on/off like incandescent
    warmUpTime: 80,                   // ms for bulb to reach full brightness
    coolDownTime: 120,                // ms to fade off
    flickerChance: 0.002,             // occasional random flicker
    fontWeight: 'bold',
    scanlineEffect: false,
  },

  // Theater marquee — white and warm bulbs
  'bulb-theater': {
    colors: ['#ffffcc', '#ffcc66'],
    background: '#0a0a0a',
    dotShape: 'circle',
    dotSize: 10,
    dotGap: 4,
    dotRadius: '50%',
    offColor: '#1a1600',
    glowAmount: 8,
    transitionStyle: 'warm',
    warmUpTime: 60,
    coolDownTime: 100,
    flickerChance: 0.003,
    fontWeight: 'bold',
    scanlineEffect: false,
  },

  // === EARLY LED SIGNS ===
  // Monochrome LED — red or green, single color only.
  // Sharp dots, slight glow, very crisp.
  'led-mono': {
    colors: ['#ff2200'],
    monoColor: true,
    defaultColor: '#ff2200',
    background: '#0c0000',
    dotShape: 'circle',
    dotSize: 4,
    dotGap: 1,
    dotRadius: '50%',
    offColor: '#1a0500',
    glowAmount: 3,
    transitionStyle: 'instant',
    fontWeight: 'normal',
    scanlineEffect: true,
    scanlineOpacity: 0.08,
  },

  'led-mono-green': {
    colors: ['#00cc00'],
    monoColor: true,
    defaultColor: '#00cc00',
    background: '#000c00',
    dotShape: 'circle',
    dotSize: 4,
    dotGap: 1,
    dotRadius: '50%',
    offColor: '#001a05',
    glowAmount: 3,
    transitionStyle: 'instant',
    fontWeight: 'normal',
    scanlineEffect: true,
    scanlineOpacity: 0.08,
  },

  'led-mono-amber': {
    colors: ['#ffaa00'],
    monoColor: true,
    defaultColor: '#ffaa00',
    background: '#0c0800',
    dotShape: 'circle',
    dotSize: 4,
    dotGap: 1,
    dotRadius: '50%',
    offColor: '#1a1000',
    glowAmount: 3,
    transitionStyle: 'instant',
    fontWeight: 'normal',
    scanlineEffect: true,
    scanlineOpacity: 0.08,
  },

  // === MULTI-COLOR LED (limited palette) ===
  // ~14 color LED signs — like 90s/2000s bank signs.
  // Had a fixed palette, not full RGB. Could do colored text but
  // the colors were specific and limited.
  'led-14': {
    colors: [
      '#ff0000',  // red
      '#ff3300',  // red-orange
      '#ff6600',  // orange
      '#ffaa00',  // amber
      '#ffcc00',  // yellow-orange
      '#ffff00',  // yellow
      '#99ff00',  // yellow-green
      '#00cc00',  // green
      '#00cc99',  // teal
      '#0066ff',  // blue
      '#3300ff',  // indigo
      '#9900cc',  // purple
      '#ff0066',  // magenta
      '#ffffff',  // white
    ],
    background: '#080808',
    dotShape: 'circle',
    dotSize: 4,
    dotGap: 1,
    dotRadius: '50%',
    offColor: '#111111',
    glowAmount: 2,
    transitionStyle: 'instant',
    fontWeight: 'normal',
    scanlineEffect: true,
    scanlineOpacity: 0.05,
  },

  // === FULL RGB LED ===
  // Modern full-color LED panels. Any color, bright, no glow limit.
  'led-rgb': {
    colors: null,                      // unrestricted — any CSS color
    background: '#050505',
    dotShape: 'circle',
    dotSize: 3,
    dotGap: 1,
    dotRadius: '50%',
    offColor: '#0a0a0a',
    glowAmount: 2,
    transitionStyle: 'instant',
    fontWeight: 'normal',
    scanlineEffect: false,
  },
  // === SPLIT-FLAP DISPLAYS ===
  // Airport departure board / flip clock style

  'split-flap': {
    splitFlap: true,
    cellCount: 20,
    charWidth: 40,
    charHeight: 60,
    cellGap: 3,
    flipDuration: 80,
    splitFlapStagger: 50,
    splitFlapCase: 'upper',
    background: '#1a1a1a',
    color: '#e8e8d0',
    colors: null,
    dotShape: 'square',
    dotSize: 4,
    dotGap: 1,
    offColor: '#111',
    glowAmount: 0,
    transitionStyle: 'instant',
    fontWeight: 'bold',
    scanlineEffect: false,
  },

  'split-flap-clock': {
    splitFlap: true,
    cellCount: 5,
    charWidth: 60,
    charHeight: 90,
    cellGap: 4,
    flipDuration: 100,
    splitFlapStagger: 60,
    splitFlapCase: 'upper',
    wheelOrder: ' 0123456789:.',
    background: '#111111',
    color: '#e8e8d0',
    colors: null,
    dotShape: 'square',
    dotSize: 4,
    dotGap: 1,
    offColor: '#111',
    glowAmount: 0,
    transitionStyle: 'instant',
    fontWeight: 'bold',
    scanlineEffect: false,
  },
};

/**
 * Snap a color to the nearest allowed color in a preset's palette.
 * Returns the closest color by simple RGB distance.
 */
export function snapToPresetColor(hexColor, presetColors) {
  if (!presetColors || presetColors.length === 0) return hexColor;

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  let best = presetColors[0];
  let bestDist = Infinity;

  for (const pc of presetColors) {
    const pr = parseInt(pc.slice(1, 3), 16);
    const pg = parseInt(pc.slice(3, 5), 16);
    const pb = parseInt(pc.slice(5, 7), 16);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = pc;
    }
  }
  return best;
}

/**
 * Get the default foreground color for a preset (first in palette).
 */
export function getPresetDefaultColor(preset) {
  const p = PRESETS[preset];
  if (!p || !p.colors) return null;
  return p.colors[0];
}
