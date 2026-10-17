import { GENERATOR_MESSAGES } from '../../../common/messages.js';
import { FieldType } from '../../../common/types.js';
import { generateStringFromPattern } from './pattern-generator.js';
import { Prng } from './prng.js';

export interface GeneratorContext {
  maxDepth?: number;
}

const SAMPLE_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
  'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
  'et', 'dolore', 'magna', 'aliqua', 'product', 'item', 'book', 'laptop'
];

/**
 * Generates an integer value adhering to minimum and maximum schema constraints.
 * @param {any} schema - Property schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @returns {number} Bounded integer.
 */
export function generateInteger(schema: any, prng: Prng): number {
  if (schema.enum && schema.enum.length > 0) {
    return prng.pickOne(schema.enum);
  }
  const min = schema.minimum !== undefined ? schema.minimum : 1;
  const max = schema.maximum !== undefined ? schema.maximum : Math.max(min, 1000);
  return prng.nextInt(min, max);
}

/**
 * Generates a floating-point number adhering to minimum and maximum schema constraints.
 * @param {any} schema - Property schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @returns {number} Bounded float rounded to 2 decimal places.
 */
export function generateNumber(schema: any, prng: Prng): number {
  if (schema.enum && schema.enum.length > 0) {
    return prng.pickOne(schema.enum);
  }
  const min = schema.minimum !== undefined ? schema.minimum : 0.01;
  const max = schema.maximum !== undefined ? schema.maximum : Math.max(min, 1000);
  return prng.nextFloat(min, max, 2);
}

/**
 * Generates a boolean value.
 * @param {any} schema - Property schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @returns {boolean} Random boolean.
 */
export function generateBoolean(schema: any, prng: Prng): boolean {
  if (schema.enum && schema.enum.length > 0) {
    return prng.pickOne(schema.enum);
  }
  return prng.nextBoolean();
}

/**
 * Generates a string matching length bounds, enum choices, or regex pattern.
 * @param {any} schema - Property schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @returns {string} Conforming string.
 */
export function generateString(schema: any, prng: Prng): string {
  if (schema.enum && schema.enum.length > 0) {
    return prng.pickOne(schema.enum);
  }

  if (schema.pattern) {
    return generateStringFromPattern(schema.pattern, prng);
  }

  const minLen = schema.minLength !== undefined ? schema.minLength : 1;
  const maxLen = schema.maxLength !== undefined ? schema.maxLength : Math.max(minLen, 30);
  const targetLen = prng.nextInt(minLen, Math.min(maxLen, 50));

  let result = '';
  while (result.length < targetLen) {
    const word = prng.pickOne(SAMPLE_WORDS);
    result = result ? `${result} ${word}` : word;
  }

  if (result.length > targetLen) {
    result = result.slice(0, targetLen).trimEnd();
  }
  if (result.length < minLen) {
    result = result.padEnd(minLen, 'x');
  }

  return result;
}

/**
 * Generates an array of items bounded by minItems and maxItems.
 * @param {any} schema - Array schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @param {number} depth - Current recursion depth.
 * @param {GeneratorContext} context - Generation context.
 * @returns {any[]} Generated array of conforming items.
 */
export function generateArray(
  schema: any,
  prng: Prng,
  depth: number,
  context: GeneratorContext
): any[] {
  const minItems = schema.minItems !== undefined ? schema.minItems : 0;
  const declaredMax = schema.maxItems !== undefined ? schema.maxItems : Math.max(minItems, 3);
  const cappedMax = Math.min(declaredMax, 10); // Anti-memory explosion cap
  const count = prng.nextInt(minItems, cappedMax);

  const items: any[] = [];
  const itemSchema = schema.items || { type: 'string' };

  for (let i = 0; i < count; i++) {
    items.push(generateValue(itemSchema, prng, depth + 1, context));
  }

  return items;
}

/**
 * Generates an object with properties conforming to schema and required rules.
 * @param {any} schema - Object schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @param {number} depth - Current recursion depth.
 * @param {GeneratorContext} context - Generation context.
 * @returns {Record<string, any>} Generated object payload.
 */
export function generateObject(
  schema: any,
  prng: Prng,
  depth: number,
  context: GeneratorContext
): Record<string, any> {
  const maxDepth = context.maxDepth ?? 5;
  if (depth >= maxDepth) {
    return {};
  }

  const obj: Record<string, any> = {};
  const properties = schema.properties || {};
  const requiredSet = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

  for (const [key, propSchema] of Object.entries<any>(properties)) {
    const isRequired = requiredSet.has(key);
    // Required properties are always generated; optional properties have 80% inclusion rate
    const shouldInclude = isRequired || prng.next() < 0.8;

    if (shouldInclude) {
      obj[key] = generateValue(propSchema, prng, depth + 1, context);
    }
  }

  return obj;
}

/**
 * Strategy object organizing value generators for every JSON Schema type.
 */
export const SCHEMA_TYPE_GENERATORS: Record<
  FieldType,
  (schema: any, prng: Prng, depth: number, context: GeneratorContext) => unknown
> = {
  integer: generateInteger,
  number: generateNumber,
  boolean: generateBoolean,
  string: generateString,
  array: generateArray,
  object: generateObject
};

/**
 * Recursively generates dummy data conforming to any supported JSON Schema definition.
 * Supports nullable types, enums, nested objects, and bounded arrays.
 * @param {any} schema - Target JSON Schema node.
 * @param {Prng} prng - Seeded PRNG instance.
 * @param {number} [depth=0] - Recursion depth.
 * @param {GeneratorContext} [context={}] - Generator context.
 * @returns {unknown} Conforming dummy payload.
 * @throws {Error} If schema type is unsupported.
 */
export function generateValue(
  schema: any,
  prng: Prng,
  depth: number = 0,
  context: GeneratorContext = {}
): unknown {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  // Nullable check: 10% chance of returning null if nullable is allowed
  const isNullable =
    schema.nullable === true ||
    (Array.isArray(schema.type) && schema.type.includes('null'));

  if (isNullable && prng.next() < 0.1) {
    return null;
  }

  let type: FieldType = 'string';
  if (Array.isArray(schema.type)) {
    const nonNullType = schema.type.find((t: string) => t !== 'null');
    type = (nonNullType || 'string') as FieldType;
  } else if (typeof schema.type === 'string') {
    type = schema.type as FieldType;
  }

  const generator = SCHEMA_TYPE_GENERATORS[type];
  if (!generator) {
    throw new Error(GENERATOR_MESSAGES.UNSUPPORTED_TYPE(type));
  }

  return generator(schema, prng, depth, context);
}
