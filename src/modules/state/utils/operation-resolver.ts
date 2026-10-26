import type { NormalizedEndpoint } from '../../agreement/types.js';
import type { StatefulOperation } from '../types/index.js';

const OPERATIONS: Record<'collection' | 'item', Partial<Record<string, StatefulOperation>>> = {
  collection: { GET: 'list', POST: 'create' },
  item: { GET: 'read', PATCH: 'patch', PUT: 'replace', DELETE: 'delete' }
};

/**
 * Infers the stateful CRUD operation for an endpoint based on its HTTP method,
 * collection annotation, and presence of path parameters.
 *
 * Mapping rules:
 * - Collection routes (0 path parameters):
 *   - GET  -> 'list'
 *   - POST -> 'create'
 * - Item routes (1+ path parameters):
 *   - GET    -> 'read'
 *   - PATCH  -> 'patch'
 *   - PUT    -> 'replace'
 *   - DELETE -> 'delete'
 *
 * @param {NormalizedEndpoint} endpoint - The normalized endpoint definition to inspect.
 * @returns {StatefulOperation | null} The inferred stateful operation ('list' | 'create' | 'read' | 'patch' | 'replace' | 'delete'), or null if the endpoint does not belong to a collection or uses an unsupported method.
 * @example
 * // Collection-level GET:
 * inferStatefulOperation({
 *   collection: 'products',
 *   method: 'GET',
 *   pathParamNames: []
 * } as NormalizedEndpoint);
 * // Returns: 'list'
 *
 * @example
 * // Item-level PATCH:
 * inferStatefulOperation({
 *   collection: 'products',
 *   method: 'PATCH',
 *   pathParamNames: ['id']
 * } as NormalizedEndpoint);
 * // Returns: 'patch'
 *
 * @example
 * // Non-stateful endpoint (no collection declared):
 * inferStatefulOperation({
 *   method: 'GET',
 *   pathParamNames: []
 * } as NormalizedEndpoint);
 * // Returns: null
 */
export function inferStatefulOperation(endpoint: NormalizedEndpoint): StatefulOperation | null {
  if (!endpoint.collection) return null;
  const routeKind = endpoint.pathParamNames.length > 0 ? 'item' : 'collection';
  return OPERATIONS[routeKind][endpoint.method] ?? null;
}
