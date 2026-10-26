import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { NormalizedEndpoint } from '../modules/agreement/types.js';
import {
  generateResponse,
  generateResponseForStatus,
  resolveResponseStatus,
  validateRequest
} from '../modules/engine/index.js';
import { executeStatefulRequest } from '../modules/state/index.js';
import { SERVER_CONSTANTS } from './constants.js';
import { adaptFastifyRequest, convertPathToFastifySyntax } from './route-adapter.js';
import { ServerOptions } from './types.js';

/**
 * Creates the route handler for a single mock endpoint.
 * Connects the Task 4 Validation Engine and Task 5 Response Generator.
 * Validation failure strictly takes precedence over static status selection.
 * @param {NormalizedEndpoint} endpoint - Normalized endpoint definition.
 * @param {ServerOptions} options - Server configuration and shared PRNG.
 * @returns Fastify route handler function.
 */
export function createEndpointHandler(
  endpoint: NormalizedEndpoint,
  options: ServerOptions
): (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply> {
  const { config, prng } = options;

  return async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    // 1. Adapt Fastify request into protocol-agnostic EngineRequest
    const engineReq = adaptFastifyRequest(req);

    // 2. Step 1: Validate request (Task 4)
    // Note: Validation errors ALWAYS take precedence over static status selections!
    const validation = validateRequest(engineReq, endpoint);
    if (!validation.isValid) {
      return reply
        .status(validation.status)
        .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
        .send(validation.errorPayload);
    }

    if (endpoint.collection && options.statefulRuntime) {
      const selectedStatus = resolveResponseStatus(endpoint, config);
      const response = selectedStatus === endpoint.successStatus
        ? executeStatefulRequest(endpoint, validation.coercedRequest, options.statefulRuntime)
        : generateResponseForStatus(endpoint, selectedStatus, options.statefulRuntime.prng);

      if (response.status === 204) return reply.status(204).send();
      return reply
        .status(response.status)
        .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
        .send(response.body);
    }

    // 3. Step 2: Generate response (Task 5)
    const response = generateResponse(endpoint, config, prng);

    if (response.status === 204) {
      return reply.status(204).send();
    }

    return reply
      .status(response.status)
      .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
      .send(response.body);
  };
}

/**
 * Dynamically mounts all agreement endpoints into Fastify's in-memory route tree.
 * Respects configured basePath prefix and converts OpenAPI path parameters to Fastify format.
 * @param {FastifyInstance} app - Fastify instance.
 * @param {ServerOptions} options - Server options.
 * @example
 * // Mounts:
 * registerDynamicRoutes(app, { agreement, config });
 * // Fastify now routes "GET /products", "POST /products", etc.
 */
export function registerDynamicRoutes(app: FastifyInstance, options: ServerOptions): void {
  const { agreement, config } = options;
  const basePath = config.basePath || '';

  for (const endpoint of agreement.endpoints) {
    const fullPath = basePath ? `${basePath}${endpoint.path}` : endpoint.path;
    const fastifyPath = convertPathToFastifySyntax(fullPath);
    const handler = createEndpointHandler(endpoint, options);

    app.route({
      method: endpoint.method,
      url: fastifyPath,
      handler
    });
  }
}
