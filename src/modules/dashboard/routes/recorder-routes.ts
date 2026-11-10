import type { FastifyInstance } from 'fastify';
import { DASHBOARD_API_PREFIX } from '../constants.js';
import type { DashboardController } from '../types/index.js';

/**
 * Registers recording controls while the Testing tab remains hidden.
 *
 * @param app - The Fastify server on which recorder routes are registered.
 * @param controller - The dashboard controller used by the route handlers.
 */
export function registerRecorderRoutes(app: FastifyInstance, controller: DashboardController): void {
  const recorderRoute = `${DASHBOARD_API_PREFIX}/recorder`;

  app.get(recorderRoute, async () => controller.recordingStatus());

  app.post(`${recorderRoute}/start`, async () => {
    controller.startRecording();
    return controller.recordingStatus();
  });

  app.post(`${recorderRoute}/stop`, async () => {
    controller.stopRecording();
    return controller.recordingStatus();
  });
}
