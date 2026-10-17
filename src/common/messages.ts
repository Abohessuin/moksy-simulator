/**
 * Centralized error and diagnostic messages used across Moksy modules.
 */
export const CONFIG_MESSAGES = {
  NOT_AN_OBJECT: 'Configuration must be a JSON object',
  HOST_EMPTY: 'Config property "host" cannot be empty',
  PORT_INVALID: (val: unknown) =>
    `Config property "port" must be an integer between 1 and 65535 (received: ${JSON.stringify(val)})`,
  BASE_PATH_INVALID: 'Config property "basePath" must be a string',
  ALLOWED_ORIGINS_INVALID: 'Config property "allowedOrigins" must be an array of non-empty strings',
  SEED_INVALID: (val: unknown) =>
    `Config property "seed" must be an integer (received: ${JSON.stringify(val)})`,
  AGREEMENT_PATH_REQUIRED:
    'Config property "agreementPath" is required and must be a non-empty string path to a .docx file',
  RESPONSES_NOT_OBJECT: 'Config property "responses" must be an object mapping "METHOD /path" to HTTP status codes',
  RESPONSE_KEY_INVALID: (key: string) =>
    `Invalid response key "${key}". Expected format: "METHOD /path" (e.g., "GET /products")`,
  RESPONSE_METHOD_UNSUPPORTED: (method: string, supported: string) =>
    `Invalid HTTP method "${method}" in response key. Supported: ${supported}`,
  RESPONSE_PATH_INVALID: (path: string) =>
    `Invalid path "${path}". Paths must begin with "/"`,
  RESPONSE_STATUS_INVALID: (status: unknown, key: string) =>
    `Invalid HTTP status code ${JSON.stringify(status)} for response "${key}". Must be an integer between 100 and 599`,
  FILE_NOT_FOUND: (path: string) => `Config file not found: ${path}`,
  MALFORMED_JSON: (msg: string) => `Malformed JSON: ${msg}`,
  READ_FAILED: (msg: string) => `Failed to read configuration: ${msg}`,
  AGREEMENT_NOT_FOUND: (path: string) => `API agreement file not found at: ${path}`,
  SELECTED_STATUS_NOT_IN_AGREEMENT: (status: number, route: string, available: string) =>
    `Selected status ${status} for "${route}" is not defined in the API agreement. Available statuses: [${available}]`,
  ROUTE_NOT_IN_AGREEMENT: (route: string) =>
    `Configured response "${route}" does not match any endpoint defined in the API agreement`
} as const;

export const DOCX_MESSAGES = {
  ARCHIVE_OPEN_FAILED: (msg: string) => `Failed to open .docx archive: ${msg}`,
  MISSING_DOCUMENT_XML: 'Invalid .docx file: missing "word/document.xml"',
  MALFORMED_XML: (msg: string) => `Malformed XML in document.xml: ${msg}`,
  MISSING_DOCUMENT_ROOT: 'Invalid Word XML: missing <w:document> root',
  MISSING_BODY_CONTAINER: 'Invalid Word XML: missing <w:body> container',
  DUPLICATE_SECTION_TABLE: (section: string) => `Duplicate table found for section "${section}"`,
  DUPLICATE_METADATA: (key: string) => `Duplicate metadata entry for "${key}"`,
  INCOMPLETE_ENDPOINT: (name: string, missing: string) => `Endpoint "${name}" is missing required section: ${missing}`
} as const;

export const AGREEMENT_MESSAGES = {
  EMPTY_AGREEMENT: 'Agreement contains no endpoint definitions',
  MISSING_METHOD: 'Missing required metadata "Method"',
  INVALID_METHOD: (method: string, supported: string) =>
    `Invalid HTTP Method "${method}". Supported: ${supported}`,
  MISSING_PATH: 'Missing required metadata "Path"',
  INVALID_PATH: (path: string) => `Invalid Path "${path}". Path must begin with "/"`,
  INVALID_AUTH: (auth: string) => `Invalid Authentication "${auth}". Supported: none, bearer, required`,
  INVALID_REQUEST_BODY: (rb: string) => `Invalid Request body "${rb}". Supported: json, none`,
  INVALID_SUCCESS_STATUS: (status: string) => `Invalid Success status "${status}". Must be a 2xx status code`,
  INVALID_SUCCESS_BODY: (sb: string) => `Invalid Success body "${sb}". Supported: json, none`,
  NO_BODY_204: 'HTTP status 204 must have Success body set to "none" and no response body defined',
  MISSING_VALIDATION_TRIGGER: 'Endpoint must define at least one Error Response with trigger "validation" (e.g. status 400)',
  DUPLICATE_OPERATION: (op: string) => `Duplicate endpoint definition: "${op}" is defined more than once`,
  MISSING_PATH_PARAM_IN_TABLE: (param: string, path: string) =>
    `Path parameter "{${param}}" in URL "${path}" is missing from Request Fields table with Location "path"`,
  UNDECLARED_PATH_PARAM: (field: string, path: string) =>
    `Field "${field}" has Location "path" but is not present as "{${field}}" in URL "${path}"`,
  PATH_PARAM_MUST_BE_REQUIRED: (field: string) =>
    `Path parameter "${field}" must have Required set to "yes"`,
  UNSATISFIABLE_MIN_MAX: (min: number, max: number) =>
    `Unsatisfiable bounds: min (${min}) cannot be greater than max (${max})`,
  UNSATISFIABLE_LENGTH: (min: number, max: number) =>
    `Unsatisfiable bounds: minLength (${min}) cannot be greater than maxLength (${max})`,
  UNSATISFIABLE_ITEMS: (min: number, max: number) =>
    `Unsatisfiable bounds: minItems (${min}) cannot be greater than maxItems (${max})`,
  MISSING_TABLE_COLUMNS: (table: string, required: string) =>
    `${table} table must contain columns: ${required}`,
  INVALID_LOCATION: (loc: string, supported: string) =>
    `Invalid Location "${loc}". Supported: ${supported}`,
  INVALID_TYPE: (type: string, supported: string) =>
    `Invalid Type "${type}". Supported: ${supported}`,
  INVALID_ERROR_STATUS: (status: string) =>
    `Invalid Error Status "${status}". Must be a 4xx or 5xx HTTP code`,
  INVALID_ERROR_TRIGGER: (trigger: string, supported: string) =>
    `Invalid Error Trigger "${trigger}". Supported: ${supported}`
} as const;

export const RULE_MESSAGES = {
  INVALID_SYNTAX: (token: string) => `Invalid rule syntax "${token}". Expected "key=value"`,
  UNKNOWN_KEY: (key: string, valid: string) => `Unknown rule key "${key}". Valid rule keys: ${valid}`,
  TYPE_MISMATCH: (rule: string, expected: string, received: string) =>
    `Rule "${rule}" is only valid for ${expected} (received on "${received}")`,
  INVALID_NUMBER: (rule: string, val: string) => `Invalid number for "${rule}": "${val}"`,
  INVALID_NON_NEGATIVE_INT: (rule: string, val: string) =>
    `Invalid non-negative integer for "${rule}": "${val}"`,
  INVALID_REGEX: (pattern: string, err: string) => `Invalid regex pattern "${pattern}": ${err}`,
  ENUM_BRACKETS_REQUIRED: (raw: string) => `Enum values must be enclosed in brackets "[...]", received: "${raw}"`,
  ENUM_EMPTY: 'Enum cannot be empty',
  ENUM_INVALID_NUMBER: (val: string, type: string) =>
    `Enum value "${val}" is not a valid number for ${type} field`,
  ENUM_INVALID_BOOLEAN: (val: string) =>
    `Enum value "${val}" is not a valid boolean (expected true or false)`,
  DEFAULT_INVALID_INT: (raw: string) => `Invalid integer default value: "${raw}"`,
  DEFAULT_INVALID_NUM: (raw: string) => `Invalid number default value: "${raw}"`,
  DEFAULT_INVALID_BOOL: (raw: string) => `Invalid boolean default value "${raw}". Expected true or false`,
  DEFAULT_INVALID_JSON: (type: string, raw: string) => `Invalid JSON default for ${type}: "${raw}"`
} as const;

export const VALIDATION_MESSAGES = {
  VALIDATION_FAILED: 'Request validation failed',
  MISSING_AUTH_HEADER: 'Missing required Authorization header',
  INVALID_BEARER_TOKEN: 'Authorization header must follow Bearer token format',
  UNSUPPORTED_MEDIA_TYPE: (received: string) =>
    `Unsupported Media Type "${received}". Expected "application/json"`,
  MISSING_CONTENT_TYPE: 'Missing Content-Type header; expected "application/json"',
  MALFORMED_JSON_BODY: (err: string) => `Malformed JSON body: ${err}`,
  UNKNOWN_QUERY_PARAM: (param: string) => `Unknown query parameter "${param}" is not allowed`,
  COERCION_INTEGER_FAILED: (field: string, val: string) =>
    `Field "${field}" must be a valid integer, received "${val}"`,
  COERCION_NUMBER_FAILED: (field: string, val: string) =>
    `Field "${field}" must be a valid number, received "${val}"`,
  COERCION_BOOLEAN_FAILED: (field: string, val: string) =>
    `Field "${field}" must be a boolean (true or false), received "${val}"`
} as const;

export const GENERATOR_MESSAGES = {
  UNSATISFIABLE_SCHEMA: (msg: string) =>
    `Generated response payload failed response schema validation: ${msg}`,
  EXCEEDED_MAX_DEPTH: 'Maximum schema generation depth (5) exceeded',
  UNSUPPORTED_TYPE: (type: string) => `Unsupported schema type for response generation: "${type}"`
} as const;

export const SERVER_MESSAGES = {
  ROUTE_NOT_FOUND: (method: string, path: string) =>
    `Route ${method} ${path} not found in API agreement`,
  METHOD_NOT_ALLOWED: (method: string, path: string) =>
    `Method ${method} not allowed for route ${path}`,
  MALFORMED_JSON: 'Malformed JSON in request body',
  SHUTDOWN_SIGNAL: (signal: string) =>
    `Received ${signal}. Shutting down Moksy server gracefully...`,
  SERVER_STARTED: (url: string) => `Moksy mock server listening at ${url}`
} as const;
