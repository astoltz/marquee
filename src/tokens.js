// Token resolution for dynamic text content
//
// Replaces {token} placeholders in text with live values.

const DATE_FORMATS = {
  Y: (d) => String(d.getFullYear()),
  m: (d) => String(d.getMonth() + 1).padStart(2, '0'),
  d: (d) => String(d.getDate()).padStart(2, '0'),
  H: (d) => String(d.getHours()).padStart(2, '0'),
  i: (d) => String(d.getMinutes()).padStart(2, '0'),
  s: (d) => String(d.getSeconds()).padStart(2, '0'),
  A: (d) => d.getHours() >= 12 ? 'PM' : 'AM',
  g: (d) => String(d.getHours() % 12 || 12),
  F: (d) => d.toLocaleString('en-US', { month: 'long' }),
  l: (d) => d.toLocaleString('en-US', { weekday: 'long' }),
};

function formatDate(format) {
  const now = new Date();
  let result = '';
  for (const ch of format) {
    result += DATE_FORMATS[ch] ? DATE_FORMATS[ch](now) : ch;
  }
  return result;
}

/**
 * Resolve token placeholders in text.
 *
 * Built-in tokens:
 *   {time}          - HH:MM AM/PM
 *   {date}          - MM/DD/YYYY
 *   {datetime}      - MM/DD/YYYY HH:MM AM/PM
 *   {year}          - 4-digit year
 *   {date:FORMAT}   - custom format using Y, m, d, H, i, s, A, g, F, l
 *   {data:ATTR}     - reads data-ATTR from container element
 *   {TOKEN_NAME}    - custom token from context.tokens map
 *
 * @param {string} text
 * @param {object} context - { container, tokens }
 * @returns {string}
 */
export function resolveTokens(text, context) {
  if (!text || text.indexOf('{') === -1) return text;

  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    // Built-in time tokens
    if (key === 'time') {
      return formatDate('g') + ':' + formatDate('i') + ' ' + formatDate('A');
    }
    if (key === 'date') {
      return formatDate('m') + '/' + formatDate('d') + '/' + formatDate('Y');
    }
    if (key === 'datetime') {
      return formatDate('m') + '/' + formatDate('d') + '/' + formatDate('Y') + ' ' +
             formatDate('g') + ':' + formatDate('i') + ' ' + formatDate('A');
    }
    if (key === 'year') {
      return formatDate('Y');
    }

    // Custom date format: {date:FORMAT}
    if (key.startsWith('date:')) {
      return formatDate(key.slice(5));
    }

    // Data attribute: {data:ATTR}
    if (key.startsWith('data:') && context && context.container) {
      const attr = key.slice(5);
      return context.container.dataset[attr] || '';
    }

    // Custom tokens from context
    if (context && context.tokens && context.tokens[key] !== undefined) {
      return String(context.tokens[key]);
    }

    // Unknown token — leave as-is
    return match;
  });
}
