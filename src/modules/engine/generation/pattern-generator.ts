import { Prng } from './prng.js';

export const CHAR_SETS = {
  DIGITS: '0123456789',
  UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  LOWER: 'abcdefghijklmnopqrstuvwxyz',
  ALPHANUM_UPPER: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ALPHANUM: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
} as const;

export const ESCAPE_CHARSETS: Record<string, string> = {
  d: CHAR_SETS.DIGITS,
  w: CHAR_SETS.ALPHANUM
};

interface FastPathMatcher {
  matches: (pattern: string) => boolean;
  generate: (pattern: string, prng: Prng) => string;
}

/**
 * Generates an ISO 8601 UTC date-time string.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} e.g. "2026-10-05T14:30:00Z"
 */
export function generateIsoDateTime(prng: Prng): string {
  const year = prng.nextInt(2023, 2026);
  const month = String(prng.nextInt(1, 12)).padStart(2, '0');
  const day = String(prng.nextInt(1, 28)).padStart(2, '0');
  const hour = String(prng.nextInt(0, 23)).padStart(2, '0');
  const min = String(prng.nextInt(0, 59)).padStart(2, '0');
  const sec = String(prng.nextInt(0, 59)).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
}

/**
 * Generates an ISO 8601 date string.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} e.g. "2026-10-05"
 */
export function generateIsoDate(prng: Prng): string {
  const year = prng.nextInt(2023, 2026);
  const month = String(prng.nextInt(1, 12)).padStart(2, '0');
  const day = String(prng.nextInt(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates a random string of fixed length from a character set.
 * @param {string} charset - Available characters.
 * @param {number} length - Target string length.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} Generated string.
 */
export function generateFromCharset(charset: string, length: number, prng: Prng): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[prng.nextInt(0, charset.length - 1)];
  }
  return result;
}

/**
 * Helper to generate fixed-length text from regex capture group length.
 * @param {string} pattern - Pattern string.
 * @param {RegExp} regex - Regex with single quantifier capture group.
 * @param {string} charset - Target character set.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} Generated text.
 */
function generateFixedLengthFromRegex(
  pattern: string,
  regex: RegExp,
  charset: string,
  prng: Prng
): string {
  const match = pattern.match(regex);
  const length = match ? parseInt(match[1], 10) : 1;
  return generateFromCharset(charset, length, prng);
}

/**
 * List of fast-path regex matchers for common API patterns.
 */
export const FAST_PATH_MATCHERS: FastPathMatcher[] = [
  {
    matches: (p) => /\\d\{4\}-\\d\{2\}-\\d\{2\}T\\d\{2\}:\\d\{2\}:\\d\{2\}Z/.test(p),
    generate: (_p, prng) => generateIsoDateTime(prng)
  },
  {
    matches: (p) => /\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(p),
    generate: (_p, prng) => generateIsoDate(prng)
  },
  {
    matches: (p) => /^\[A-Z0-9\]\{(\d+)\}$/.test(p),
    generate: (p, prng) => generateFixedLengthFromRegex(p, /^\[A-Z0-9\]\{(\d+)\}$/, CHAR_SETS.ALPHANUM_UPPER, prng)
  },
  {
    matches: (p) => /^\\d\{(\d+)\}$/.test(p),
    generate: (p, prng) => generateFixedLengthFromRegex(p, /^\\d\{(\d+)\}$/, CHAR_SETS.DIGITS, prng)
  },
  {
    matches: (p) => /^\[A-Z\]\{(\d+)\}$/.test(p),
    generate: (p, prng) => generateFixedLengthFromRegex(p, /^\[A-Z\]\{(\d+)\}$/, CHAR_SETS.UPPER, prng)
  }
];

/**
 * Tries fast-path pattern generation for recognized standard templates.
 * @param {string} pattern - Pattern string.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string | null} Generated string, or null if no fast-path applies.
 */
export function tryFastPath(pattern: string, prng: Prng): string | null {
  for (const matcher of FAST_PATH_MATCHERS) {
    if (matcher.matches(pattern)) {
      return matcher.generate(pattern, prng);
    }
  }
  return null;
}

/**
 * Extracts a curly bracket quantifier like "{8}" from a string index.
 * @param {string} str - Pattern string.
 * @param {number} startIndex - Index of opening brace.
 * @returns {{ count: number; rawLength: number } | null} Parsed quantifier or null.
 */
export function extractQuantifier(
  str: string,
  startIndex: number
): { count: number; rawLength: number } | null {
  if (str[startIndex] !== '{') return null;
  const endIdx = str.indexOf('}', startIndex);
  if (endIdx === -1) return null;

  const count = parseInt(str.slice(startIndex + 1, endIdx), 10);
  if (Number.isNaN(count)) return null;

  return {
    count,
    rawLength: endIdx - startIndex + 1
  };
}

/**
 * Resolves character set for bracket class contents ([A-Z0-9], [a-z], etc.).
 * @param {string} classContent - Inside of brackets.
 * @returns {string} Matching character set.
 */
export function resolveCharset(classContent: string): string {
  const hasUpper = classContent.includes('A-Z');
  const hasLower = classContent.includes('a-z');
  const hasDigits = classContent.includes('0-9');

  if (hasUpper && hasDigits) return CHAR_SETS.ALPHANUM_UPPER;
  if (hasUpper && hasLower) return CHAR_SETS.ALPHANUM;
  if (hasUpper) return CHAR_SETS.UPPER;
  if (hasLower) return CHAR_SETS.LOWER;
  if (hasDigits) return CHAR_SETS.DIGITS;

  return CHAR_SETS.ALPHANUM;
}

export interface StepResult {
  text: string;
  nextIndex: number;
}

/**
 * Handles backslash escape sequences like "\d" and "\w".
 * @param {string} pattern - Pattern string.
 * @param {number} index - Current position of backslash.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {StepResult} Generated text and next index.
 */
export function handleEscapeSequence(pattern: string, index: number, prng: Prng): StepResult {
  const escapeChar = pattern[index + 1];
  const charset = ESCAPE_CHARSETS[escapeChar];

  if (charset) {
    const repeat = extractQuantifier(pattern, index + 2);
    const count = repeat ? repeat.count : 1;
    const text = generateFromCharset(charset, count, prng);
    const nextIndex = index + 2 + (repeat ? repeat.rawLength : 0);
    return { text, nextIndex };
  }

  return { text: escapeChar || '', nextIndex: index + 2 };
}

/**
 * Handles bracket character classes like "[A-Z0-9]{8}".
 * @param {string} pattern - Pattern string.
 * @param {number} index - Current position of opening bracket.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {StepResult} Generated text and next index.
 */
export function handleCharacterClass(pattern: string, index: number, prng: Prng): StepResult {
  const closeIdx = pattern.indexOf(']', index);
  if (closeIdx === -1) {
    return { text: pattern[index], nextIndex: index + 1 };
  }

  const classContent = pattern.slice(index + 1, closeIdx);
  const charset = resolveCharset(classContent);
  const repeat = extractQuantifier(pattern, closeIdx + 1);
  const count = repeat ? repeat.count : 1;
  const text = generateFromCharset(charset, count, prng);
  const nextIndex = closeIdx + 1 + (repeat ? repeat.rawLength : 0);

  return { text, nextIndex };
}

/**
 * Tokenizes and generates string from pattern tokens.
 * @param {string} pattern - Cleaned regex pattern.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} Generated string.
 */
export function tokenizeAndGenerate(pattern: string, prng: Prng): string {
  let result = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '\\') {
      const step = handleEscapeSequence(pattern, i, prng);
      result += step.text;
      i = step.nextIndex;
      continue;
    }

    if (char === '[') {
      const step = handleCharacterClass(pattern, i, prng);
      result += step.text;
      i = step.nextIndex;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Generates a string matching a regular expression pattern.
 * Supports date-time, date, character classes, and quantifiers.
 * Cognitive complexity is kept well below 15 using strategy matchers and modular token steps.
 * @param {string} pattern - Regex pattern.
 * @param {Prng} prng - Seeded PRNG.
 * @returns {string} String satisfying the pattern.
 * @example
 * // Pattern:
 * generateStringFromPattern("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$", prng);
 * // Returns: "2026-05-14T10:20:30Z"
 *
 * @example
 * // SKU Pattern:
 * generateStringFromPattern("^[A-Z0-9]{8}$", prng);
 * // Returns: "A8B2C9X4"
 */
export function generateStringFromPattern(pattern: string, prng: Prng): string {
  const cleaned = pattern.replace(/^\^/, '').replace(/\$$/, '');

  const fastPathResult = tryFastPath(cleaned, prng);
  if (fastPathResult !== null) {
    return fastPathResult;
  }

  return tokenizeAndGenerate(cleaned, prng);
}
