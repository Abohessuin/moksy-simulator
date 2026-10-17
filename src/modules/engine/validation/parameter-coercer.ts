import { VALIDATION_MESSAGES } from '../../../common/messages.js';
import { FieldLocation, FieldType } from '../../../common/types.js';
import { ParsedRequestField } from '../../agreement/types.js';
import { ValidationErrorItem } from '../types.js';

export type CoercionOutcome<T> =
  | { success: true; value: T }
  | { success: false; error: ValidationErrorItem };

const STRICT_BOOLEAN_MAP: Record<string, boolean> = {
  true: true,
  false: false
};

/**
 * Strategy object organizing type coercion converters for scalar parameter strings.
 */
export const COERCION_STRATEGIES: Record<
  'integer' | 'number' | 'boolean' | 'string',
  (rawVal: string, fieldName: string, location: FieldLocation) => CoercionOutcome<any>
> = {
  integer: (rawVal, fieldName, location) => {
    const trimmed = rawVal.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return {
        success: false,
        error: {
          location,
          field: fieldName,
          message: VALIDATION_MESSAGES.COERCION_INTEGER_FAILED(fieldName, rawVal)
        }
      };
    }
    return { success: true, value: parseInt(trimmed, 10) };
  },

  number: (rawVal, fieldName, location) => {
    const trimmed = rawVal.trim();
    const num = Number(trimmed);
    if (trimmed === '' || Number.isNaN(num)) {
      return {
        success: false,
        error: {
          location,
          field: fieldName,
          message: VALIDATION_MESSAGES.COERCION_NUMBER_FAILED(fieldName, rawVal)
        }
      };
    }
    return { success: true, value: num };
  },

  boolean: (rawVal, fieldName, location) => {
    const lower = rawVal.trim().toLowerCase();
    const bool = STRICT_BOOLEAN_MAP[lower];
    if (bool === undefined) {
      return {
        success: false,
        error: {
          location,
          field: fieldName,
          message: VALIDATION_MESSAGES.COERCION_BOOLEAN_FAILED(fieldName, rawVal)
        }
      };
    }
    return { success: true, value: bool };
  },

  string: (rawVal) => ({ success: true, value: rawVal })
};

/**
 * Coerces a single scalar parameter string to its target declared type.
 * @param {string} rawVal - Raw string value from path or query.
 * @param {FieldType} targetType - Declared field type.
 * @param {string} fieldName - Parameter field name.
 * @param {FieldLocation} location - Parameter location ('path' | 'query').
 * @returns {CoercionOutcome<any>} Success with typed value or failure with ValidationErrorItem.
 */
export function coerceParameter(
  rawVal: string,
  targetType: FieldType,
  fieldName: string,
  location: FieldLocation
): CoercionOutcome<any> {
  const strategy = COERCION_STRATEGIES[targetType as keyof typeof COERCION_STRATEGIES];
  if (!strategy) {
    return { success: true, value: rawVal };
  }
  return strategy(rawVal, fieldName, location);
}

/**
 * Deliberately coerces path parameters from strings to declared schema types.
 * @param {Record<string, string>} rawParams - Raw path parameters extracted by router.
 * @param {any} [pathSchema] - JSON Schema for path parameters.
 * @returns {{ coerced: Record<string, any>; errors: ValidationErrorItem[] }} Coerced values and any errors.
 */
export function coercePathParameters(
  rawParams: Record<string, string>,
  pathSchema?: any
): { coerced: Record<string, any>; errors: ValidationErrorItem[] } {
  const coerced: Record<string, any> = {};
  const errors: ValidationErrorItem[] = [];

  for (const [key, rawVal] of Object.entries(rawParams)) {
    const propSchema = pathSchema?.properties?.[key];
    const targetType = (propSchema?.type || 'string') as FieldType;

    const outcome = coerceParameter(rawVal, targetType, key, 'path');
    if (outcome.success) {
      coerced[key] = outcome.value;
    } else {
      errors.push(outcome.error);
    }
  }

  return { coerced, errors };
}

/**
 * Checks for unknown query parameters not declared in the agreement.
 * @param {Record<string, any>} rawQuery - Incoming query object.
 * @param {Set<string>} declaredQueryFields - Set of allowed query field names.
 * @returns {ValidationErrorItem[]} List of errors for any unexpected query parameters.
 */
export function checkUnknownQueryParameters(
  rawQuery: Record<string, any>,
  declaredQueryFields: Set<string>
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];

  for (const queryKey of Object.keys(rawQuery)) {
    if (!declaredQueryFields.has(queryKey)) {
      errors.push({
        location: 'query',
        field: queryKey,
        message: VALIDATION_MESSAGES.UNKNOWN_QUERY_PARAM(queryKey)
      });
    }
  }

  return errors;
}

/**
 * Coerces declared query parameters, rejects unknown parameters, and injects default values.
 * @param {Record<string, string | string[]>} rawQuery - Incoming query parameters.
 * @param {any} [querySchema] - JSON Schema for query parameters.
 * @param {ParsedRequestField[]} [declaredFields] - Agreement declared request fields.
 * @returns {{ coerced: Record<string, any>; errors: ValidationErrorItem[] }} Coerced query and errors.
 */
export function coerceQueryParameters(
  rawQuery: Record<string, string | string[]>,
  querySchema?: any,
  declaredFields: ParsedRequestField[] = []
): { coerced: Record<string, any>; errors: ValidationErrorItem[] } {
  const coerced: Record<string, any> = {};
  const errors: ValidationErrorItem[] = [];

  const declaredQueryFields = new Set(
    declaredFields.filter((f) => f.location === 'query').map((f) => f.field)
  );

  // 1. Unknown query parameter rejection
  const unknownErrors = checkUnknownQueryParameters(rawQuery, declaredQueryFields);
  errors.push(...unknownErrors);

  // 2. Coerce provided query parameters
  for (const [key, rawVal] of Object.entries(rawQuery)) {
    if (!declaredQueryFields.has(key)) continue;

    const propSchema = querySchema?.properties?.[key];
    const targetType = (propSchema?.type || 'string') as FieldType;
    const strVal = Array.isArray(rawVal) ? rawVal[0] : rawVal;

    const outcome = coerceParameter(strVal, targetType, key, 'query');
    if (outcome.success) {
      coerced[key] = outcome.value;
    } else {
      errors.push(outcome.error);
    }
  }

  // 3. Inject defaults for omitted query parameters
  if (querySchema?.properties) {
    for (const [key, prop] of Object.entries<any>(querySchema.properties)) {
      if (coerced[key] === undefined && prop.default !== undefined) {
        coerced[key] = prop.default;
      }
    }
  }

  return { coerced, errors };
}
