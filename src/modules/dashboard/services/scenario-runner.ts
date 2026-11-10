import type { FastifyInstance, InjectOptions } from 'fastify';
import type { DashboardScenario, ScenarioRunStep } from '../types/index.js';

/**
 * Converts a saved JSON value to a payload accepted by Fastify injection.
 *
 * @param body - The stored request body.
 * @returns A Fastify-compatible payload, or `undefined` when no body was stored.
 */
function replayPayload(body: unknown): InjectOptions['payload'] {
  if (body === undefined) return undefined;
  if (typeof body === 'string' || (body !== null && typeof body === 'object')) return body;
  return JSON.stringify(body);
}

/**
 * Parses a JSON response while preserving non-JSON payloads for inspection.
 *
 * @param payload - The raw Fastify response payload.
 * @returns The parsed JSON value, original text, or `undefined` for an empty payload.
 */
function readResponseBody(payload: string): unknown {
  if (!payload) return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

/**
 * Replays saved requests in order through mock routes without recording them again.
 *
 * @param app - The Fastify server used to inject each saved request.
 * @param scenario - The saved scenario to replay.
 * @returns The pass/fail totals and result of every replayed step.
 */
export async function runScenario(app: FastifyInstance, scenario: DashboardScenario) {
  const steps: ScenarioRunStep[] = [];

  for (const step of scenario.steps) {
    const response = await app.inject({
      method: step.method as InjectOptions['method'],
      url: step.url,
      headers: { ...step.headers, 'x-moksy-runner': '1' },
      payload: replayPayload(step.body)
    });
    steps.push({
      id: step.id,
      method: step.method,
      url: step.url,
      expectedStatus: step.expectedStatus,
      actualStatus: response.statusCode,
      passed: response.statusCode === step.expectedStatus,
      responseBody: readResponseBody(response.payload)
    });
  }

  const passed = steps.filter((step) => step.passed).length;
  return { passed, failed: steps.length - passed, steps };
}
