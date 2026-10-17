import { VALIDATION_MESSAGES } from '../../../common/messages.js';
import { FieldLocation } from '../../../common/types.js';
import { ValidationErrorItem } from '../types.js';

/**
 * Strategy object organizing message formatters for Ajv error keywords.
 */
export const AJV_KEYWORD_MESSAGE_BUILDERS: Record<string, (err: any) => string> = {
  required: (err) => `Field "${err.params?.missingProperty}" is required`,
  additionalProperties: (err) => `Unknown property "${err.params?.additionalProperty}" is not allowed`,
  minimum: (err) => `must be >= ${err.params?.limit}`,
  maximum: (err) => `must be <= ${err.params?.limit}`,
  minLength: (err) => `must be at least ${err.params?.limit} characters long`,
  maxLength: (err) => `must not exceed ${err.params?.limit} characters`,
  minItems: (err) => `must contain at least ${err.params?.limit} items`,
  maxItems: (err) => `must not contain more than ${err.params?.limit} items`,
  enum: (err) => `must be one of: [${err.params?.allowedValues?.join(', ')}]`,
  pattern: (err) => `must match pattern ${err.params?.pattern}`,
  type: (err) => `expected type "${err.params?.type}"`
};

/**
 * Extracts a normalized field path from an Ajv error object.
 * @param {any} err - Raw Ajv error object.
 * @returns {string} Normalized field path (e.g. "data[0].id" or "name").
 * @example
 * // Input:
 * extractFieldFromAjvError({ instancePath: "/dimensions/width", keyword: "minimum" });
 * // Expected Output: "dimensions.width"
 */
export function extractFieldFromAjvError(err: any): string {
  if (err.keyword === 'required' && err.params?.missingProperty) {
    const parent = err.instancePath ? err.instancePath.slice(1).replace(/\//g, '.') : '';
    return parent ? `${parent}.${err.params.missingProperty}` : err.params.missingProperty;
  }

  if (err.keyword === 'additionalProperties' && err.params?.additionalProperty) {
    const parent = err.instancePath ? err.instancePath.slice(1).replace(/\//g, '.') : '';
    return parent ? `${parent}.${err.params.additionalProperty}` : err.params.additionalProperty;
  }

  if (err.instancePath) {
    return err.instancePath
      .slice(1)
      .replace(/\/(\d+)/g, '[$1]')
      .replace(/\//g, '.');
  }

  return 'root';
}

/**
 * Converts raw Ajv error objects into structured ValidationErrorItem records.
 * @param {any[]} [ajvErrors] - Array of Ajv validation errors.
 * @param {FieldLocation} location - Request location ('path' | 'query' | 'header' | 'body').
 * @returns {ValidationErrorItem[]} List of formatted validation error items.
 */
export function convertAjvErrorsToValidationItems(
  ajvErrors: any[] | null | undefined,
  location: FieldLocation
): ValidationErrorItem[] {
  if (!ajvErrors || ajvErrors.length === 0) return [];

  return ajvErrors.map((err) => {
    const field = extractFieldFromAjvError(err);
    const builder = AJV_KEYWORD_MESSAGE_BUILDERS[err.keyword];
    const message = builder ? builder(err) : err.message || 'validation failed';

    return {
      location,
      field,
      message
    };
  });
}

/**
 * Formats a list of validation error items into the agreed HTTP error response payload.
 * Conforms to the endpoint's configured 400 response structure.
 * @param {ValidationErrorItem[]} errors - List of field validation errors.
 * @param {any} [agreed400Schema] - Optional agreed error response schema.
 * @returns {Record<string, any>} Formatted error response body.
 * @example
 * // Input:
 * formatValidationResponse([{ location: "query", field: "page", message: "must be >= 1" }]);
 * // Expected Output:
 * // {
 * //   message: "Request validation failed",
 * //   errors: [{ location: "query", field: "page", message: "must be >= 1" }]
 * // }
 */
export function formatValidationResponse(
  errors: ValidationErrorItem[],
  agreed400Schema?: any
): Record<string, any> {
  const basePayload: Record<string, any> = {
    message: VALIDATION_MESSAGES.VALIDATION_FAILED,
    errors
  };

  // If agreed error schema does not define an "errors" array, return just message
  if (agreed400Schema?.properties && !agreed400Schema.properties.errors) {
    return {
      message: `${VALIDATION_MESSAGES.VALIDATION_FAILED}: ${errors.map((e) => `${e.field} (${e.message})`).join(', ')}`
    };
  }

  return basePayload;
}
