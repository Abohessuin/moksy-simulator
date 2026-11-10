import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DASHBOARD_PREFIX } from './constants.js';
import { DASHBOARD_MESSAGES } from './messages.js';
import { registerAssetRoutes } from './routes/asset-routes.js';
import { registerEndpointRoutes } from './routes/endpoint-routes.js';
import { registerRecorderRoutes } from './routes/recorder-routes.js';
import { registerScenarioRoutes } from './routes/scenario-routes.js';
import { registerWorkspaceRoutes } from './routes/workspace-routes.js';
import type { DashboardController } from './types/index.js';

/**
 * Rejects dashboard access from non-loopback clients, including IPv4-mapped addresses.
 *
 * @param request - The incoming Fastify request to authorize.
 * @throws An HTTP 403 error when the request does not originate from loopback.
 */
function assertLocal(request: FastifyRequest): void {
  const address = request.ip.replace(/^::ffff:/, '');
  if (!['127.0.0.1', '::1'].includes(address)) {
    const error = new Error(DASHBOARD_MESSAGES.LOCAL_ONLY) as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Mounts dashboard HTTP controls and static assets on the existing mock server.
 * Route groups handle transport; the controller owns the shared runtime behavior.
 *
 * @param app - The Fastify server that also hosts the mock API.
 * @param controller - The dashboard controller bound to the server runtime.
 */
export function registerDashboardRoutes(app: FastifyInstance, controller: DashboardController): void {
  app.addHook('onRequest', async (request) => {
    const pathname = request.url.split('?', 1)[0];
    if (pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`)) {
      assertLocal(request);
    }
  });

  registerWorkspaceRoutes(app, controller);
  registerEndpointRoutes(app, controller);
  registerRecorderRoutes(app, controller);
  registerScenarioRoutes(app, controller);
  registerAssetRoutes(app);
}
