import { MoksyAgreementError } from '../../common/errors.js';
import { STATE_MESSAGES } from './messages.js';
import type { NormalizedAgreement, NormalizedEndpoint, ParsedRequestField, RequestBehavior } from '../agreement/types.js';
import type { SimulatorConfig } from '../config/types.js';
import { generateResponseForStatus, verifyGeneratedPayload, type GeneratedResponse } from '../engine/generation/response-generator.js';
import { createPrng } from '../engine/generation/prng.js';
import { generateValue } from '../engine/generation/value-generators.js';
import { inferStatefulOperation } from './utils/operation-resolver.js';
import { clone, ensureUniqueIdentifiers, findRecordIndex, generateUniqueIdentifier, getNestedValue, identifierEquals, mergeRecord } from './utils/record-utils.js';
import { canonicalRecordSchema, findListShape, schemaHasType } from './utils/schema-utils.js';
import type { CollectionDefinition, StatefulOperationHandler, StatefulRequestContext, StatefulRuntime } from './types/index.js';

export { inferStatefulOperation } from './utils/operation-resolver.js';
export { findListShape } from './utils/schema-utils.js';
export type { StatefulOperation, StatefulRuntime } from './types/index.js';

type FilterHandler = (records: Array<Record<string, unknown>>, value: unknown, field: string) => Array<Record<string, unknown>>;

const FILTER_HANDLERS: Partial<Record<RequestBehavior['kind'], FilterHandler>> = {
  filter: (records, value, field) => records.filter(
    (record) => String(getNestedValue(record, field)) === String(value)
  ),
  search: (records, value, field) => {
    const needle = String(value).toLowerCase();
    return records.filter((record) => String(getNestedValue(record, field) ?? '').toLowerCase().includes(needle));
  }
};

/**
 * Projects a record value against a target JSON Schema, stripping any properties
 * not defined in the schema to ensure the payload matches the endpoint's agreement.
 * Supports nested objects and arrays of objects.
 *
 * @param {unknown} value - The input value or object to project.
 * @param {Record<string, any>} schema - Target JSON Schema defining allowed properties.
 * @returns {unknown} A new object containing only properties declared in the schema.
 * @example
 * const fullRecord = { id: 1, name: 'Phone', cost: 100, internalNotes: 'secret' };
 * const publicSchema = {
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     name: { type: 'string' }
 *   }
 * };
 *
 * projectToSchema(fullRecord, publicSchema);
 * // Returns: { id: 1, name: 'Phone' }
 */
function projectToSchema(value: unknown, schema: Record<string, any>): unknown {
  if (value === null || value === undefined) return value;
  if (schemaHasType(schema, 'array') && Array.isArray(value)) {
    return value.map((item) => projectToSchema(item, schema.items ?? {}));
  }
  if (!schemaHasType(schema, 'object') || typeof value !== 'object' || Array.isArray(value)) return clone(value);
  return Object.fromEntries(Object.entries<Record<string, any>>(schema.properties ?? {})
    .filter(([key]) => key in (value as Record<string, unknown>))
    .map(([key, propertySchema]) => [key, projectToSchema((value as Record<string, unknown>)[key], propertySchema)]));
}

/**
 * Filters an array of records based on active query parameters matching declared
 * endpoint behaviors (such as `filter=<field>` or `search=<field>`).
 *
 * @param {Array<Record<string, unknown>>} records - The collection records to filter.
 * @param {Record<string, unknown>} query - Query parameters from the incoming request.
 * @param {ParsedRequestField[]} fields - Request fields defined for the endpoint.
 * @returns {Array<Record<string, unknown>>} The filtered array of records.
 * @example
 * const records = [
 *   { id: 1, category: 'books', title: 'JavaScript Guide' },
 *   { id: 2, category: 'hardware', title: 'USB Cable' }
 * ];
 * const query = { category: 'books' };
 * const fields = [{
 *   field: 'category',
 *   location: 'query',
 *   behavior: { kind: 'filter', recordField: 'category' }
 * } as ParsedRequestField];
 *
 * applyRecordBehaviors(records, query, fields);
 * // Returns: [{ id: 1, category: 'books', title: 'JavaScript Guide' }]
 */
function applyRecordBehaviors(
  records: Array<Record<string, unknown>>, query: Record<string, unknown>, fields: ParsedRequestField[]
): Array<Record<string, unknown>> {
  return fields.reduce((result, field) => {
    const behavior = field.behavior;
    const handler = behavior && FILTER_HANDLERS[behavior.kind];
    return handler && query[field.field] !== undefined && behavior && 'recordField' in behavior
      ? handler(result, query[field.field], behavior.recordField)
      : result;
  }, records);
}

/**
 * Applies pagination slicing to an array of records using `page` and `pageSize` query parameters.
 * Defaults to page 1 and all records if parameters are missing or invalid.
 *
 * @param {Array<Record<string, unknown>>} records - The collection records to paginate.
 * @param {Record<string, unknown>} query - Query parameters from the incoming request.
 * @param {ParsedRequestField[]} fields - Request fields defined on the endpoint.
 * @returns {Array<Record<string, unknown>>} The sliced sub-array for the requested page.
 * @example
 * const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
 * const query = { page: 2, limit: 2 };
 * const fields = [
 *   { field: 'page', location: 'query', behavior: { kind: 'page' } },
 *   { field: 'limit', location: 'query', behavior: { kind: 'pageSize' } }
 * ] as ParsedRequestField[];
 *
 * applyPagination(records, query, fields);
 * // Returns: [{ id: 3 }, { id: 4 }]
 */
function applyPagination(
  records: Array<Record<string, unknown>>, query: Record<string, unknown>, fields: ParsedRequestField[]
): Array<Record<string, unknown>> {
  const behaviorField = (kind: RequestBehavior['kind']) => fields.find((field) => field.behavior?.kind === kind)?.field;
  const pageField = behaviorField('page');
  const sizeField = behaviorField('pageSize');
  if (!pageField && !sizeField) return records;
  const page = Math.max(1, Number(pageField ? query[pageField] : 1) || 1);
  const size = Math.max(1, Number(sizeField ? query[sizeField] : records.length) || records.length);
  const start = (page - 1) * size;
  return records.slice(start, start + size);
}

/**
 * Applies all request query behaviors (filtering, searching, and pagination) in sequence to an array of records.
 *
 * @param {Array<Record<string, unknown>>} records - The collection records to process.
 * @param {Record<string, unknown>} query - Query parameters from the incoming request.
 * @param {ParsedRequestField[]} fields - Query request fields defined on the endpoint.
 * @returns {Array<Record<string, unknown>>} The filtered and paginated records.
 * @example
 * const records = [
 *   { id: 1, tag: 'urgent' },
 *   { id: 2, tag: 'normal' },
 *   { id: 3, tag: 'urgent' }
 * ];
 * const query = { tag: 'urgent', page: 1, limit: 1 };
 * const fields = [
 *   { field: 'tag', location: 'query', behavior: { kind: 'filter', recordField: 'tag' } },
 *   { field: 'page', location: 'query', behavior: { kind: 'page' } },
 *   { field: 'limit', location: 'query', behavior: { kind: 'pageSize' } }
 * ] as ParsedRequestField[];
 *
 * applyBehavior(records, query, fields);
 * // Returns: [{ id: 1, tag: 'urgent' }]
 */
function applyBehavior(
  records: Array<Record<string, unknown>>, query: Record<string, unknown>, fields: ParsedRequestField[]
): Array<Record<string, unknown>> {
  return applyPagination(applyRecordBehaviors(records, query, fields), query, fields);
}

/**
 * Formats a successful single-record response.
 * Projects the record to the endpoint's success response schema, validates it with Ajv,
 * and sets the HTTP status code (e.g., 200 or 201).
 *
 * @param {NormalizedEndpoint} endpoint - The endpoint definition specifying success status and schema.
 * @param {Record<string, unknown>} record - The stateful record to return in the response body.
 * @returns {GeneratedResponse} The generated HTTP response { status, body }.
 * @example
 * const endpoint = {
 *   successStatus: 200,
 *   successResponseSchema: {
 *     type: 'object',
 *     properties: { id: { type: 'integer' }, name: { type: 'string' } }
 *   }
 * } as NormalizedEndpoint;
 *
 * successRecordResponse(endpoint, { id: 1, name: 'Widget', secret: 'hide' });
 * // Returns: { status: 200, body: { id: 1, name: 'Widget' } }
 */
function successRecordResponse(endpoint: NormalizedEndpoint, record: Record<string, unknown>): GeneratedResponse {
  const body = endpoint.successResponseSchema ? projectToSchema(record, endpoint.successResponseSchema) : clone(record);
  if (endpoint.successResponseSchema) verifyGeneratedPayload(body, endpoint.successResponseSchema);
  return { status: endpoint.successStatus, body };
}

/**
 * Generates an HTTP 404 response when a requested record is not found in the collection.
 * Uses the agreement's defined 404 error schema if available; otherwise falls back to a standard JSON error message.
 *
 * @param {StatefulRequestContext} context - The stateful request execution context.
 * @returns {GeneratedResponse} The 404 response object { status: 404, body }.
 * @example
 * notFoundResponse(context);
 * // Returns: { status: 404, body: { message: 'Record not found' } }
 */
function notFoundResponse({ endpoint, runtime }: StatefulRequestContext): GeneratedResponse {
  return endpoint.errorResponses[404]
    ? generateResponseForStatus(endpoint, 404, runtime.prng)
    : { status: 404, body: { message: STATE_MESSAGES.RECORD_NOT_FOUND } };
}

/**
 * Safely extracts the JSON request body as a key-value record from the request context.
 * Returns an empty object if body is missing, not an object, or is an array.
 *
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {Record<string, unknown>} The request body object or an empty object.
 * @example
 * requestBody({ request: { body: { name: 'New Item' } } } as StatefulRequestContext);
 * // Returns: { name: 'New Item' }
 *
 * requestBody({ request: { body: null } } as StatefulRequestContext);
 * // Returns: {}
 */
function requestBody({ request }: StatefulRequestContext): Record<string, unknown> {
  const { body } = request;
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

/**
 * Looks up the targeted item record and its index in the collection using the endpoint's path parameter ID.
 *
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {{ index: number; record?: Record<string, unknown> }} Object with index (-1 if not found) and record reference.
 * @example
 * const context = {
 *   endpoint: { pathParamNames: ['id'] },
 *   request: { params: { id: '42' } },
 *   collection: { records: [{ id: 42, name: 'Widget' }] }
 * } as unknown as StatefulRequestContext;
 *
 * itemRecordContext(context);
 * // Returns: { index: 0, record: { id: 42, name: 'Widget' } }
 */
function itemRecordContext(context: StatefulRequestContext): { index: number; record?: Record<string, unknown> } {
  const id = context.request.params[context.endpoint.pathParamNames[0]];
  const index = findRecordIndex(context.collection, id);
  return { index, record: context.collection.records[index] };
}

/**
 * Handler for 'list' operations (GET on collection-level endpoints).
 * Applies query behaviors (filter, search, pagination), generates the response envelope
 * using PRNG, populates the items array with projected collection records, and returns HTTP 200.
 *
 * @type {StatefulOperationHandler}
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {GeneratedResponse} The generated list response { status: 200, body }.
 * @example
 * // GET /products?category=electronics&page=1
 * const response = list(context);
 * // Returns: { status: 200, body: { total: 10, items: [...] } }
 */
const list: StatefulOperationHandler = ({ endpoint, request, runtime, collection }) => {
  const shape = findListShape(endpoint);
  const fields = endpoint.requestFields.filter(({ location }) => location === 'query');
  const records = applyBehavior(collection.records, request.query, fields);
  const body = generateValue(endpoint.successResponseSchema, runtime.prng) as Record<string, unknown>;
  body[shape.property] = records.map((record) => projectToSchema(record, shape.itemSchema));
  verifyGeneratedPayload(body, endpoint.successResponseSchema);
  return { status: endpoint.successStatus, body };
};

/**
 * Handler for 'create' operations (POST on collection-level endpoints).
 * Merges random dummy defaults with the supplied request body, assigns a guaranteed unique ID,
 * pushes the new record into the collection, and returns the created record with HTTP 201.
 *
 * @type {StatefulOperationHandler}
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {GeneratedResponse} The created response { status: 201, body: newRecord }.
 * @example
 * // POST /products with body { name: 'Keyboard', price: 99 }
 * const response = create(context);
 * // Returns: { status: 201, body: { id: 3, name: 'Keyboard', price: 99, ... } }
 */
const create: StatefulOperationHandler = (context) => {
  const { endpoint, runtime, collection } = context;
  const schema = endpoint.successResponseSchema ?? collection.recordSchema ?? {};
  const record = mergeRecord(generateValue(schema, runtime.prng) as Record<string, unknown>, requestBody(context), new Set(['id']));
  const idSchema = schema.properties?.id;
  if (idSchema && (record.id === undefined || collection.records.some((item) => identifierEquals(item, record.id)))) {
    record.id = generateUniqueIdentifier(idSchema, collection.records, runtime.prng);
  }
  collection.records.push(clone(record));
  return successRecordResponse(endpoint, record);
};

/**
 * Handler for 'read' operations (GET on item-level endpoints).
 * Retrieves a single record by its path parameter ID. Returns HTTP 200 with projected record,
 * or HTTP 404 if the record does not exist.
 *
 * @type {StatefulOperationHandler}
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {GeneratedResponse} The response { status: 200, body: record } or 404.
 * @example
 * // GET /products/42
 * const response = read(context);
 * // Returns: { status: 200, body: { id: 42, name: 'Item 42' } }
 */
const read: StatefulOperationHandler = (context) => {
  const { record } = itemRecordContext(context);
  return record ? successRecordResponse(context.endpoint, record) : notFoundResponse(context);
};

/**
 * Handler for 'delete' operations (DELETE on item-level endpoints).
 * Finds the record by path parameter ID and splices it from the in-memory array.
 * Returns the agreed success status (e.g. HTTP 204 or 200) or HTTP 404 if not found.
 *
 * @type {StatefulOperationHandler}
 * @param {StatefulRequestContext} context - The stateful request context.
 * @returns {GeneratedResponse} The delete response { status: 204, body: null } or 404.
 * @example
 * // DELETE /products/42
 * const response = remove(context);
 * // Returns: { status: 204, body: null }
 */
const remove: StatefulOperationHandler = (context) => {
  const { index } = itemRecordContext(context);
  if (index < 0) return notFoundResponse(context);
  context.collection.records.splice(index, 1);
  return generateResponseForStatus(context.endpoint, context.endpoint.successStatus, context.runtime.prng);
};

/**
 * Handles partial update ('patch') or full replacement ('replace') for item-level endpoints.
 * - When replace is false (PATCH): Existing record fields are merged with request body.
 * - When replace is true (PUT): A fresh schema-generated base is overwritten with request body.
 * In both cases, the original 'id' is immutable and preserved.
 *
 * @param {StatefulRequestContext} context - The stateful request context.
 * @param {boolean} replace - True for full replacement (PUT), false for partial patch (PATCH).
 * @returns {GeneratedResponse} The updated response { status: 200, body: updatedRecord } or 404.
 * @example
 * // PATCH /products/42 with body { price: 120 }
 * const patchResponse = update(context, false);
 * // Returns: { status: 200, body: { id: 42, name: 'Same Name', price: 120 } }
 *
 * // PUT /products/42 with body { name: 'Completely New', price: 150 }
 * const putResponse = update(context, true);
 * // Returns: { status: 200, body: { id: 42, name: 'Completely New', price: 150, ... } }
 */
function update(context: StatefulRequestContext, replace: boolean): GeneratedResponse {
  const { index, record } = itemRecordContext(context);
  if (!record) return notFoundResponse(context);
  const schema = context.endpoint.successResponseSchema ?? context.collection.recordSchema ?? {};
  const base = replace ? generateValue(schema, context.runtime.prng) as Record<string, unknown> : record;
  const updated = mergeRecord(base, requestBody(context), new Set(['id']));
  updated.id = record.id;
  context.collection.records[index] = clone(updated);
  return successRecordResponse(context.endpoint, updated);
}

const HANDLERS: Record<NonNullable<ReturnType<typeof inferStatefulOperation>>, StatefulOperationHandler> = {
  list, create, read,
  patch: (context) => update(context, false),
  replace: (context) => update(context, true),
  delete: remove
};

/**
 * Groups a flat array of normalized endpoints into a map keyed by collection name.
 * Endpoints without a collection property are excluded.
 *
 * @param {NormalizedEndpoint[]} endpoints - All normalized endpoints from the agreement.
 * @returns {Map<string, NormalizedEndpoint[]>} Map of collection name to associated endpoints.
 * @example
 * const endpoints = [
 *   { collection: 'products', method: 'GET', path: '/products' },
 *   { collection: 'products', method: 'POST', path: '/products' },
 *   { method: 'GET', path: '/health' } // no collection
 * ] as NormalizedEndpoint[];
 *
 * groupCollections(endpoints);
 * // Returns Map with key 'products' => [GET /products, POST /products]
 */
function groupCollections(endpoints: NormalizedEndpoint[]): Map<string, NormalizedEndpoint[]> {
  return endpoints.reduce((groups, endpoint) => {
    if (!endpoint.collection) return groups;
    groups.set(endpoint.collection, [...(groups.get(endpoint.collection) ?? []), endpoint]);
    return groups;
  }, new Map<string, NormalizedEndpoint[]>());
}

/**
 * Generates initial seed records for a collection using the list endpoint's schema and the PRNG.
 * Extracts the items array from the generated list response and merges each item with the canonical record schema.
 *
 * @param {NormalizedEndpoint} endpoint - The collection's list endpoint definition.
 * @param {Record<string, any> | undefined} recordSchema - The canonical record schema for full attribute generation.
 * @param {StatefulRuntime['prng']} prng - Deterministic pseudorandom number generator.
 * @returns {Array<Record<string, unknown>>} Array of seeded record objects.
 * @example
 * const records = generateInitialRecords(listEndpoint, canonicalSchema, prng);
 * // Returns: [{ id: 1, name: '...', price: ... }, { id: 2, ... }]
 */
function generateInitialRecords(
  endpoint: NormalizedEndpoint, recordSchema: Record<string, any> | undefined, prng: StatefulRuntime['prng']
): Array<Record<string, unknown>> {
  const shape = findListShape(endpoint);
  const generated = generateValue(endpoint.successResponseSchema, prng) as Record<string, unknown>;
  const records = Array.isArray(generated?.[shape.property]) ? generated[shape.property] as Array<Record<string, unknown>> : [];
  return records.map((record) => recordSchema
    ? mergeRecord(generateValue(recordSchema, prng) as Record<string, unknown>, record)
    : clone(record));
}

/**
 * Initializes a single collection definition at server startup.
 * Finds its canonical schema, generates initial records via the list endpoint,
 * and ensures all records have unique IDs.
 *
 * @param {string} name - Name of the collection.
 * @param {NormalizedEndpoint[]} endpoints - Endpoints associated with this collection.
 * @param {Pick<StatefulRuntime, 'prng'>} runtime - Runtime containing the seeded PRNG.
 * @returns {CollectionDefinition} Initialized collection object { name, recordSchema, records }.
 * @example
 * const collection = initializeCollection('products', endpoints, { prng });
 * // Returns: { name: 'products', recordSchema: {...}, records: [...] }
 */
function initializeCollection(
  name: string, endpoints: NormalizedEndpoint[], runtime: Pick<StatefulRuntime, 'prng'>
): CollectionDefinition {
  const recordSchema = canonicalRecordSchema(endpoints);
  const listEndpoint = endpoints.find((endpoint) => inferStatefulOperation(endpoint) === 'list');
  const records = listEndpoint ? generateInitialRecords(listEndpoint, recordSchema, runtime.prng) : [];
  if (recordSchema) ensureUniqueIdentifiers(records, recordSchema, runtime.prng);
  return { name, recordSchema, records };
}

/**
 * Factory function that initializes the complete stateful in-memory runtime.
 * Creates the deterministic PRNG from config.seed, groups all collection endpoints,
 * and pre-populates all collections with deterministic seed records.
 *
 * @param {NormalizedAgreement} agreement - Normalized API agreement containing all endpoints.
 * @param {SimulatorConfig} config - Simulator configuration containing seed and port settings.
 * @param {StatefulRuntime['prng']} [providedPrng] - Optional existing PRNG instance for testing or dependency injection.
 * @returns {StatefulRuntime} Initialized stateful runtime holding PRNG and collections map.
 * @example
 * const runtime = createStatefulRuntime(agreement, { seed: 42 } as SimulatorConfig);
 * // Access initialized collections:
 * const products = runtime.collections.get('products');
 * console.log(`Seeded ${products?.records.length} products`);
 */
export function createStatefulRuntime(
  agreement: NormalizedAgreement, config: SimulatorConfig, providedPrng?: StatefulRuntime['prng']
): StatefulRuntime {
  const runtime: StatefulRuntime = { prng: providedPrng ?? createPrng(config.seed), collections: new Map() };
  groupCollections(agreement.endpoints).forEach((endpoints, name) =>
    runtime.collections.set(name, initializeCollection(name, endpoints, runtime)));
  return runtime;
}

/**
 * Dispatches and executes an incoming HTTP request against the in-memory stateful runtime.
 * Infers the operation (list, create, read, patch, replace, delete), locates the collection,
 * applies mutations or queries, and returns the resulting status and payload.
 *
 * @param {NormalizedEndpoint} endpoint - The matched endpoint definition.
 * @param {StatefulRequestContext['request']} request - Coerced request containing params, query, and body.
 * @param {StatefulRuntime} runtime - In-memory stateful runtime.
 * @returns {GeneratedResponse} The HTTP response { status, body }.
 * @throws {MoksyAgreementError} If the endpoint lacks an inferable operation or collection.
 * @example
 * const response = executeStatefulRequest(endpoint, coercedRequest, runtime);
 * // Returns: { status: 200, body: { ... } }
 */
export function executeStatefulRequest(
  endpoint: NormalizedEndpoint, request: StatefulRequestContext['request'], runtime: StatefulRuntime
): GeneratedResponse {
  const operation = inferStatefulOperation(endpoint);
  const collection = endpoint.collection ? runtime.collections.get(endpoint.collection) : undefined;
  if (!operation || !collection) {
    throw new MoksyAgreementError(STATE_MESSAGES.COLLECTION_UNAVAILABLE(endpoint.method, endpoint.path));
  }
  return HANDLERS[operation]({ endpoint, request, runtime, collection });
}
