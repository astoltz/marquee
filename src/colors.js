// Color resolution utilities

import { snapToPresetColor } from './presets.js';

/**
 * Resolve color config to an array of hex strings, one per character.
 *
 * @param {string|string[]|Function} colorConfig
 * @param {string} text
 * @param {number} progress - 0..1 phase progress
 * @param {string[]} presetColors - if set, snap to nearest allowed color
 * @returns {string[]} array of color strings, one per character
 */
export function resolveColors(colorConfig, text, progress, presetColors) {
  let colors;

  if (typeof colorConfig === 'function') {
    colors = [];
    for (let i = 0; i < text.length; i++) {
      colors.push(colorConfig(i, text[i], progress));
    }
  } else if (Array.isArray(colorConfig)) {
    colors = [];
    for (let i = 0; i < text.length; i++) {
      colors.push(colorConfig[i % colorConfig.length]);
    }
  } else {
    colors = new Array(text.length).fill(colorConfig || '#ff3300');
  }

  // Snap to preset palette if constrained
  if (presetColors && presetColors.length > 0) {
    colors = colors.map(c => snapToPresetColor(normalizeColor(c), presetColors));
  }

  return colors;
}

/**
 * Normalize a CSS color to a 6-digit hex string.
 * Handles: #rgb, #rrggbb, named colors (basic set).
 */
export function normalizeColor(color) {
  if (!color) return '#ff3300';

  // Already 6-digit hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();

  // 3-digit hex
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1], g = color[2], b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  // Basic named colors
  const named = {
    red: '#ff0000', green: '#00ff00', blue: '#0000ff',
    yellow: '#ffff00', white: '#ffffff', black: '#000000',
    orange: '#ff8800', purple: '#800080', cyan: '#00ffff',
    magenta: '#ff00ff', amber: '#ffaa00', lime: '#00cc00',
  };
  if (named[color.toLowerCase()]) return named[color.toLowerCase()];

  return color; // pass through (rgb(), hsl(), etc.)
}

/**
 * Dim a hex color by a factor (0 = black, 1 = original).
 */
export function dimColor(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
