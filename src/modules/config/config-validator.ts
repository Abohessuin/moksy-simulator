import { MoksyConfigError } from '../../common/errors.js';
import { CONFIG_MESSAGES } from '../../common/messages.js';
import { RawSimulatorConfig, SimulatorConfig } from './types.js';

const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validates the root configuration input to ensure it is a plain object.
 * @param {unknown} raw - The raw configuration value to test.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @throws {MoksyConfigError} If raw is null, not an object, or an array.
 * @example
 * // Valid Input:
 * validateRootObject({ port: 3000, agreementPath: 'api.docx' });
 * // Result: passes assertion without throwing.
 *
 * @example
 * // Invalid Input:
 * validateRootObject(null);
 * // Throws: MoksyConfigError: Configuration must be a JSON object
 */
export function validateRootObject(raw: unknown, sourceFile?: string): asserts raw is Record<string, unknown> {
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  if (!isObject) {
    throw new MoksyConfigError(CONFIG_MESSAGES.NOT_AN_OBJECT, sourceFile);
  }
}

/**
 * Validates and normalizes the host address.
 * @param {unknown} hostVal - The host setting value.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {string} The trimmed host string, or default '127.0.0.1'.
 * @throws {MoksyConfigError} If host is explicitly set to an empty string.
 * @example
 * // Input:
 * validateHost("0.0.0.0");
 * // Expected Output: "0.0.0.0"
 *
 * @example
 * // Default fallback:
 * validateHost(undefined);
 * // Expected Output: "127.0.0.1"
 *
 * @example
 * // Invalid Input:
 * validateHost("   ");
 * // Throws: MoksyConfigError: Config property "host" cannot be empty
 */
export function validateHost(hostVal: unknown, sourceFile?: string): string {
  if (hostVal === undefined) return '127.0.0.1';
  const trimmed = String(hostVal).trim();
  if (!trimmed) {
    throw new MoksyConfigError(CONFIG_MESSAGES.HOST_EMPTY, sourceFile);
  }
  return trimmed;
}

/**
 * Validates the simulator port number.
 * @param {unknown} portVal - The candidate port value.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {number} Validated integer port between 1 and 65535, or default 4500.
 * @throws {MoksyConfigError} If port is not an integer or out of bounds.
 * @example
 * // Input:
 * validatePort(8080);
 * // Expected Output: 8080
 *
 * @example
 * // Default fallback:
 * validatePort(undefined);
 * // Expected Output: 4500
 *
 * @example
 * // Invalid Input:
 * validatePort(70000);
 * // Throws: MoksyConfigError: Config property "port" must be an integer between 1 and 65535
 */
export function validatePort(portVal: unknown, sourceFile?: string): number {
  if (portVal === undefined) return 4500;
  const isInteger = typeof portVal === 'number' && Number.isInteger(portVal);
  const isInRange = isInteger && portVal >= 1 && portVal <= 65535;

  if (!isInRange) {
    throw new MoksyConfigError(CONFIG_MESSAGES.PORT_INVALID(portVal), sourceFile);
  }
  return portVal;
}

/**
 * Validates and normalizes the API base path prefix.
 * @param {unknown} basePathVal - The candidate base path.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {string} Normalized base path (e.g. '/api' or empty string).
 * @throws {MoksyConfigError} If basePath is not a string.
 * @example
 * // Input:
 * validateBasePath("api/v1/");
 * // Expected Output: "/api/v1"
 *
 * @example
 * // Empty or slash root:
 * validateBasePath("/");
 * // Expected Output: ""
 */
export function validateBasePath(basePathVal: unknown, sourceFile?: string): string {
  if (basePathVal === undefined) return '';
  if (typeof basePathVal !== 'string') {
    throw new MoksyConfigError(CONFIG_MESSAGES.BASE_PATH_INVALID, sourceFile);
  }
  const trimmed = basePathVal.trim();
  if (!trimmed || trimmed === '/') return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

/**
 * Validates the allowed CORS origins list.
 * @param {unknown} originsVal - The candidate allowed origins array.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {string[]} Validated list of non-empty origin strings.
 * @throws {MoksyConfigError} If originsVal is not an array of non-empty strings.
 * @example
 * // Input:
 * validateAllowedOrigins(["http://localhost:3000", "https://app.dev"]);
 * // Expected Output: ["http://localhost:3000", "https://app.dev"]
 *
 * @example
 * // Default fallback:
 * validateAllowedOrigins(undefined);
 * // Expected Output: ["*"]
 */
export function validateAllowedOrigins(originsVal: unknown, sourceFile?: string): string[] {
  if (originsVal === undefined) return ['*'];
  const isValidArray =
    Array.isArray(originsVal) &&
    originsVal.every((o) => typeof o === 'string' && o.trim().length > 0);

  if (!isValidArray) {
    throw new MoksyConfigError(CONFIG_MESSAGES.ALLOWED_ORIGINS_INVALID, sourceFile);
  }
  return originsVal.map((o) => o.trim());
}

/**
 * Validates the PRNG random seed.
 * @param {unknown} seedVal - The candidate random seed integer.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {number | undefined} Integer seed value or undefined.
 * @throws {MoksyConfigError} If seed is provided but not an integer.
 * @example
 * // Input:
 * validateSeed(42);
 * // Expected Output: 42
 *
 * @example
 * // Optional undefined:
 * validateSeed(undefined);
 * // Expected Output: undefined
 *
 * @example
 * // Invalid Input:
 * validateSeed(3.14);
 * // Throws: MoksyConfigError: Config property "seed" must be an integer
 */
export function validateSeed(seedVal: unknown, sourceFile?: string): number | undefined {
  if (seedVal === undefined) return undefined;
  const isInteger = typeof seedVal === 'number' && Number.isInteger(seedVal);
  if (!isInteger) {
    throw new MoksyConfigError(CONFIG_MESSAGES.SEED_INVALID(seedVal), sourceFile);
  }
  return seedVal;
}

/**
 * Validates the path to the API agreement file.
 * @param {unknown} pathVal - The candidate agreement path.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {string} Trimmed agreement path.
 * @throws {MoksyConfigError} If agreementPath is missing or not a non-empty string.
 * @example
 * // Input:
 * validateAgreementPath("./templates/API_Agreement.docx");
 * // Expected Output: "./templates/API_Agreement.docx"
 *
 * @example
 * // Invalid Input:
 * validateAgreementPath("");
 * // Throws: MoksyConfigError: Config property "agreementPath" is required
 */
export function validateAgreementPath(pathVal: unknown, sourceFile?: string): string {
  const isNonEmptyString = typeof pathVal === 'string' && pathVal.trim().length > 0;
  if (!isNonEmptyString) {
    throw new MoksyConfigError(CONFIG_MESSAGES.AGREEMENT_PATH_REQUIRED, sourceFile);
  }
  return (pathVal as string).trim();
}

/**
 * Validates an individual key-value entry in the responses map.
 * @param {string} key - Response key in the format "METHOD /path".
 * @param {unknown} status - HTTP status code integer.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {[string, number]} Normalized tuple of [normalizedKey, statusCode].
 * @throws {MoksyConfigError} If the key format, method, path, or status code is invalid.
 * @example
 * // Input:
 * validateResponseEntry("get /products", 200);
 * // Expected Output: ["GET /products", 200]
 *
 * @example
 * // Input:
 * validateResponseEntry("POST /categories/{id}/products", 201);
 * // Expected Output: ["POST /categories/{id}/products", 201]
 *
 * @example
 * // Invalid Input:
 * validateResponseEntry("INVALID_FORMAT", 200);
 * // Throws: MoksyConfigError: Invalid response key "INVALID_FORMAT". Expected format: "METHOD /path"
 */
export function validateResponseEntry(
  key: string,
  status: unknown,
  sourceFile?: string
): [string, number] {
  const parts = key.trim().split(/\s+/);
  if (parts.length !== 2) {
    throw new MoksyConfigError(CONFIG_MESSAGES.RESPONSE_KEY_INVALID(key), sourceFile);
  }

  const [method, path] = parts;
  const upperMethod = method.toUpperCase();

  if (!VALID_HTTP_METHODS.has(upperMethod)) {
    throw new MoksyConfigError(
      CONFIG_MESSAGES.RESPONSE_METHOD_UNSUPPORTED(method, [...VALID_HTTP_METHODS].join(', ')),
      sourceFile
    );
  }

  if (!path.startsWith('/')) {
    throw new MoksyConfigError(CONFIG_MESSAGES.RESPONSE_PATH_INVALID(path), sourceFile);
  }

  const isStatusValid =
    typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599;

  if (!isStatusValid) {
    throw new MoksyConfigError(CONFIG_MESSAGES.RESPONSE_STATUS_INVALID(status, key), sourceFile);
  }

  return [`${upperMethod} ${path}`, status];
}

/**
 * Validates the dictionary mapping endpoints to static response status codes.
 * @param {unknown} responsesVal - The candidate responses object.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {Record<string, number>} Normalized responses dictionary.
 * @throws {MoksyConfigError} If responses is not an object or contains invalid entries.
 * @example
 * // Input:
 * const rawResponses = { "get /products": 200, "post /products": 201 };
 * validateResponses(rawResponses);
 * // Expected Output:
 * // { "GET /products": 200, "POST /products": 201 }
 */
export function validateResponses(
  responsesVal: unknown,
  sourceFile?: string
): Record<string, number> {
  if (responsesVal === undefined) return {};

  const isObject =
    typeof responsesVal === 'object' && responsesVal !== null && !Array.isArray(responsesVal);
  if (!isObject) {
    throw new MoksyConfigError(CONFIG_MESSAGES.RESPONSES_NOT_OBJECT, sourceFile);
  }

  const normalized: Record<string, number> = {};
  for (const [key, status] of Object.entries(responsesVal as Record<string, unknown>)) {
    const [normalizedKey, normalizedStatus] = validateResponseEntry(key, status, sourceFile);
    normalized[normalizedKey] = normalizedStatus;
  }

  return normalized;
}

/**
 * Strategy object organizing validators for each configuration property.
 */
export const CONFIG_VALIDATOR_STRATEGY = {
  host: validateHost,
  port: validatePort,
  basePath: validateBasePath,
  allowedOrigins: validateAllowedOrigins,
  seed: validateSeed,
  agreementPath: validateAgreementPath,
  responses: validateResponses
} as const;

/**
 * Validates and normalizes raw simulator configuration.
 * @param {RawSimulatorConfig} raw - The raw configuration object to validate.
 * @param {string} [sourceFile] - Optional file path for error context.
 * @returns {SimulatorConfig} The normalized, strictly validated simulator configuration.
 * @throws {MoksyConfigError} When any configuration property violates schema constraints.
 * @example
 * // Input:
 * const raw = {
 *   port: 4500,
 *   agreementPath: "./api-agreement.docx",
 *   responses: { "get /products": 200 }
 * };
 * // Expected Output:
 * validateConfig(raw);
 * // Returns:
 * // {
 * //   host: "127.0.0.1",
 * //   port: 4500,
 * //   basePath: "",
 * //   allowedOrigins: ["*"],
 * //   seed: undefined,
 * //   agreementPath: "./api-agreement.docx",
 * //   responses: { "GET /products": 200 }
 * // }
 */
export function validateConfig(raw: RawSimulatorConfig, sourceFile?: string): SimulatorConfig {
  validateRootObject(raw, sourceFile);

  return {
    host: CONFIG_VALIDATOR_STRATEGY.host(raw.host, sourceFile),
    port: CONFIG_VALIDATOR_STRATEGY.port(raw.port, sourceFile),
    basePath: CONFIG_VALIDATOR_STRATEGY.basePath(raw.basePath, sourceFile),
    allowedOrigins: CONFIG_VALIDATOR_STRATEGY.allowedOrigins(raw.allowedOrigins, sourceFile),
    seed: CONFIG_VALIDATOR_STRATEGY.seed(raw.seed, sourceFile),
    agreementPath: CONFIG_VALIDATOR_STRATEGY.agreementPath(raw.agreementPath, sourceFile),
    responses: CONFIG_VALIDATOR_STRATEGY.responses(raw.responses, sourceFile)
  };
}
