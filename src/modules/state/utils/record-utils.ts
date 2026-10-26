import mergeWith from 'lodash/mergeWith.js';
import { MoksyAgreementError } from '../../../common/errors.js';
import { generateValue } from '../../engine/generation/value-generators.js';
import type { Prng } from '../../engine/generation/prng.js';
import { STATE_MESSAGES } from '../messages.js';
import type { CollectionDefinition } from '../types/index.js';
import { schemaHasType } from './schema-utils.js';

/**
 * Deep-clones a structured-cloneable value.
 *
 * @template T
 * @param {T} value - The value to deep clone.
 * @returns {T} The deep-cloned copy.
 * @example
 * const original = { id: 1, tags: ['a', 'b'] };
 * const copy = clone(original);
 * copy.tags.push('c');
 * // original.tags remains ['a', 'b']
 */
export const clone = <T>(value: T): T => structuredClone(value);

/**
 * Deeply merges a changeset object into a base record.
 * Protects specified keys (such as immutable 'id') from being modified,
 * and replaces array values entirely rather than concatenating them.
 *
 * @param {Record<string, unknown>} base - The original record.
 * @param {Record<string, unknown>} changes - Object containing modified fields.
 * @param {ReadonlySet<string>} [protectedFields=new Set()] - Set of field keys that cannot be modified.
 * @returns {Record<string, unknown>} A new record combining base and changes without mutating inputs.
 * @example
 * const original = {
 *   id: 10,
 *   profile: { name: 'Alice', theme: 'dark' },
 *   tags: ['user', 'verified']
 * };
 * const updates = {
 *   id: 99, // Protected, will be ignored
 *   profile: { name: 'Alicia' },
 *   tags: ['admin'] // Replaces existing array
 * };
 *
 * const merged = mergeRecord(original, updates, new Set(['id']));
 * // Returns:
 * // {
 * //   id: 10,
 * //   profile: { name: 'Alicia', theme: 'dark' },
 * //   tags: ['admin']
 * // }
 */
export function mergeRecord(
  base: Record<string, unknown>,
  changes: Record<string, unknown>,
  protectedFields: ReadonlySet<string> = new Set()
): Record<string, unknown> {
  const allowedChanges = Object.fromEntries(
    Object.entries(changes).filter(([key]) => !protectedFields.has(key))
  );
  return mergeWith(clone(base), clone(allowedChanges), (_baseValue, changeValue) =>
    Array.isArray(changeValue) ? clone(changeValue) : undefined
  );
}

/**
 * Retrieves the value located at a dot-delimited field path within a record.
 *
 * @param {Record<string, unknown>} record - The record object to query.
 * @param {string} fieldPath - Dot-separated path to the nested property (e.g. 'category' or 'profile.address.city').
 * @returns {unknown} The extracted value, or undefined if any part of the path is missing.
 * @example
 * const record = {
 *   id: 1,
 *   user: {
 *     profile: { name: 'John Doe', age: 30 }
 *   }
 * };
 *
 * getNestedValue(record, 'user.profile.name');
 * // Returns: 'John Doe'
 *
 * getNestedValue(record, 'user.address.zip');
 * // Returns: undefined
 */
export function getNestedValue(record: Record<string, unknown>, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((current, part) =>
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)[part]
      : undefined, record);
}

/**
 * Compares a record's 'id' property with a target identifier value.
 * Converts both operands to strings for flexible type-agnostic equality (e.g. 1 === "1").
 *
 * @param {Record<string, unknown>} record - The record possessing an id field.
 * @param {unknown} id - Target identifier value to match.
 * @returns {boolean} True if string representations match; otherwise false.
 * @example
 * identifierEquals({ id: 42, name: 'Widget' }, 42);
 * // Returns: true
 *
 * identifierEquals({ id: 42, name: 'Widget' }, '42');
 * // Returns: true
 *
 * identifierEquals({ id: 'abc' }, 'xyz');
 * // Returns: false
 */
export const identifierEquals = (record: Record<string, unknown>, id: unknown): boolean =>
  String(record.id) === String(id);

/**
 * Finds the index of a record matching the target ID within a collection definition.
 *
 * @param {CollectionDefinition} collection - The collection containing records.
 * @param {unknown} id - Target ID to search for.
 * @returns {number} The 0-based array index of the matching record, or -1 if not found.
 * @example
 * const collection: CollectionDefinition = {
 *   name: 'products',
 *   records: [
 *     { id: 10, name: 'Keyboard' },
 *     { id: 20, name: 'Mouse' }
 *   ]
 * };
 *
 * findRecordIndex(collection, 20);
 * // Returns: 1
 *
 * findRecordIndex(collection, 99);
 * // Returns: -1
 */
export const findRecordIndex = (collection: CollectionDefinition, id: unknown): number =>
  collection.records.findIndex((record) => identifierEquals(record, id));

/**
 * Generates a unique identifier value adhering to an ID schema that does not collide with existing records.
 * Attempts up to 100 pseudorandom generations using the PRNG before falling back to numeric max + 1 incrementation.
 *
 * @param {Record<string, any>} idSchema - The JSON Schema defining the identifier property.
 * @param {Array<Record<string, unknown>>} records - Existing records in the collection to check for collisions against.
 * @param {Prng} prng - Deterministic pseudorandom number generator.
 * @returns {unknown} A unique identifier value (number or string).
 * @throws {MoksyAgreementError} If a unique ID cannot be generated within schema bounds after all attempts.
 * @example
 * const idSchema = { type: 'integer', minimum: 1, maximum: 1000 };
 * const records = [{ id: 1 }, { id: 2 }];
 * const prng = createPrng(12345);
 *
 * const newId = generateUniqueIdentifier(idSchema, records, prng);
 * // Returns: A unique integer != 1 and != 2
 */
export function generateUniqueIdentifier(
  idSchema: Record<string, any>, records: Array<Record<string, unknown>>, prng: Prng
): unknown {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = generateValue(idSchema, prng);
    if (!records.some((record) => identifierEquals(record, candidate))) return candidate;
  }
  const numericIds = records.map(({ id }) => Number(id)).filter(Number.isFinite);
  const fallback = (numericIds.length ? Math.max(...numericIds) : 0) + 1;
  const numericType = schemaHasType(idSchema, 'integer') || schemaHasType(idSchema, 'number');
  if (numericType && (idSchema.maximum === undefined || fallback <= idSchema.maximum)) return fallback;
  throw new MoksyAgreementError(STATE_MESSAGES.UNIQUE_ID_FAILED);
}

/**
 * Iterates through a collection's initial records and guarantees that every record has a unique 'id'.
 * Missing or duplicate IDs are replaced with generated unique IDs in-place.
 *
 * @param {Array<Record<string, unknown>>} records - The list of records to inspect and normalize in-place.
 * @param {Record<string, any>} schema - The canonical record schema containing `properties.id`.
 * @param {Prng} prng - Deterministic pseudorandom number generator.
 * @returns {void}
 * @example
 * const records = [
 *   { id: 1, name: 'Item A' },
 *   { id: 1, name: 'Item B (duplicate)' },
 *   { name: 'Item C (missing id)' }
 * ];
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer', minimum: 1 }
 *   }
 * };
 * const prng = createPrng(42);
 *
 * ensureUniqueIdentifiers(records, schema, prng);
 * // records[0].id === 1
 * // records[1].id !== 1 (reassigned to unique id)
 * // records[2].id assigned to unique id
 */
export function ensureUniqueIdentifiers(
  records: Array<Record<string, unknown>>, schema: Record<string, any>, prng: Prng
): void {
  const idSchema = schema.properties?.id;
  if (!idSchema) return;
  const accepted: Array<Record<string, unknown>> = [];
  records.forEach((record) => {
    if (record.id === undefined || accepted.some((item) => identifierEquals(item, record.id))) {
      record.id = generateUniqueIdentifier(idSchema, accepted, prng);
    }
    accepted.push(record);
  });
}
