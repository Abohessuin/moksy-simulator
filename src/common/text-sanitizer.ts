/**
 * Sanitizes Word typography artifacts such as smart quotes, non-breaking spaces,
 * and decorative dashes into standard ASCII equivalents.
 */
export function sanitizeWordText(text: string): string {
  if (!text) return '';

  return text
    // Normalize smart/curly double quotes to standard ASCII double quote
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    // Normalize smart/curly single quotes to standard ASCII single quote
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    // Normalize unicode dashes (em-dash, en-dash, horizontal bar, minus) to ASCII hyphen-minus
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    // Replace non-breaking spaces with standard space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Remove zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Normalize whitespace
    .trim();
}

/**
 * Checks whether a cell value represents an empty / non-applicable indicator ("-", "—", or empty).
 */
export function isPlaceholderCell(val: string): boolean {
  const sanitized = sanitizeWordText(val);
  return sanitized === '' || sanitized === '-' || sanitized === '--' || sanitized === 'none' || sanitized.toLowerCase() === 'n/a';
}
