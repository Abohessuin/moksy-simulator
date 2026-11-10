import type { FastifyInstance } from 'fastify';
import { DASHBOARD_API_PREFIX } from '../constants.js';
import { DASHBOARD_MESSAGES } from '../messages.js';
import { runScenario } from '../services/scenario-runner.js';
import type { DashboardController } from '../types/index.js';

interface ScenarioParams {
  id: string;
}

interface CreateScenarioBody {
  name?: unknown;
  description?: unknown;
  eventIds?: unknown;
}

/**
 * Registers saved-scenario listing, creation, deletion, and sequential replay.
 *
 * @param app - The Fastify server on which scenario routes are registered.
 * @param controller - The dashboard controller used by the route handlers.
 */
export function registerScenarioRoutes(app: FastifyInstance, controller: DashboardController): void {
  const scenariosRoute = `${DASHBOARD_API_PREFIX}/scenarios`;

  app.get(scenariosRoute, async () => controller.listScenarios());

  app.post<{ Body: CreateScenarioBody | undefined }>(scenariosRoute, async (request, reply) => {
    const body = request.body;
    if (typeof body?.name !== 'string' || !body.name.trim()) {
      return reply.status(400).send({ message: DASHBOARD_MESSAGES.SCENARIO_NAME_REQUIRED });
    }
    if (!Array.isArray(body.eventIds) || !body.eventIds.length ||
      !body.eventIds.every((id): id is string => typeof id === 'string')) {
      return reply.status(400).send({ message: DASHBOARD_MESSAGES.EVENTS_REQUIRED });
    }
    if (body.description !== undefined && typeof body.description !== 'string') {
      return reply.status(400).send({ message: DASHBOARD_MESSAGES.INVALID_REQUEST });
    }

    return reply.status(201).send(controller.saveScenario({
      name: body.name,
      description: body.description,
      eventIds: body.eventIds
    }));
  });

  app.delete<{ Params: ScenarioParams }>(`${scenariosRoute}/:id`, async (request, reply) => {
    const { id } = request.params;
    if (!controller.listScenarios().some((scenario) => scenario.id === id)) {
      return reply.status(404).send({ message: DASHBOARD_MESSAGES.SCENARIO_NOT_FOUND });
    }
    controller.deleteScenario(id);
    return reply.status(204).send();
  });

  app.post<{ Params: ScenarioParams }>(`${scenariosRoute}/:id/run`, async (request, reply) => {
    const scenario = controller.listScenarios().find((item) => item.id === request.params.id);
    if (!scenario) {
      return reply.status(404).send({ message: DASHBOARD_MESSAGES.SCENARIO_NOT_FOUND });
    }
    return runScenario(app, scenario);
  });
}
