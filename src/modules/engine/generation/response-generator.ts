import { MoksyAgreementError } from '../../../common/errors.js';
import { GENERATOR_MESSAGES } from '../../../common/messages.js';
import { NormalizedEndpoint } from '../../agreement/types.js';
import { SimulatorConfig } from '../../config/types.js';
import { defaultAjv } from '../validation/ajv-instance.js';
import { createPrng, Prng } from './prng.js';
import { generateValue } from './value-generators.js';

export interface GeneratedResponse {
  status: number;
  body?: any;
}

/**
 * Resolves the target HTTP status code to return.
 * Checks for static override in configuration responses map, falling back to endpoint successStatus.
 * @param {NormalizedEndpoint} endpoint - Normalized endpoint definition.
 * @param {SimulatorConfig} [config] - Optional simulator configuration with static responses map.
 * @returns {number} Resolved HTTP status code.
 */
export function resolveResponseStatus(
  endpoint: NormalizedEndpoint,
  config?: SimulatorConfig
): number {
  if (config?.responses) {
    const routeKey = `${endpoint.method} ${endpoint.path}`;
    const configuredStatus = config.responses[routeKey];
    if (configuredStatus !== undefined) {
      return configuredStatus;
    }
  }
  return endpoint.successStatus;
}

/**
 * Resolves the appropriate JSON Schema for the given HTTP status code.
 * Returns null if the status is 204 or defines no body.
 * @param {NormalizedEndpoint} endpoint - Normalized endpoint definition.
 * @param {number} status - Target status code.
 * @returns {any | null} Target JSON Schema or null.
 */
export function resolveResponseSchema(
  endpoint: NormalizedEndpoint,
  status: number
): any | null {
  if (status === 204 || endpoint.successBodyContentType === 'none') {
    return null;
  }

  if (status === endpoint.successStatus) {
    return endpoint.successResponseSchema || null;
  }

  const errorDef = endpoint.errorResponses[status];
  if (errorDef?.schema) {
    return errorDef.schema;
  }

  return null;
}

/**
 * Self-validates the generated dummy response payload against the agreed response schema using Ajv.
 * Guarantees zero schema drift between generator output and agreed contracts.
 * @param {any} payload - Generated dummy payload.
 * @param {any} schema - Target response JSON Schema.
 * @throws {MoksyAgreementError} If the generated payload violates the response schema.
 */
export function verifyGeneratedPayload(payload: any, schema: any): void {
  if (!schema) return;
  const validate = defaultAjv.compile(schema);
  const isValid = validate(payload);

  if (!isValid && validate.errors) {
    const errorDetails = validate.errors
      .map((e: any) => `${e.instancePath || 'root'} ${e.message}`)
      .join('; ');

    throw new MoksyAgreementError(GENERATOR_MESSAGES.UNSATISFIABLE_SCHEMA(errorDetails));
  }
}

/**
 * Generates a complete mock HTTP response (status code and conforming dummy payload).
 * Honors static configuration status overrides, 204 no-body rules, and seed reproducibility.
 * @param {NormalizedEndpoint} endpoint - Normalized endpoint definition.
 * @param {SimulatorConfig} [config] - Optional simulator configuration.
 * @param {Prng} [prng] - Optional seeded PRNG instance.
 * @returns {GeneratedResponse} Target HTTP status and validated dummy response body.
 */
export function generateResponse(
  endpoint: NormalizedEndpoint,
  config?: SimulatorConfig,
  prng?: Prng
): GeneratedResponse {
  const status = resolveResponseStatus(endpoint, config);

  if (status === 204) {
    return { status: 204 };
  }

  const schema = resolveResponseSchema(endpoint, status);
  if (!schema) {
    return { status };
  }

  const effectivePrng = prng || createPrng(config?.seed);
  const body = generateValue(schema, effectivePrng, 0, { maxDepth: 5 });

  // Self-validate generated body before returning
  verifyGeneratedPayload(body, schema);

  return {
    status,
    body
  };
}
