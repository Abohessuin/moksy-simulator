import { VALIDATION_MESSAGES } from '../../../common/messages.js';
import { AuthType, BodyContentType } from '../../../common/types.js';
import { NormalizedEndpoint } from '../../agreement/types.js';
import { HTTP_STATUS, SUPPORTED_CONTENT_TYPES } from '../constants.js';
import { CoercedRequest, EngineRequest, ValidationErrorItem, ValidationResult } from '../types.js';
import { defaultAjv } from './ajv-instance.js';
import { convertAjvErrorsToValidationItems, formatValidationResponse } from './error-formatter.js';
import { coercePathParameters, coerceQueryParameters } from './parameter-coercer.js';

/**
 * Looks up a header value case-insensitively.
 * @param {Record<string, string | string[] | undefined>} headers - Headers dictionary.
 * @param {string} targetHeader - Header name to find (e.g. "authorization").
 * @returns {string | undefined} Trimmed header string value or undefined.
 */
export function getHeaderCaseInsensitive(
  headers: Record<string, string | string[] | undefined>,
  targetHeader: string
): string | undefined {
  const targetLower = targetHeader.toLowerCase();
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === targetLower) {
      if (Array.isArray(val)) return val[0]?.trim();
      return val?.trim();
    }
  }
  return undefined;
}

/**
 * Validates request authentication structure (presence and Bearer prefix syntax).
 * @param {Record<string, string | string[] | undefined>} headers - Incoming headers.
 * @param {AuthType} authType - Required authentication type ('none' | 'bearer' | 'required').
 * @returns {ValidationResult | null} Error result if invalid, or null if valid.
 */
export function validateAuthentication(
  headers: Record<string, string | string[] | undefined>,
  authType: AuthType
): ValidationResult | null {
  if (authType === 'none') return null;

  const authHeader = getHeaderCaseInsensitive(headers, 'authorization');

  if (!authHeader) {
    const errorItem: ValidationErrorItem = {
      location: 'header',
      field: 'authorization',
      message: VALIDATION_MESSAGES.MISSING_AUTH_HEADER
    };
    return {
      isValid: false,
      status: HTTP_STATUS.UNAUTHORIZED,
      errorPayload: { message: VALIDATION_MESSAGES.MISSING_AUTH_HEADER },
      errors: [errorItem]
    };
  }

  if (authType === 'bearer') {
    const isBearer = /^bearer\s+\S+/i.test(authHeader);
    if (!isBearer) {
      const errorItem: ValidationErrorItem = {
        location: 'header',
        field: 'authorization',
        message: VALIDATION_MESSAGES.INVALID_BEARER_TOKEN
      };
      return {
        isValid: false,
        status: HTTP_STATUS.UNAUTHORIZED,
        errorPayload: { message: VALIDATION_MESSAGES.INVALID_BEARER_TOKEN },
        errors: [errorItem]
      };
    }
  }

  return null;
}

/**
 * Validates the Content-Type header when a JSON request body is expected.
 * @param {Record<string, string | string[] | undefined>} headers - Incoming headers.
 * @param {BodyContentType} bodyType - Expected body content type ('json' | 'none').
 * @returns {ValidationResult | null} Error result if invalid, or null if valid.
 */
export function validateContentType(
  headers: Record<string, string | string[] | undefined>,
  bodyType: BodyContentType
): ValidationResult | null {
  if (bodyType !== 'json') return null;

  const contentType = getHeaderCaseInsensitive(headers, 'content-type');

  if (!contentType) {
    const errorItem: ValidationErrorItem = {
      location: 'header',
      field: 'content-type',
      message: VALIDATION_MESSAGES.MISSING_CONTENT_TYPE
    };
    return {
      isValid: false,
      status: HTTP_STATUS.BAD_REQUEST,
      errorPayload: { message: VALIDATION_MESSAGES.MISSING_CONTENT_TYPE },
      errors: [errorItem]
    };
  }

  const isSupported = SUPPORTED_CONTENT_TYPES.some((mime) =>
    contentType.toLowerCase().includes(mime)
  );

  if (!isSupported) {
    const errorItem: ValidationErrorItem = {
      location: 'header',
      field: 'content-type',
      message: VALIDATION_MESSAGES.UNSUPPORTED_MEDIA_TYPE(contentType)
    };
    return {
      isValid: false,
      status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      errorPayload: { message: VALIDATION_MESSAGES.UNSUPPORTED_MEDIA_TYPE(contentType) },
      errors: [errorItem]
    };
  }

  return null;
}

/**
 * Validates an object against an Ajv schema and extracts structured errors.
 * @param {any} schema - JSON Schema to validate against.
 * @param {any} data - Data object to validate.
 * @param {'path' | 'query' | 'header' | 'body'} location - Location name for error reports.
 * @returns {ValidationErrorItem[]} List of validation error items.
 */
export function validateWithAjv(
  schema: any,
  data: any,
  location: 'path' | 'query' | 'header' | 'body'
): ValidationErrorItem[] {
  if (!schema) return [];
  const validate = defaultAjv.compile(schema);
  const isValid = validate(data);
  return isValid ? [] : convertAjvErrorsToValidationItems(validate.errors, location);
}

/**
 * Normalizes headers into a lowercase dictionary for schema validation.
 * @param {Record<string, string | string[] | undefined>} headers - Raw headers.
 * @returns {Record<string, string | undefined>} Lowercase headers map.
 */
export function normalizeHeadersToLowercase(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = Array.isArray(val) ? val[0] : val;
  }
  return normalized;
}

/**
 * Validates an incoming HTTP request against an agreed endpoint definition.
 * Executes deliberate parameter coercion, authentication checking, unknown field rejection,
 * and Ajv schema validation for path, query, headers, and request body.
 * @param {EngineRequest} request - Protocol-agnostic incoming HTTP request.
 * @param {NormalizedEndpoint} endpoint - Normalized endpoint schema definition.
 * @returns {ValidationResult} Validated coerced request or formatted HTTP error payload.
 */
export function validateRequest(
  request: EngineRequest,
  endpoint: NormalizedEndpoint
): ValidationResult {
  const agreed400Schema = endpoint.errorResponses[HTTP_STATUS.BAD_REQUEST]?.schema;

  // Step 1: Content-Type validation
  const contentTypeFailure = validateContentType(request.headers, endpoint.requestBodyContentType);
  if (contentTypeFailure) return contentTypeFailure;

  // Step 2: Authentication validation
  const authFailure = validateAuthentication(request.headers, endpoint.authentication);
  if (authFailure) return authFailure;

  const collectedErrors: ValidationErrorItem[] = [];

  // Step 3: Path parameter deliberate coercion and validation
  const { coerced: coercedParams, errors: pathCoercionErrors } = coercePathParameters(
    request.params,
    endpoint.pathSchema
  );
  collectedErrors.push(...pathCoercionErrors);

  if (endpoint.pathSchema && pathCoercionErrors.length === 0) {
    const pathAjvErrors = validateWithAjv(endpoint.pathSchema, coercedParams, 'path');
    collectedErrors.push(...pathAjvErrors);
  }

  // Step 4: Query parameter deliberate coercion, default injection, and unknown field checks
  const { coerced: coercedQuery, errors: queryCoercionErrors } = coerceQueryParameters(
    request.query,
    endpoint.querySchema,
    endpoint.requestFields
  );
  collectedErrors.push(...queryCoercionErrors);

  if (endpoint.querySchema && queryCoercionErrors.length === 0) {
    const queryAjvErrors = validateWithAjv(endpoint.querySchema, coercedQuery, 'query');
    collectedErrors.push(...queryAjvErrors);
  }

  // Step 5: Header validation for declared agreement headers
  const normalizedHeaders = normalizeHeadersToLowercase(request.headers);
  if (endpoint.headerSchema) {
    const headerAjvErrors = validateWithAjv(endpoint.headerSchema, normalizedHeaders, 'header');
    collectedErrors.push(...headerAjvErrors);
  }

  // Step 6: Strict JSON body validation (Zero implicit coercion!)
  let validatedBody = request.body;
  if (endpoint.requestBodyContentType === 'json' && endpoint.bodySchema) {
    const bodyAjvErrors = validateWithAjv(endpoint.bodySchema, request.body, 'body');
    collectedErrors.push(...bodyAjvErrors);
  }

  // If any validation error was encountered across any location, return 400 Bad Request
  if (collectedErrors.length > 0) {
    return {
      isValid: false,
      status: HTTP_STATUS.BAD_REQUEST,
      errorPayload: formatValidationResponse(collectedErrors, agreed400Schema),
      errors: collectedErrors
    };
  }

  // All checks passed: return sanitized, typed, coerced request
  const coercedRequest: CoercedRequest = {
    params: coercedParams,
    query: coercedQuery,
    headers: normalizedHeaders,
    body: validatedBody
  };

  return {
    isValid: true,
    coercedRequest
  };
}
