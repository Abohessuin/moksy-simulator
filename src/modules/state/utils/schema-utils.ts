import { MoksyAgreementError } from '../../../common/errors.js';
import type { NormalizedEndpoint } from '../../agreement/types.js';
import { STATE_MESSAGES } from '../messages.js';
import { inferStatefulOperation } from './operation-resolver.js';
import type { ListShape } from '../types/index.js';

/**
 * Checks whether a JSON Schema definition matches or includes a specific data type.
 * Supports both single type definitions (e.g., `type: 'string'`) and union type arrays (e.g., `type: ['string', 'null']`).
 *
 * @param {Record<string, any> | undefined} schema - The JSON Schema object to inspect.
 * @param {string} type - The JSON type name to check for (e.g., 'string', 'object', 'array', 'integer', 'number', 'null').
 * @returns {boolean} True if the schema specifies the type; otherwise false.
 * @example
 * // Single scalar type:
 * schemaHasType({ type: 'string' }, 'string');
 * // Returns: true
 *
 * @example
 * // Union array type:
 * schemaHasType({ type: ['string', 'null'] }, 'null');
 * // Returns: true
 *
 * @example
 * // Type mismatch or undefined schema:
 * schemaHasType({ type: 'integer' }, 'string');
 * // Returns: false
 * schemaHasType(undefined, 'object');
 * // Returns: false
 */
export function schemaHasType(schema: Record<string, any> | undefined, type: string): boolean {
  return schema?.type === type || (Array.isArray(schema?.type) && schema.type.includes(type));
}

/**
 * Identifies the top-level array property and its item schema within a list endpoint's success response schema.
 * Enforces that a stateful list response must contain exactly one top-level array of objects.
 *
 * @param {NormalizedEndpoint} endpoint - The list endpoint definition.
 * @returns {ListShape} Object containing the array property name and the items object schema.
 * @throws {MoksyAgreementError} If zero or more than one top-level array of objects is found.
 * @example
 * // Standard paginated/enveloped list response:
 * const shape = findListShape({
 *   method: 'GET',
 *   path: '/products',
 *   successResponseSchema: {
 *     type: 'object',
 *     properties: {
 *       total: { type: 'integer' },
 *       products: {
 *         type: 'array',
 *         items: {
 *           type: 'object',
 *           properties: { id: { type: 'integer' }, name: { type: 'string' } }
 *         }
 *       }
 *     }
 *   }
 * } as NormalizedEndpoint);
 * // Returns:
 * // {
 * //   property: 'products',
 * //   itemSchema: {
 * //     type: 'object',
 * //     properties: { id: { type: 'integer' }, name: { type: 'string' } }
 * //   }
 * // }
 */
export function findListShape(endpoint: NormalizedEndpoint): ListShape {
  const candidates = Object.entries<Record<string, any>>(
    endpoint.successResponseSchema?.properties ?? {}
  ).filter(([, schema]) => schemaHasType(schema, 'array') && schemaHasType(schema.items, 'object'));

  if (candidates.length !== 1) {
    throw new MoksyAgreementError(STATE_MESSAGES.LIST_SHAPE_INVALID(candidates.length), {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      section: 'Success response fields'
    });
  }

  return { property: candidates[0][0], itemSchema: candidates[0][1].items };
}

/**
 * Checks whether a dot-delimited field path exists in a JSON Schema object hierarchy.
 *
 * @param {Record<string, any>} schema - The JSON Schema to traverse.
 * @param {string} fieldPath - Dot-separated field path (e.g., 'category' or 'profile.contact.email').
 * @returns {boolean} True if every path segment exists within properties; otherwise false.
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     user: {
 *       type: 'object',
 *       properties: {
 *         profile: {
 *           type: 'object',
 *           properties: { name: { type: 'string' } }
 *         }
 *       }
 *     }
 *   }
 * };
 *
 * hasSchemaField(schema, 'user.profile.name');
 * // Returns: true
 *
 * hasSchemaField(schema, 'user.profile.age');
 * // Returns: false
 */
export function hasSchemaField(schema: Record<string, any>, fieldPath: string): boolean {
  return fieldPath.split('.').every((part) => {
    schema = schema?.properties?.[part];
    return Boolean(schema);
  });
}

/**
 * Finds the canonical record schema for a collection by inspecting all associated endpoints.
 * Compares the list item schema and success response schemas of item operations (read, create, patch, replace),
 * and selects the schema with the highest number of defined properties.
 *
 * @param {NormalizedEndpoint[]} endpoints - All endpoints associated with a collection.
 * @returns {Record<string, any> | undefined} The schema candidate with the most properties, or undefined if none found.
 * @example
 * const endpoints: NormalizedEndpoint[] = [
 *   // List endpoint returning basic fields { id, name }
 *   {
 *     method: 'GET',
 *     collection: 'products',
 *     pathParamNames: [],
 *     successResponseSchema: {
 *       type: 'object',
 *       properties: {
 *         items: {
 *           type: 'array',
 *           items: {
 *             type: 'object',
 *             properties: { id: { type: 'integer' }, name: { type: 'string' } }
 *           }
 *         }
 *       }
 *     }
 *   } as NormalizedEndpoint,
 *   // Detail read endpoint returning full record { id, name, description, price, tags }
 *   {
 *     method: 'GET',
 *     collection: 'products',
 *     pathParamNames: ['id'],
 *     successResponseSchema: {
 *       type: 'object',
 *       properties: {
 *         id: { type: 'integer' },
 *         name: { type: 'string' },
 *         description: { type: 'string' },
 *         price: { type: 'number' },
 *         tags: { type: 'array' }
 *       }
 *     }
 *   } as NormalizedEndpoint
 * ];
 *
 * const canonical = canonicalRecordSchema(endpoints);
 * // Returns the detail endpoint's schema (having 5 properties instead of 2).
 */
export function canonicalRecordSchema(endpoints: NormalizedEndpoint[]): Record<string, any> | undefined {
  const candidates = endpoints.flatMap((endpoint) => {
    const operation = inferStatefulOperation(endpoint);
    if (operation === 'list') return [findListShape(endpoint).itemSchema];
    return operation && operation !== 'delete' && endpoint.successResponseSchema
      ? [endpoint.successResponseSchema]
      : [];
  });
  return candidates.sort(
    (left, right) => Object.keys(right.properties ?? {}).length - Object.keys(left.properties ?? {}).length
  )[0];
}
