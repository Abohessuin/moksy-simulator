import type { FastifyInstance } from 'fastify';
import type { NormalizedEndpoint } from '../../agreement/types.js';
import { DASHBOARD_API_PREFIX } from '../constants.js';
import { DASHBOARD_MESSAGES } from '../messages.js';
import type { DashboardController } from '../types/index.js';

interface EndpointParams {
  key: string;
}

/**
 * Lists the normal success status and every agreed error for an endpoint.
 *
 * @param endpoint - The normalized agreement endpoint.
 * @returns Every response status the dashboard may select for the endpoint.
 */
function allowedStatuses(endpoint: NormalizedEndpoint): number[] {
  return [endpoint.successStatus, ...Object.keys(endpoint.errorResponses).map(Number)];
}

/**
 * Projects agreement fields and current overrides into the browser endpoint list.
 *
 * @param controller - The controller providing agreement and override state.
 * @returns Endpoint records suitable for dashboard JSON serialization.
 */
function projectEndpoints(controller: DashboardController) {
  return controller.context.agreement.endpoints.map((endpoint) => ({
    key: controller.endpointKey(endpoint),
    name: endpoint.apiName,
    method: endpoint.method,
    path: endpoint.path,
    collection: endpoint.collection,
    authentication: endpoint.authentication,
    requestBodyContentType: endpoint.requestBodyContentType,
    successStatus: endpoint.successStatus,
    successResponseSchema: endpoint.successResponseSchema,
    requestFields: endpoint.requestFields.map((field) => ({
      ...field,
      behavior: field.behavior
        ? field.behavior.kind + ('recordField' in field.behavior ? `=${field.behavior.recordField}` : '')
        : undefined
    })),
    statuses: allowedStatuses(endpoint),
    override: controller.getOverride(endpoint)
  }));
}

/**
 * Registers endpoint inspection and agreement-validated response overrides.
 *
 * @param app - The Fastify server on which endpoint routes are registered.
 * @param controller - The dashboard controller used by the route handlers.
 */
export function registerEndpointRoutes(app: FastifyInstance, controller: DashboardController): void {
  const overrideRoute = `${DASHBOARD_API_PREFIX}/endpoints/:key/override`;

  app.get(`${DASHBOARD_API_PREFIX}/endpoints`, async () => projectEndpoints(controller));

  app.put<{ Params: EndpointParams; Body: { status?: unknown } | undefined }>(
    overrideRoute,
    async (request, reply) => {
      // Fastify has already decoded the URL parameter once.
      const { key } = request.params;
      const endpoint = controller.context.agreement.endpoints
        .find((candidate) => controller.endpointKey(candidate) === key);
      if (!endpoint) {
        return reply.status(404).send({ message: DASHBOARD_MESSAGES.ENDPOINT_NOT_FOUND });
      }

      const status = Number(request.body?.status);
      if (!allowedStatuses(endpoint).includes(status)) {
        return reply.status(400).send({ message: DASHBOARD_MESSAGES.STATUS_NOT_ALLOWED });
      }

      controller.setOverride(key, status === endpoint.successStatus ? undefined : status);
      return { ok: true };
    }
  );

  app.delete<{ Params: EndpointParams }>(overrideRoute, async (request) => {
    controller.setOverride(request.params.key, undefined);
    return { ok: true };
  });
}
