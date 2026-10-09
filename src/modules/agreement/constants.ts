import { AuthType, BodyContentType, FieldLocation, FieldType, HttpMethod } from '../../common/types.js';

/**
 * Mapping of supported HTTP methods in uppercase.
 */
export const HTTP_METHOD_MAP: Record<string, HttpMethod> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

/**
 * Mapping of raw authentication strings to normalized AuthType.
 */
export const AUTH_NORMALIZATION_MAP: Record<string, AuthType> = {
  none: 'none',
  '-': 'none',
  bearer: 'bearer',
  required: 'required'
};

/**
 * Mapping of raw request body format strings to BodyContentType.
 */
export const REQUEST_BODY_MAP: Record<string, BodyContentType> = {
  json: 'json',
  'application/json': 'json',
  none: 'none',
  '-': 'none'
};

/**
 * Mapping of raw success response body format strings to BodyContentType.
 */
export const SUCCESS_BODY_MAP: Record<string, BodyContentType> = {
  json: 'json',
  'application/json': 'json',
  none: 'none',
  '-': 'none'
};

/**
 * Mapping of raw location strings to valid FieldLocation.
 */
export const LOCATION_MAP: Record<string, FieldLocation> = {
  path: 'path',
  query: 'query',
  header: 'header',
  body: 'body'
};

/**
 * Mapping of raw type strings to supported FieldType.
 */
export const TYPE_MAP: Record<string, FieldType> = {
  string: 'string',
  integer: 'integer',
  number: 'number',
  boolean: 'boolean',
  object: 'object',
  array: 'array'
};

/**
 * Mapping of raw truthy/falsy cell values to booleans.
 */
export const BOOLEAN_VALUE_MAP: Record<string, boolean> = {
  yes: true,
  true: true,
  no: false,
  false: false
};

/**
 * Mandatory column headers for Request Fields table.
 */
export const REQUEST_FIELDS_COLUMNS = ['field', 'location', 'type', 'required'] as const;

/**
 * Mandatory column headers for Success Response Fields table.
 */
export const SUCCESS_RESPONSE_COLUMNS = ['field', 'type', 'required'] as const;

/**
 * Mandatory column headers for Error Responses table.
 */
export const ERROR_RESPONSES_COLUMNS = ['status', 'trigger', 'field', 'type'] as const;

/**
 * Optional column headers recognized across tables.
 */
export const OPTIONAL_TABLE_COLUMNS = ['nullable', 'rules', 'default'] as const;
