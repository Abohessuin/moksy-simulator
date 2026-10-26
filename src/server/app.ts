import cors from '@fastify/cors';
import fastify, { FastifyError, FastifyInstance } from 'fastify';
import { SERVER_MESSAGES } from '../common/messages.js';
import { SERVER_CONSTANTS } from './constants.js';
import { createStatefulRuntime } from '../modules/state/index.js';
import { registerDynamicRoutes } from './route-registrar.js';
import { ServerOptions } from './types.js';

/**
 * Creates and configures the Fastify server instance.
 * Sets up CORS, custom 404 route handling, malformed JSON interception,
 * and mounts all dynamic in-memory routes from the API agreement.
 * Request logging is disabled per v1.0.0 product scope.
 * @param {ServerOptions} options - Server configuration and agreement.
 * @returns {FastifyInstance} Configured Fastify instance.
 * @example
 * // Create Fastify instance:
 * const app = createApp({ config, agreement });
 * await app.listen({ port: 4500 });
 */
export function createApp(options: ServerOptions): FastifyInstance {
  const app = fastify({
    logger: false // Strict v1.0.0 mandate: no request logs
  });

  // 1. Configure CORS and browser preflight
  const allowedOrigins = options.config.allowedOrigins;
  const originSetting = allowedOrigins.includes('*') ? true : allowedOrigins;

  app.register(cors, {
    origin: originSetting,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
  });

  // 2. Custom 404 Route Not Found handler
  app.setNotFoundHandler((req, reply) => {
    reply
      .status(404)
      .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
      .send({
        error: 'Not Found',
        message: SERVER_MESSAGES.ROUTE_NOT_FOUND(req.method, req.url)
      });
  });

  // 3. Custom Error Handler for malformed JSON and syntax errors
  app.setErrorHandler((error: FastifyError, req, reply) => {
    // Intercept JSON body parser syntax errors
    const isMalformedJson =
      error.statusCode === 400 &&
      (error.message.includes('JSON') || error.message.includes('Unexpected') || error.name === 'SyntaxError');

    if (isMalformedJson) {
      return reply
        .status(400)
        .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
        .send({
          message: SERVER_MESSAGES.MALFORMED_JSON
        });
    }

    const statusCode = error.statusCode || 500;
    return reply
      .status(statusCode)
      .header('content-type', SERVER_CONSTANTS.JSON_CONTENT_TYPE)
      .send({
        message: error.message
      });
  });

  // 4. Mount dynamic agreement endpoints in memory
  const statefulRuntime = options.statefulRuntime || createStatefulRuntime(
    options.agreement,
    options.config,
    options.prng
  );
  registerDynamicRoutes(app, { ...options, statefulRuntime });

  return app;
}
