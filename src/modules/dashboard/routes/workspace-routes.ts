import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { getMoksyServerOrigin } from '../../config/server-address.js';
import { DASHBOARD_API_PREFIX } from '../constants.js';
import type { DashboardController } from '../types/index.js';

/**
 * Registers active workspace metadata, collection inspection, and runtime reset.
 *
 * @param app - The Fastify server on which workspace routes are registered.
 * @param controller - The dashboard controller used by the route handlers.
 */
export function registerWorkspaceRoutes(app: FastifyInstance, controller: DashboardController): void {
  app.get(`${DASHBOARD_API_PREFIX}/workspace`, async () => {
    const { config, agreement, runtime } = controller.context;
    return {
      configName: 'simulator.config.json',
      agreementName: path.basename(agreement.filePath ?? config.agreementPath),
      baseUrl: `${getMoksyServerOrigin(config)}${config.basePath ?? ''}`,
      port: config.port,
      seed: config.seed === undefined ? 'Random' : `${config.seed} · Deterministic`,
      endpointCount: agreement.endpoints.length,
      collectionCount: runtime.collections.size
    };
  });

  app.post(`${DASHBOARD_API_PREFIX}/workspace/reset`, async () => {
    controller.resetRuntime();
    return { ok: true };
  });

  app.get(`${DASHBOARD_API_PREFIX}/collections`, async () => controller.snapshotCollections());
}
