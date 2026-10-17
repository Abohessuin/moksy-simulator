import { FastifyRequest } from 'fastify';
import { HttpMethod } from '../common/types.js';
import { EngineRequest } from '../modules/engine/index.js';

/**
 * Converts OpenAPI curly-brace path syntax ("/users/{id}") to Fastify colon syntax ("/users/:id").
 * @param {string} path - OpenAPI path template.
 * @returns {string} Fastify path template.
 * @example
 * // Input:
 * convertPathToFastifySyntax("/categories/{categoryId}/products/{productId}");
 * // Expected Output:
 * // "/categories/:categoryId/products/:productId"
 */
export function convertPathToFastifySyntax(path: string): string {
  return path.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

/**
 * Adapts a native FastifyRequest into a protocol-agnostic EngineRequest.
 * Extracts path parameters, query parameters, headers, and request body.
 * @param {FastifyRequest} req - Native Fastify HTTP request.
 * @returns {EngineRequest} Protocol-agnostic EngineRequest.
 * @example
 * // Input:
 * const engineReq = adaptFastifyRequest(fastifyReq);
 * // Expected Output:
 * // {
 * //   method: "GET",
 * //   path: "/products",
 * //   params: {},
 * //   query: { page: "1" },
 * //   headers: { ... },
 * //   body: null
 * // }
 */
export function adaptFastifyRequest(req: FastifyRequest): EngineRequest {
  const urlPath = req.url.split('?')[0];

  return {
    method: req.method.toUpperCase() as HttpMethod,
    path: urlPath,
    params: (req.params as Record<string, string>) || {},
    query: (req.query as Record<string, string | string[]>) || {},
    headers: req.headers,
    body: req.body
  };
}
