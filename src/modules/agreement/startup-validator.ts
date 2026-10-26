import { MoksyAgreementError, MoksyConfigError } from '../../common/errors.js';
import { AGREEMENT_MESSAGES, CONFIG_MESSAGES } from '../../common/messages.js';
import { SimulatorConfig } from '../config/types.js';
import { NormalizedAgreement, NormalizedEndpoint } from './types.js';
import { validateStatefulCollections } from './stateful-validator.js';

/**
 * Validates that there are no duplicate operations across the agreement.
 * @param {NormalizedEndpoint[]} endpoints - List of parsed endpoints.
 * @param {string} [filePath] - Source file path for error context.
 * @throws {MoksyAgreementError} If two endpoints share the same method and path.
 */
export function validateNoDuplicateOperations(
  endpoints: NormalizedEndpoint[],
  filePath?: string
): void {
  const seenOperations = new Set<string>();
  for (const ep of endpoints) {
    const opKey = `${ep.method} ${ep.path}`;
    if (seenOperations.has(opKey)) {
      throw new MoksyAgreementError(AGREEMENT_MESSAGES.DUPLICATE_OPERATION(opKey), {
        filePath,
        endpoint: opKey
      });
    }
    seenOperations.add(opKey);
  }
}

/**
 * Validates path parameters between the URL path and the Request Fields table.
 * @param {NormalizedEndpoint} ep - The endpoint to validate.
 * @param {string} [filePath] - Source file path for error context.
 * @throws {MoksyAgreementError} If path parameters are missing, mismatched, or optional.
 */
export function validatePathParameters(ep: NormalizedEndpoint, filePath?: string): void {
  const opKey = `${ep.method} ${ep.path}`;
  const ctx = { filePath, endpoint: opKey, section: 'Request fields' };

  const declaredPathFields = ep.requestFields.filter((f) => f.location === 'path');
  const declaredPathFieldNames = new Set(declaredPathFields.map((f) => f.field));

  for (const paramName of ep.pathParamNames) {
    if (!declaredPathFieldNames.has(paramName)) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.MISSING_PATH_PARAM_IN_TABLE(paramName, ep.path),
        ctx
      );
    }
  }

  for (const pathField of declaredPathFields) {
    if (!ep.pathParamNames.includes(pathField.field)) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.UNDECLARED_PATH_PARAM(pathField.field, ep.path),
        { ...ctx, field: pathField.field }
      );
    }
    if (!pathField.required) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.PATH_PARAM_MUST_BE_REQUIRED(pathField.field),
        { ...ctx, field: pathField.field }
      );
    }
  }
}

/**
 * Validates that status 204 responses do not declare a response body.
 * @param {NormalizedEndpoint} ep - The endpoint to validate.
 * @param {string} [filePath] - Source file path for error context.
 * @throws {MoksyAgreementError} If a 204 response has a declared body or schema.
 */
export function validateNoBodyFor204(ep: NormalizedEndpoint, filePath?: string): void {
  if (ep.successStatus === 204) {
    if (ep.successBodyContentType !== 'none' || ep.successResponseSchema) {
      throw new MoksyAgreementError(AGREEMENT_MESSAGES.NO_BODY_204, {
        filePath,
        endpoint: `${ep.method} ${ep.path}`,
        section: 'Success response fields'
      });
    }
  }
}

/**
 * Validates that an endpoint has at least one error response triggered by validation failures.
 * @param {NormalizedEndpoint} ep - The endpoint to validate.
 * @param {string} [filePath] - Source file path for error context.
 * @throws {MoksyAgreementError} If no validation error response trigger is defined.
 */
export function validateValidationErrorTrigger(ep: NormalizedEndpoint, filePath?: string): void {
  const hasValidationTrigger = Object.values(ep.errorResponses).some(
    (err) => err.trigger === 'validation'
  );
  if (!hasValidationTrigger) {
    throw new MoksyAgreementError(AGREEMENT_MESSAGES.MISSING_VALIDATION_TRIGGER, {
      filePath,
      endpoint: `${ep.method} ${ep.path}`,
      section: 'Error responses'
    });
  }
}

/**
 * Validates statically selected statuses in the configuration against the loaded agreement.
 * @param {NormalizedAgreement} agreement - The normalized agreement containing all endpoints.
 * @param {SimulatorConfig} config - The simulator configuration.
 * @throws {MoksyConfigError} If a route or selected status does not exist in the agreement.
 */
export function validateConfiguredResponses(
  agreement: NormalizedAgreement,
  config: SimulatorConfig
): void {
  const endpointMap = new Map<string, NormalizedEndpoint>();
  for (const ep of agreement.endpoints) {
    endpointMap.set(`${ep.method} ${ep.path}`, ep);
  }

  for (const [routeKey, selectedStatus] of Object.entries(config.responses)) {
    const ep = endpointMap.get(routeKey);
    if (!ep) {
      throw new MoksyConfigError(
        CONFIG_MESSAGES.ROUTE_NOT_IN_AGREEMENT(routeKey),
        config.agreementPath
      );
    }

    const isSuccess = ep.successStatus === selectedStatus;
    const isError = ep.errorResponses[selectedStatus] !== undefined;

    if (!isSuccess && !isError) {
      const available = [ep.successStatus, ...Object.keys(ep.errorResponses)].join(', ');
      throw new MoksyConfigError(
        CONFIG_MESSAGES.SELECTED_STATUS_NOT_IN_AGREEMENT(selectedStatus, routeKey, available),
        config.agreementPath
      );
    }
  }
}

/**
 * Master startup validator enforcing all startup invariants across agreement and configuration.
 * @param {NormalizedAgreement} agreement - Normalized API agreement.
 * @param {SimulatorConfig} [config] - Optional simulator configuration.
 * @throws {MoksyAgreementError | MoksyConfigError} When any startup check fails.
 */
export function validateStartup(
  agreement: NormalizedAgreement,
  config?: SimulatorConfig
): void {
  const filePath = agreement.filePath;

  validateNoDuplicateOperations(agreement.endpoints, filePath);

  for (const ep of agreement.endpoints) {
    validatePathParameters(ep, filePath);
    validateNoBodyFor204(ep, filePath);
    validateValidationErrorTrigger(ep, filePath);
  }

  validateStatefulCollections(agreement.endpoints, filePath);

  if (config && config.responses) {
    validateConfiguredResponses(agreement, config);
  }
}
