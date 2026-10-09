import { MoksyAgreementError } from '../../common/errors.js';
import { AGREEMENT_MESSAGES, RULE_MESSAGES } from '../../common/messages.js';
import { isPlaceholderCell, sanitizeWordText } from '../../common/text-sanitizer.js';
import { FieldType } from '../../common/types.js';
import { BOOLEAN_VALUE_MAP } from './constants.js';
import { FieldConstraints } from './types.js';

export interface RuleParseContext {
  filePath?: string;
  endpoint?: string;
  section?: string;
  row?: number | string;
  field?: string;
}

/**
 * Strips wrapping double or single quotes from a string.
 * @param {string} str - String to unquote.
 * @returns {string} Unquoted string.
 * @example
 * cleanQuotes('"hello"'); // Returns "hello"
 * cleanQuotes("'world'"); // Returns "world"
 */
export function cleanQuotes(str: string): string {
  const trimmed = str.trim();
  const isWrapped =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return isWrapped ? trimmed.slice(1, -1) : trimmed;
}

/**
 * Splits a rule string into semicolon-separated tokens, preserving commas inside brackets/quotes.
 * @param {string} input - Raw rule string.
 * @returns {string[]} List of individual rule tokens.
 * @example
 * splitRuleTokens("min=1; max=50; default=10");
 * // Returns ["min=1", "max=50", "default=10"]
 *
 * splitRuleTokens('enum=["a", "b"]; minItems=1');
 * // Returns ['enum=["a", "b"]', "minItems=1"]
 */
export function splitRuleTokens(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inBracket = false;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      current += char;
      if (char === quoteChar && input[i - 1] !== '\\') {
        inQuotes = false;
      }
    } else if (char === '"' || char === "'") {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === '[') {
      inBracket = true;
      current += char;
    } else if (char === ']') {
      inBracket = false;
      current += char;
    } else if ((char === ';' || (char === ',' && !inBracket)) && !inQuotes) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Parses and validates a numeric constraint (min or max).
 * @param {string} key - Rule keyword name ('min' | 'max').
 * @param {string} rawVal - Value string.
 * @param {FieldType} fieldType - Field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {number} Parsed numeric bound.
 * @throws {MoksyAgreementError} If type is not numeric or value is NaN.
 * @example
 * parseNumericRule("min", "10", "integer", ctx); // Returns 10
 */
export function parseNumericRule(
  key: string,
  rawVal: string,
  fieldType: FieldType,
  context: RuleParseContext
): number {
  const isNumeric = fieldType === 'integer' || fieldType === 'number';
  if (!isNumeric) {
    throw new MoksyAgreementError(
      RULE_MESSAGES.TYPE_MISMATCH(key, 'integer or number', fieldType),
      context
    );
  }
  const val = Number(rawVal);
  if (Number.isNaN(val)) {
    throw new MoksyAgreementError(RULE_MESSAGES.INVALID_NUMBER(key, rawVal), context);
  }
  return val;
}

/**
 * Parses and validates a string length constraint (minLength or maxLength).
 * @param {string} key - Rule keyword name ('minLength' | 'maxLength').
 * @param {string} rawVal - Value string.
 * @param {FieldType} fieldType - Field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {number} Parsed non-negative integer length bound.
 * @throws {MoksyAgreementError} If type is not string or value is invalid.
 * @example
 * parseLengthRule("minLength", "3", "string", ctx); // Returns 3
 */
export function parseLengthRule(
  key: string,
  rawVal: string,
  fieldType: FieldType,
  context: RuleParseContext
): number {
  if (fieldType !== 'string') {
    throw new MoksyAgreementError(RULE_MESSAGES.TYPE_MISMATCH(key, 'string', fieldType), context);
  }
  const val = parseInt(rawVal, 10);
  if (Number.isNaN(val) || val < 0) {
    throw new MoksyAgreementError(RULE_MESSAGES.INVALID_NON_NEGATIVE_INT(key, rawVal), context);
  }
  return val;
}

/**
 * Parses and validates an array count constraint (minItems or maxItems).
 * @param {string} key - Rule keyword name ('minItems' | 'maxItems').
 * @param {string} rawVal - Value string.
 * @param {FieldType} fieldType - Field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {number} Parsed non-negative integer items bound.
 * @throws {MoksyAgreementError} If type is not array or value is invalid.
 * @example
 * parseArrayItemRule("minItems", "1", "array", ctx); // Returns 1
 */
export function parseArrayItemRule(
  key: string,
  rawVal: string,
  fieldType: FieldType,
  context: RuleParseContext
): number {
  if (fieldType !== 'array') {
    throw new MoksyAgreementError(RULE_MESSAGES.TYPE_MISMATCH(key, 'array', fieldType), context);
  }
  const val = parseInt(rawVal, 10);
  if (Number.isNaN(val) || val < 0) {
    throw new MoksyAgreementError(RULE_MESSAGES.INVALID_NON_NEGATIVE_INT(key, rawVal), context);
  }
  return val;
}

/**
 * Parses and validates a regex pattern constraint.
 * @param {string} rawVal - Raw pattern string.
 * @param {FieldType} fieldType - Field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {string} Validated regex pattern string.
 * @throws {MoksyAgreementError} If type is not string or regex syntax is invalid.
 * @example
 * parsePatternRule("^[A-Z]{3}$", "string", ctx); // Returns "^[A-Z]{3}$"
 */
export function parsePatternRule(
  rawVal: string,
  fieldType: FieldType,
  context: RuleParseContext
): string {
  if (fieldType !== 'string') {
    throw new MoksyAgreementError(RULE_MESSAGES.TYPE_MISMATCH('pattern', 'string', fieldType), context);
  }
  const patternStr = cleanQuotes(rawVal);
  try {
    new RegExp(patternStr);
  } catch (err: any) {
    throw new MoksyAgreementError(RULE_MESSAGES.INVALID_REGEX(patternStr, err.message), context);
  }
  return patternStr;
}

/**
 * Value parsers for scalar defaults based on declared field types.
 */
export const DEFAULT_VALUE_PARSERS: Record<
  FieldType,
  (valStr: string, raw: string, context: RuleParseContext) => unknown
> = {
  integer: (valStr, raw, context) => {
    const parsed = parseInt(valStr, 10);
    if (Number.isNaN(parsed)) {
      throw new MoksyAgreementError(RULE_MESSAGES.DEFAULT_INVALID_INT(raw), context);
    }
    return parsed;
  },
  number: (valStr, raw, context) => {
    const parsed = Number(valStr);
    if (Number.isNaN(parsed)) {
      throw new MoksyAgreementError(RULE_MESSAGES.DEFAULT_INVALID_NUM(raw), context);
    }
    return parsed;
  },
  boolean: (valStr, raw, context) => {
    const bool = BOOLEAN_VALUE_MAP[valStr.toLowerCase()];
    if (bool === undefined) {
      throw new MoksyAgreementError(RULE_MESSAGES.DEFAULT_INVALID_BOOL(raw), context);
    }
    return bool;
  },
  string: (valStr) => valStr,
  array: (valStr, raw, context) => {
    try {
      return JSON.parse(valStr);
    } catch {
      throw new MoksyAgreementError(RULE_MESSAGES.DEFAULT_INVALID_JSON('array', raw), context);
    }
  },
  object: (valStr, raw, context) => {
    try {
      return JSON.parse(valStr);
    } catch {
      throw new MoksyAgreementError(RULE_MESSAGES.DEFAULT_INVALID_JSON('object', raw), context);
    }
  }
};

/**
 * Parses a default value string according to the target field type.
 * @param {string} raw - Raw default value expression.
 * @param {FieldType} fieldType - Expected field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {unknown} Parsed default value.
 * @throws {MoksyAgreementError} If the default value cannot be parsed for the type.
 * @example
 * parseDefaultValue("10", "integer", ctx); // Returns 10
 * parseDefaultValue("true", "boolean", ctx); // Returns true
 * parseDefaultValue('"books"', "string", ctx); // Returns "books"
 */
export function parseDefaultValue(
  raw: string,
  fieldType: FieldType,
  context: RuleParseContext
): unknown {
  const unquoted = cleanQuotes(raw);
  const parser = DEFAULT_VALUE_PARSERS[fieldType];
  return parser(unquoted, raw, context);
}

/**
 * Strategy object organizing parsers for individual enum item choices.
 */
export const ENUM_ITEM_PARSERS: Record<
  string,
  (valStr: string, fieldType: FieldType, context: RuleParseContext) => string | number | boolean
> = {
  integer: (valStr, fieldType, context) => {
    const num = Number(valStr);
    if (Number.isNaN(num)) {
      throw new MoksyAgreementError(RULE_MESSAGES.ENUM_INVALID_NUMBER(valStr, fieldType), context);
    }
    return num;
  },
  number: (valStr, fieldType, context) => {
    const num = Number(valStr);
    if (Number.isNaN(num)) {
      throw new MoksyAgreementError(RULE_MESSAGES.ENUM_INVALID_NUMBER(valStr, fieldType), context);
    }
    return num;
  },
  boolean: (valStr, _fieldType, context) => {
    const bool = BOOLEAN_VALUE_MAP[valStr.toLowerCase()];
    if (bool === undefined) {
      throw new MoksyAgreementError(RULE_MESSAGES.ENUM_INVALID_BOOLEAN(valStr), context);
    }
    return bool;
  }
};

/**
 * Parses an enum expression in bracket format ("[val1, val2]").
 * @param {string} raw - Raw enum string.
 * @param {FieldType} fieldType - Expected field type.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @returns {(string | number | boolean)[]} Parsed list of enum choices.
 * @throws {MoksyAgreementError} If brackets are missing or values fail type validation.
 * @example
 * parseEnumValues('["active", "pending"]', "string", ctx);
 * // Returns ["active", "pending"]
 *
 * parseEnumValues("[1, 2, 3]", "integer", ctx);
 * // Returns [1, 2, 3]
 */
export function parseEnumValues(
  raw: string,
  fieldType: FieldType,
  context: RuleParseContext
): (string | number | boolean)[] {
  let cleaned = raw.trim();
  const hasBrackets = cleaned.startsWith('[') && cleaned.endsWith(']');
  if (!hasBrackets) {
    throw new MoksyAgreementError(RULE_MESSAGES.ENUM_BRACKETS_REQUIRED(raw), context);
  }
  cleaned = cleaned.slice(1, -1).trim();
  if (!cleaned) {
    throw new MoksyAgreementError(RULE_MESSAGES.ENUM_EMPTY, context);
  }

  const items = splitRuleTokens(cleaned);
  const parser = ENUM_ITEM_PARSERS[fieldType] || ((valStr) => valStr);

  return items.map((item) => {
    const valStr = cleanQuotes(item);
    return parser(valStr, fieldType, context);
  });
}

/**
 * Strategy object organizing handlers for every individual rule keyword.
 */
export const RULE_KEYWORD_HANDLERS: Record<
  string,
  (rawVal: string, fieldType: FieldType, target: FieldConstraints, context: RuleParseContext) => void
> = {
  min: (rawVal, fieldType, target, context) => {
    target.min = parseNumericRule('min', rawVal, fieldType, context);
  },
  max: (rawVal, fieldType, target, context) => {
    target.max = parseNumericRule('max', rawVal, fieldType, context);
  },
  minlength: (rawVal, fieldType, target, context) => {
    target.minLength = parseLengthRule('minLength', rawVal, fieldType, context);
  },
  minlen: (rawVal, fieldType, target, context) => {
    target.minLength = parseLengthRule('minLength', rawVal, fieldType, context);
  },
  maxlength: (rawVal, fieldType, target, context) => {
    target.maxLength = parseLengthRule('maxLength', rawVal, fieldType, context);
  },
  maxlen: (rawVal, fieldType, target, context) => {
    target.maxLength = parseLengthRule('maxLength', rawVal, fieldType, context);
  },
  minitems: (rawVal, fieldType, target, context) => {
    target.minItems = parseArrayItemRule('minItems', rawVal, fieldType, context);
  },
  maxitems: (rawVal, fieldType, target, context) => {
    target.maxItems = parseArrayItemRule('maxItems', rawVal, fieldType, context);
  },
  enum: (rawVal, fieldType, target, context) => {
    target.enum = parseEnumValues(rawVal, fieldType, context);
  },
  pattern: (rawVal, fieldType, target, context) => {
    target.pattern = parsePatternRule(rawVal, fieldType, context);
  },
  default: (rawVal, fieldType, target, context) => {
    target.default = parseDefaultValue(rawVal, fieldType, context);
  },
  nullable: (rawVal, _fieldType, target) => {
    target.nullable = BOOLEAN_VALUE_MAP[rawVal.toLowerCase()] ?? true;
  }
};

/**
 * Bounds checking rules comparing minimum and maximum settings.
 */
export const BOUNDS_CHECK_RULES: Array<{
  nameA: string;
  nameB: string;
  keyA: keyof FieldConstraints;
  keyB: keyof FieldConstraints;
  formatError: (a: number, b: number) => string;
}> = [
  {
    nameA: 'min',
    nameB: 'max',
    keyA: 'min',
    keyB: 'max',
    formatError: AGREEMENT_MESSAGES.UNSATISFIABLE_MIN_MAX
  },
  {
    nameA: 'minLength',
    nameB: 'maxLength',
    keyA: 'minLength',
    keyB: 'maxLength',
    formatError: AGREEMENT_MESSAGES.UNSATISFIABLE_LENGTH
  },
  {
    nameA: 'minItems',
    nameB: 'maxItems',
    keyA: 'minItems',
    keyB: 'maxItems',
    formatError: AGREEMENT_MESSAGES.UNSATISFIABLE_ITEMS
  }
];

/**
 * Validates that defined bounds are mathematically satisfiable.
 * @param {FieldConstraints} constraints - Parsed constraints object.
 * @param {RuleParseContext} context - Diagnostic error context.
 * @throws {MoksyAgreementError} If min > max, minLength > maxLength, or minItems > maxItems.
 * @example
 * validateBoundsSatisfiability({ min: 10, max: 5 }, ctx);
 * // Throws MoksyAgreementError: Unsatisfiable bounds: min (10) cannot be greater than max (5)
 */
export function validateBoundsSatisfiability(
  constraints: FieldConstraints,
  context: RuleParseContext
): void {
  for (const { keyA, keyB, formatError } of BOUNDS_CHECK_RULES) {
    const valA = constraints[keyA] as number | undefined;
    const valB = constraints[keyB] as number | undefined;
    if (valA !== undefined && valB !== undefined && valA > valB) {
      throw new MoksyAgreementError(formatError(valA, valB), context);
    }
  }
}

/**
 * Applies a single token rule (e.g. "min=10") to the target FieldConstraints.
 * @param {string} token - Rule token.
 * @param {FieldType} fieldType - Expected field type.
 * @param {FieldConstraints} target - Constraints object to populate.
 * @param {RuleParseContext} context - Diagnostic error context.
 */
export function applySingleRule(
  token: string,
  fieldType: FieldType,
  target: FieldConstraints,
  context: RuleParseContext
): void {
  const trimmed = token.trim();
  if (!trimmed || trimmed === '-') return;

  if (trimmed.toLowerCase() === 'nullable') {
    target.nullable = true;
    return;
  }

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) {
    throw new MoksyAgreementError(RULE_MESSAGES.INVALID_SYNTAX(trimmed), context);
  }

  const key = trimmed.slice(0, eqIdx).trim().toLowerCase();
  const rawVal = trimmed.slice(eqIdx + 1).trim();

  const handler = RULE_KEYWORD_HANDLERS[key];
  if (!handler) {
    throw new MoksyAgreementError(
      RULE_MESSAGES.UNKNOWN_KEY(key, Object.keys(RULE_KEYWORD_HANDLERS).join(', ')),
      context
    );
  }

  handler(rawVal, fieldType, target, context);
}

/**
 * Parses a semicolon/comma-separated rule string into a structured FieldConstraints object.
 * @param {string} rawRules - Raw rule expression cell content.
 * @param {FieldType} fieldType - Expected field type.
 * @param {RuleParseContext} [context] - Optional diagnostic error context.
 * @returns {FieldConstraints} Parsed constraint settings.
 * @throws {MoksyAgreementError} When rule syntax, types, or bounds are invalid.
 * @example
 * // Input:
 * parseRules("min=1; max=50; default=10", "integer");
 * // Expected Output:
 * // { min: 1, max: 50, default: 10 }
 *
 * @example
 * // Input:
 * parseRules('enum=["books", "electronics"]; maxLength=50', "string");
 * // Expected Output:
 * // { enum: ["books", "electronics"], maxLength: 50 }
 */
export function parseRules(
  rawRules: string,
  fieldType: FieldType,
  context: RuleParseContext = {}
): FieldConstraints {
  const constraints: FieldConstraints = {};
  if (isPlaceholderCell(rawRules)) {
    return constraints;
  }

  const sanitized = sanitizeWordText(rawRules);
  const tokens = splitRuleTokens(sanitized);

  for (const token of tokens) {
    applySingleRule(token, fieldType, constraints, context);
  }

  validateBoundsSatisfiability(constraints, context);
  return constraints;
}
