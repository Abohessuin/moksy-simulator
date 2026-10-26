import type { NormalizedEndpoint } from '../../agreement/types.js';
import type { Prng } from '../../engine/generation/prng.js';
import type { CoercedRequest } from '../../engine/types.js';
import type { GeneratedResponse } from '../../engine/generation/response-generator.js';

/**
 * Supported in-memory stateful operations.
 */
export type StatefulOperation = 'list' | 'create' | 'read' | 'patch' | 'replace' | 'delete';

/**
 * Represents an in-memory collection and its current records.
 */
export interface CollectionDefinition {
  /** Name of the collection shared across endpoints (e.g. 'products'). */
  name: string;
  /** Canonical JSON Schema defining the shape of a record in this collection. */
  recordSchema?: Record<string, any>;
  /** In-memory array of stored records. */
  records: Array<Record<string, unknown>>;
}

/**
 * State container for the simulator's active collections and PRNG instance.
 */
export interface StatefulRuntime {
  /** Deterministic PRNG initialized from simulator seed. */
  prng: Prng;
  /** Map of collection name to collection state definition. */
  collections: Map<string, CollectionDefinition>;
}

/**
 * Describes the structure of a list endpoint's success response envelope.
 */
export interface ListShape {
  /** Property name on the response object containing the array of items (e.g. 'items', 'data'). */
  property: string;
  /** JSON Schema for individual items within the array. */
  itemSchema: Record<string, any>;
}

/**
 * Contextual payload passed into an operation handler during request execution.
 */
export interface StatefulRequestContext {
  /** The matched normalized endpoint definition. */
  endpoint: NormalizedEndpoint;
  /** The validated and coerced incoming request data. */
  request: CoercedRequest;
  /** The simulator's stateful runtime instance. */
  runtime: StatefulRuntime;
  /** Target collection definition matching the endpoint. */
  collection: CollectionDefinition;
}

/**
 * Function signature for stateful CRUD operation handlers.
 */
export type StatefulOperationHandler = (context: StatefulRequestContext) => GeneratedResponse;
