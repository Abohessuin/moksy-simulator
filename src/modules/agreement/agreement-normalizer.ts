import { MoksyAgreementError } from "../../common/errors.js";
import { AGREEMENT_MESSAGES } from "../../common/messages.js";
import {
  isPlaceholderCell,
  sanitizeWordText,
} from "../../common/text-sanitizer.js";
import {
  AuthType,
  BodyContentType,
  ErrorTrigger,
  FieldType,
  HttpMethod,
} from "../../common/types.js";
import {
  RawEndpointBlock,
  RawEndpointMetadata,
  RawTable,
} from "../docx/types.js";
import {
  AUTH_NORMALIZATION_MAP,
  BOOLEAN_VALUE_MAP,
  HTTP_METHOD_MAP,
  LOCATION_MAP,
  REQUEST_BODY_MAP,
  SUCCESS_BODY_MAP,
  TYPE_MAP,
} from "./constants.js";
import { parseRules } from "./rule-parser.js";
import { STATE_AGREEMENT_MESSAGES } from "./messages.js";
import { buildJsonSchema, FieldRowForSchema } from "./schema-builder.js";
import {
  NormalizedAgreement,
  NormalizedEndpoint,
  ParsedErrorField,
  ParsedRequestField,
  ParsedResponseField,
  RequestBehavior,
} from "./types.js";

interface ErrorContext {
  filePath?: string;
  endpoint: string;
  section: string;
  row?: number;
  field?: string;
}

/**
 * Normalizes and validates an HTTP method string.
 * @param {string | undefined} rawMethod - Raw method string.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {HttpMethod} Normalized uppercase HTTP method.
 * @throws {MoksyAgreementError} If method is missing or unsupported.
 * @example
 * // Input & Expected Output:
 * normalizeMethod("get", ctx); // Returns "GET"
 * normalizeMethod("POST", ctx); // Returns "POST"
 * normalizeMethod("INVALID", ctx); // Throws MoksyAgreementError
 */
export function normalizeMethod(
  rawMethod: string | undefined,
  context: ErrorContext,
): HttpMethod {
  if (!rawMethod) {
    throw new MoksyAgreementError(AGREEMENT_MESSAGES.MISSING_METHOD, context);
  }
  const upper = rawMethod.toUpperCase().trim();
  const method = HTTP_METHOD_MAP[upper];
  if (!method) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_METHOD(
        rawMethod,
        Object.keys(HTTP_METHOD_MAP).join(", "),
      ),
      context,
    );
  }
  return method;
}

/**
 * Normalizes and validates a URL path string.
 * @param {string | undefined} rawPath - Raw path string.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {string} Trimmed path beginning with "/".
 * @throws {MoksyAgreementError} If path is missing or does not start with "/".
 * @example
 * // Input & Expected Output:
 * normalizePath("/products", ctx); // Returns "/products"
 * normalizePath("products", ctx); // Throws MoksyAgreementError (must begin with "/")
 */
export function normalizePath(
  rawPath: string | undefined,
  context: ErrorContext,
): string {
  if (!rawPath) {
    throw new MoksyAgreementError(AGREEMENT_MESSAGES.MISSING_PATH, context);
  }
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith("/")) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_PATH(trimmed),
      context,
    );
  }
  return trimmed;
}

export function normalizeCollection(rawCollection: string | undefined): string | undefined {
  if (!rawCollection || isPlaceholderCell(rawCollection)) return undefined;
  const collection = sanitizeWordText(rawCollection);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(collection)) {
    throw new MoksyAgreementError(
      STATE_AGREEMENT_MESSAGES.COLLECTION_NAME_INVALID(collection)
    );
  }
  return collection;
}

export function parseRequestBehavior(rawBehavior: string): RequestBehavior | undefined {
  if (isPlaceholderCell(rawBehavior)) return undefined;
  const normalized = sanitizeWordText(rawBehavior).trim();
  const keyword = normalized.toLowerCase();
  if (keyword === "page") return { kind: "page" };
  if (keyword === "pagesize") return { kind: "pageSize" };

  const match = normalized.match(/^(filter|search)\s*=\s*([A-Za-z][A-Za-z0-9_.]*)$/i);
  if (match) {
    return {
      kind: match[1].toLowerCase() as "filter" | "search",
      recordField: match[2],
    };
  }

  throw new MoksyAgreementError(
    STATE_AGREEMENT_MESSAGES.BEHAVIOR_INVALID(rawBehavior)
  );
}

/**
 * Extracts declared path parameter names from a URL path template.
 * @param {string} path - URL path template (e.g. "/categories/{id}/products").
 * @returns {string[]} List of parameter names (e.g. ["id"]).
 * @example
 * // Input & Expected Output:
 * extractPathParamNames("/users/{id}/orders/{orderId}"); // Returns ["id", "orderId"]
 * extractPathParamNames("/products"); // Returns []
 */
export function extractPathParamNames(path: string): string[] {
  const matches = [...path.matchAll(/\{([a-zA-Z0-9_]+)\}/g)];
  return matches.map((m) => m[1]);
}

/**
 * Normalizes the authentication requirement string.
 * @param {string | undefined} rawAuth - Raw authentication setting.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {AuthType} Normalized authentication type ('none', 'bearer', 'required').
 * @throws {MoksyAgreementError} If value is unrecognized.
 * @example
 * // Input & Expected Output:
 * normalizeAuthentication("none", ctx); // Returns "none"
 * normalizeAuthentication("bearer", ctx); // Returns "bearer"
 * normalizeAuthentication(undefined, ctx); // Returns "none"
 */
export function normalizeAuthentication(
  rawAuth: string | undefined,
  context: ErrorContext,
): AuthType {
  if (!rawAuth) return "none";
  const lower = rawAuth.toLowerCase().trim();
  const auth = AUTH_NORMALIZATION_MAP[lower];
  if (!auth) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_AUTH(rawAuth),
      context,
    );
  }
  return auth;
}

/**
 * Normalizes the request body content type based on explicit value or HTTP method defaults.
 * @param {string | undefined} rawBody - Raw request body setting.
 * @param {HttpMethod} method - HTTP method.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {BodyContentType} Normalized content type ('json' or 'none').
 * @throws {MoksyAgreementError} If value is unrecognized.
 * @example
 * // Input & Expected Output:
 * normalizeRequestBodyType("json", "POST", ctx); // Returns "json"
 * normalizeRequestBodyType(undefined, "GET", ctx); // Returns "none"
 * normalizeRequestBodyType(undefined, "POST", ctx); // Returns "json"
 */
export function normalizeRequestBodyType(
  rawBody: string | undefined,
  method: HttpMethod,
  context: ErrorContext,
): BodyContentType {
  if (rawBody) {
    const lower = rawBody.toLowerCase().trim();
    const type = REQUEST_BODY_MAP[lower];
    if (!type) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.INVALID_REQUEST_BODY(rawBody),
        context,
      );
    }
    return type;
  }
  return method === "POST" || method === "PUT" || method === "PATCH"
    ? "json"
    : "none";
}

/**
 * Normalizes and validates the success HTTP status code.
 * @param {string | undefined} rawStatus - Raw status code string.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {number} Integer 2xx HTTP status code.
 * @throws {MoksyAgreementError} If status is not a valid 2xx code.
 * @example
 * // Input & Expected Output:
 * normalizeSuccessStatus("201", ctx); // Returns 201
 * normalizeSuccessStatus(undefined, ctx); // Returns 200
 * normalizeSuccessStatus("400", ctx); // Throws MoksyAgreementError (must be 2xx)
 */
export function normalizeSuccessStatus(
  rawStatus: string | undefined,
  context: ErrorContext,
): number {
  if (!rawStatus) return 200;
  const statusNum = parseInt(rawStatus.trim(), 10);
  if (Number.isNaN(statusNum) || statusNum < 200 || statusNum > 299) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_SUCCESS_STATUS(rawStatus),
      context,
    );
  }
  return statusNum;
}

/**
 * Normalizes the success response body content type, enforcing the status 204 invariant.
 * @param {string | undefined} rawBody - Raw success body setting.
 * @param {number} successStatus - Resolved success status code.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {BodyContentType} Normalized content type ('json' or 'none').
 * @throws {MoksyAgreementError} If value is invalid or 204 specifies a body.
 * @example
 * // Input & Expected Output:
 * normalizeSuccessBodyType("json", 200, ctx); // Returns "json"
 * normalizeSuccessBodyType(undefined, 204, ctx); // Returns "none"
 * normalizeSuccessBodyType("json", 204, ctx); // Throws MoksyAgreementError (204 must have none)
 */
export function normalizeSuccessBodyType(
  rawBody: string | undefined,
  successStatus: number,
  context: ErrorContext,
): BodyContentType {
  let bodyType: BodyContentType = successStatus === 204 ? "none" : "json";
  if (rawBody) {
    const lower = rawBody.toLowerCase().trim();
    const type = SUCCESS_BODY_MAP[lower];
    if (!type) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.INVALID_SUCCESS_BODY(rawBody),
        context,
      );
    }
    bodyType = type;
  }
  if (successStatus === 204 && bodyType !== "none") {
    throw new MoksyAgreementError(AGREEMENT_MESSAGES.NO_BODY_204, context);
  }
  return bodyType;
}

/**
 * Normalizes all metadata properties of an endpoint block.
 * @param {RawEndpointMetadata} metadata - Raw extracted metadata object.
 * @param {ErrorContext} baseCtx - Base diagnostic context.
 * @returns Normalized metadata object.
 * @example
 * // Input:
 * const raw = { method: "GET", path: "/items", successStatus: "200" };
 * // Expected Output:
 * normalizeEndpointMetadata(raw, ctx);
 * // Returns:
 * // {
 * //   apiName: "GET /items",
 * //   method: "GET",
 * //   path: "/items",
 * //   pathParamNames: [],
 * //   authentication: "none",
 * //   requestBodyContentType: "none",
 * //   successStatus: 200,
 * //   successBodyContentType: "json"
 * // }
 */
export function normalizeEndpointMetadata(
  metadata: RawEndpointMetadata,
  baseCtx: ErrorContext,
) {
  const metaCtx: ErrorContext = { ...baseCtx, section: "Metadata" };
  const method = normalizeMethod(metadata.method, metaCtx);
  const path = normalizePath(metadata.path, metaCtx);
  const pathParamNames = extractPathParamNames(path);
  const collection = normalizeCollection(metadata.collection);
  const apiName = metadata.apiName?.trim() || `${method} ${path}`;
  const authentication = normalizeAuthentication(
    metadata.authentication,
    metaCtx,
  );
  const requestBodyContentType = normalizeRequestBodyType(
    metadata.requestBody,
    method,
    metaCtx,
  );
  const successStatus = normalizeSuccessStatus(metadata.successStatus, metaCtx);
  const successBodyContentType = normalizeSuccessBodyType(
    metadata.successBody,
    successStatus,
    metaCtx,
  );

  return {
    apiName,
    method,
    path,
    pathParamNames,
    collection,
    authentication,
    requestBodyContentType,
    successStatus,
    successBodyContentType,
  };
}

/**
 * Resolves column header positions in a table matrix.
 * @param {string[]} headers - Raw header row.
 * @param {string[]} requiredColumns - Required column names.
 * @param {string} tableName - Human-readable table name for error messages.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {Record<string, number>} Map of lowercase column names to column indices.
 * @throws {MoksyAgreementError} If any required column is missing.
 * @example
 * // Input & Expected Output:
 * const indices = resolveTableColumnIndices(["Field", "Location"], ["field", "location"], "Request fields", ctx);
 * // Returns: { field: 0, location: 1 }
 */
export function resolveTableColumnIndices(
  headers: string[],
  requiredColumns: string[],
  tableName: string,
  context: ErrorContext,
): Record<string, number> {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const indexMap: Record<string, number> = {};

  for (const col of requiredColumns) {
    const idx = normalized.indexOf(col);
    if (idx === -1) {
      throw new MoksyAgreementError(
        AGREEMENT_MESSAGES.MISSING_TABLE_COLUMNS(
          tableName,
          requiredColumns.join(", "),
        ),
        context,
      );
    }
    indexMap[col] = idx;
  }

  // Also map optional columns if present
  ["nullable", "rules", "default", "behavior"].forEach((col) => {
    const idx = normalized.indexOf(col);
    if (idx !== -1) indexMap[col] = idx;
  });

  return indexMap;
}

/**
 * Parses a single row of the Request Fields table.
 * @param {string[]} row - Table row cells.
 * @param {Record<string, number>} indices - Column index map.
 * @param {number} rowIndex - 1-based row index.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {ParsedRequestField | null} Parsed request field or null if empty/placeholder.
 */
export function parseRequestFieldRow(
  row: string[],
  indices: Record<string, number>,
  rowIndex: number,
  context: ErrorContext,
): ParsedRequestField | null {
  const rowCtx: ErrorContext = { ...context, row: rowIndex };
  const rawField = row[indices["field"]]
    ? sanitizeWordText(row[indices["field"]])
    : "";
  if (isPlaceholderCell(rawField)) return null;

  const rawLoc = (row[indices["location"]] || "").toLowerCase().trim();
  const location = LOCATION_MAP[rawLoc];
  if (!location) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_LOCATION(
        row[indices["location"]],
        Object.keys(LOCATION_MAP).join(", "),
      ),
      { ...rowCtx, field: rawField },
    );
  }

  const rawType = (row[indices["type"]] || "").toLowerCase().trim();
  const type = TYPE_MAP[rawType];
  if (!type) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_TYPE(
        row[indices["type"]],
        Object.keys(TYPE_MAP).join(", "),
      ),
      { ...rowCtx, field: rawField },
    );
  }

  const rawReq = (row[indices["required"]] || "").toLowerCase().trim();
  const required = BOOLEAN_VALUE_MAP[rawReq] ?? false;

  const rawNull =
    indices["nullable"] !== undefined && row[indices["nullable"]]
      ? row[indices["nullable"]].toLowerCase().trim()
      : "no";
  const nullable = BOOLEAN_VALUE_MAP[rawNull] ?? false;

  const rawRules =
    indices["rules"] !== undefined && row[indices["rules"]]
      ? row[indices["rules"]]
      : "";
  const constraints = parseRules(rawRules, type, {
    ...rowCtx,
    field: rawField,
  });

  const rawBehavior =
    indices["behavior"] !== undefined && row[indices["behavior"]]
      ? row[indices["behavior"]]
      : "";
  const behavior = parseRequestBehavior(rawBehavior);
  if (behavior && location !== "query") {
    throw new MoksyAgreementError(
        STATE_AGREEMENT_MESSAGES.BEHAVIOR_QUERY_ONLY,
      { ...rowCtx, field: rawField },
    );
  }

  return {
    field: rawField,
    location,
    type,
    required,
    nullable: nullable || !!constraints.nullable,
    constraints,
    defaultValue: constraints.default,
    behavior,
  };
}

/**
 * Parses the Request Fields raw table into a list of ParsedRequestField objects.
 * @param {RawTable | undefined} table - Raw table.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {ParsedRequestField[]} List of parsed request fields.
 */
export function parseRequestFieldsTable(
  table: RawTable | undefined,
  context: ErrorContext,
): ParsedRequestField[] {
  if (!table || table.rows.length === 0) return [];

  const indices = resolveTableColumnIndices(
    table.headers,
    ["field", "location", "type", "required"],
    "Request fields",
    context,
  );
  const fields: ParsedRequestField[] = [];

  for (let i = 0; i < table.rows.length; i++) {
    const parsed = parseRequestFieldRow(table.rows[i], indices, i + 1, context);
    if (parsed) fields.push(parsed);
  }

  return fields;
}

/**
 * Transforms a field representation into a FieldRowForSchema for JSON Schema generation.
 * @param {any} r - Field object.
 * @returns {FieldRowForSchema} Schema row.
 */
export function toFieldRowForSchema(r: {
  field: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  constraints: any;
  defaultValue?: any;
}): FieldRowForSchema {
  return {
    field: r.field,
    type: r.type,
    required: r.required,
    nullable: r.nullable,
    constraints: r.constraints,
    defaultValue: r.defaultValue,
  };
}

/**
 * Builds JSON Schemas for path, query, headers, and body from parsed request fields.
 * @param {ParsedRequestField[]} fields - Parsed request fields.
 * @param {BodyContentType} requestBodyContentType - Request body content type.
 * @param {ErrorContext} baseCtx - Diagnostic error context.
 * @returns Object containing compiled pathSchema, querySchema, headerSchema, and bodySchema.
 */
export function buildRequestSchemas(
  fields: ParsedRequestField[],
  requestBodyContentType: BodyContentType,
  baseCtx: ErrorContext,
) {
  const pathRows = fields.filter((r) => r.location === "path");
  const queryRows = fields.filter((r) => r.location === "query");
  const headerRows = fields.filter((r) => r.location === "header");
  const bodyRows = fields.filter((r) => r.location === "body");

  const pathSchema =
    pathRows.length > 0
      ? buildJsonSchema(pathRows.map(toFieldRowForSchema), {
          ...baseCtx,
          section: "Request fields (Path)",
        })
      : undefined;

  const querySchema =
    queryRows.length > 0
      ? buildJsonSchema(queryRows.map(toFieldRowForSchema), {
          ...baseCtx,
          section: "Request fields (Query)",
        })
      : undefined;

  const headerSchema =
    headerRows.length > 0
      ? buildJsonSchema(
          headerRows.map((r) => ({
            ...toFieldRowForSchema(r),
            field: r.field.toLowerCase(),
          })),
          { ...baseCtx, section: "Request fields (Header)" },
        )
      : undefined;

  let bodySchema: any;
  if (requestBodyContentType === "json" && bodyRows.length > 0) {
    bodySchema = buildJsonSchema(bodyRows.map(toFieldRowForSchema), {
      ...baseCtx,
      section: "Request fields (Body)",
    });
  }

  return { pathSchema, querySchema, headerSchema, bodySchema };
}

/**
 * Parses a single row of the Success Response Fields table.
 * @param {string[]} row - Table row cells.
 * @param {Record<string, number>} indices - Column index map.
 * @param {number} rowIndex - 1-based row index.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {ParsedResponseField | null} Parsed response field or null if empty/placeholder.
 */
export function parseSuccessResponseRow(
  row: string[],
  indices: Record<string, number>,
  rowIndex: number,
  context: ErrorContext,
): ParsedResponseField | null {
  const rowCtx: ErrorContext = { ...context, row: rowIndex };
  const rawField = row[indices["field"]]
    ? sanitizeWordText(row[indices["field"]])
    : "";
  if (isPlaceholderCell(rawField)) return null;

  const rawType = (row[indices["type"]] || "").toLowerCase().trim();
  const type = TYPE_MAP[rawType];
  if (!type) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_TYPE(
        row[indices["type"]],
        Object.keys(TYPE_MAP).join(", "),
      ),
      { ...rowCtx, field: rawField },
    );
  }

  const rawReq = (row[indices["required"]] || "").toLowerCase().trim();
  const required = BOOLEAN_VALUE_MAP[rawReq] ?? false;

  const rawNull =
    indices["nullable"] !== undefined && row[indices["nullable"]]
      ? row[indices["nullable"]].toLowerCase().trim()
      : "no";
  const nullable = BOOLEAN_VALUE_MAP[rawNull] ?? false;

  const rawRules =
    indices["rules"] !== undefined && row[indices["rules"]]
      ? row[indices["rules"]]
      : "";
  const constraints = parseRules(rawRules, type, {
    ...rowCtx,
    field: rawField,
  });

  return {
    field: rawField,
    type,
    required,
    nullable: nullable || !!constraints.nullable,
    constraints,
  };
}

/**
 * Parses the Success Response Fields raw table into a list of ParsedResponseField objects.
 * @param {RawTable | undefined} table - Raw table.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {ParsedResponseField[]} List of parsed success response fields.
 */
export function parseSuccessResponseTable(
  table: RawTable | undefined,
  context: ErrorContext,
): ParsedResponseField[] {
  if (!table || table.rows.length === 0) return [];

  const indices = resolveTableColumnIndices(
    table.headers,
    ["field", "type", "required"],
    "Success response",
    context,
  );
  const fields: ParsedResponseField[] = [];

  for (let i = 0; i < table.rows.length; i++) {
    const parsed = parseSuccessResponseRow(
      table.rows[i],
      indices,
      i + 1,
      context,
    );
    if (parsed) fields.push(parsed);
  }

  return fields;
}

/**
 * Parses a single row of the Error Responses table.
 * @param {string[]} row - Table row cells.
 * @param {Record<string, number>} indices - Column index map.
 * @param {number} rowIndex - 1-based row index.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {ParsedErrorField | null} Parsed error field or null if empty/placeholder.
 */
export function parseErrorFieldRow(
  row: string[],
  indices: Record<string, number>,
  rowIndex: number,
  context: ErrorContext,
): ParsedErrorField | null {
  const rowCtx: ErrorContext = { ...context, row: rowIndex };
  const rawStatus = row[indices["status"]]
    ? sanitizeWordText(row[indices["status"]])
    : "";
  if (isPlaceholderCell(rawStatus)) return null;

  const status = parseInt(rawStatus, 10);
  if (Number.isNaN(status) || status < 400 || status > 599) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_ERROR_STATUS(rawStatus),
      rowCtx,
    );
  }

  const rawTrigger = (row[indices["trigger"]] || "").toLowerCase().trim();
  if (!["validation", "selected", "not_found"].includes(rawTrigger)) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_ERROR_TRIGGER(
        row[indices["trigger"]],
        "validation, selected, not_found",
      ),
      rowCtx,
    );
  }
  const trigger = rawTrigger as ErrorTrigger;

  const rawField = row[indices["field"]]
    ? sanitizeWordText(row[indices["field"]])
    : "";
  const rawType = (row[indices["type"]] || "").toLowerCase().trim();
  const type = TYPE_MAP[rawType];
  if (!type) {
    throw new MoksyAgreementError(
      AGREEMENT_MESSAGES.INVALID_TYPE(
        row[indices["type"]],
        Object.keys(TYPE_MAP).join(", "),
      ),
      { ...rowCtx, field: rawField },
    );
  }

  const rawReq =
    indices["required"] !== undefined && row[indices["required"]]
      ? row[indices["required"]].toLowerCase().trim()
      : "yes";
  const required = BOOLEAN_VALUE_MAP[rawReq] ?? true;

  const rawNull =
    indices["nullable"] !== undefined && row[indices["nullable"]]
      ? row[indices["nullable"]].toLowerCase().trim()
      : "no";
  const nullable = BOOLEAN_VALUE_MAP[rawNull] ?? false;

  const rawRules =
    indices["rules"] !== undefined && row[indices["rules"]]
      ? row[indices["rules"]]
      : "";
  const constraints = parseRules(rawRules, type, {
    ...rowCtx,
    field: rawField,
  });

  return {
    status,
    trigger,
    field: rawField,
    type,
    required,
    nullable: nullable || !!constraints.nullable,
    constraints,
  };
}

/**
 * Parses the Error Responses raw table into a dictionary of error responses keyed by status code.
 * @param {RawTable | undefined} table - Raw table.
 * @param {ErrorContext} context - Diagnostic error context.
 * @returns {Record<number, { trigger: ErrorTrigger; schema?: any }>} Map of status codes to triggers and schemas.
 */
export function parseErrorResponsesTable(
  table: RawTable | undefined,
  context: ErrorContext,
): Record<number, { trigger: ErrorTrigger; schema?: any }> {
  const errorMap: Record<number, { trigger: ErrorTrigger; schema?: any }> = {};
  if (!table || table.rows.length === 0) return errorMap;

  const indices = resolveTableColumnIndices(
    table.headers,
    ["status", "trigger", "field", "type"],
    "Error responses",
    context,
  );
  const groupedRows: Record<
    number,
    { trigger: ErrorTrigger; rows: ParsedErrorField[] }
  > = {};

  for (let i = 0; i < table.rows.length; i++) {
    const parsed = parseErrorFieldRow(table.rows[i], indices, i + 1, context);
    if (!parsed) continue;

    if (!groupedRows[parsed.status]) {
      groupedRows[parsed.status] = { trigger: parsed.trigger, rows: [] };
    }
    groupedRows[parsed.status].rows.push(parsed);
  }

  for (const [statusStr, { trigger, rows }] of Object.entries(groupedRows)) {
    const status = parseInt(statusStr, 10);
    const validRows = rows.filter(
      (r) => r.field && !isPlaceholderCell(r.field),
    );
    const schema =
      validRows.length > 0
        ? buildJsonSchema(validRows.map(toFieldRowForSchema), {
            ...context,
            section: `Error ${status} body`,
          })
        : undefined;

    errorMap[status] = { trigger, schema };
  }

  return errorMap;
}

/**
 * Normalizes a single raw endpoint block into an in-memory NormalizedEndpoint.
 * @param {RawEndpointBlock} block - Raw block extracted from Word document.
 * @param {string} [filePath] - Source file path.
 * @returns {NormalizedEndpoint} Fully validated and compiled endpoint definition.
 */
export function normalizeSingleEndpoint(
  block: RawEndpointBlock,
  filePath?: string,
): NormalizedEndpoint {
  const endpointStr = `${block.metadata.method || "UNKNOWN"} ${block.metadata.path || "UNKNOWN"}`;
  const baseCtx: ErrorContext = {
    filePath,
    endpoint: endpointStr,
    section: "General",
  };

  // 1. Metadata normalization
  const meta = normalizeEndpointMetadata(block.metadata, baseCtx);

  // 2. Request fields normalization & schema building
  const parsedRequestFields = parseRequestFieldsTable(
    block.requestFieldsTable,
    { ...baseCtx, section: "Request fields" },
  );
  const { pathSchema, querySchema, headerSchema, bodySchema } =
    buildRequestSchemas(
      parsedRequestFields,
      meta.requestBodyContentType,
      baseCtx,
    );

  // 3. Success response fields normalization
  let successResponseSchema: any;
  if (meta.successBodyContentType === "json" && block.successResponseTable) {
    const parsedResponseFields = parseSuccessResponseTable(
      block.successResponseTable,
      { ...baseCtx, section: "Success response fields" },
    );
    if (parsedResponseFields.length > 0) {
      successResponseSchema = buildJsonSchema(
        parsedResponseFields.map(toFieldRowForSchema),
        { ...baseCtx, section: "Success response fields" },
      );
    }
  }

  // 4. Error responses normalization
  const errorResponses = parseErrorResponsesTable(block.errorResponsesTable, {
    ...baseCtx,
    section: "Error responses",
  });

  return {
    ...meta,
    requestFields: parsedRequestFields,
    pathSchema,
    querySchema,
    headerSchema,
    bodySchema,
    successResponseSchema,
    errorResponses,
  };
}

/**
 * Compiles a list of raw extracted endpoint blocks into a complete NormalizedAgreement.
 * @param {RawEndpointBlock[]} rawBlocks - Raw blocks extracted from Word document.
 * @param {string} [filePath] - Optional source file path.
 * @returns {NormalizedAgreement} Complete normalized agreement with all endpoints and schemas.
 * @throws {MoksyAgreementError} If the agreement has no endpoints or contains syntax errors.
 * @example
 * // Input:
 * const blocks = extractEndpointBlocks(docxElements);
 * const agreement = normalizeAgreement(blocks, "api.docx");
 * // Expected Output:
 * // {
 * //   filePath: "api.docx",
 * //   endpoints: [
 * //     { method: "GET", path: "/products", successStatus: 200, querySchema: {...}, ... }
 * //   ]
 * // }
 */
export function normalizeAgreement(
  rawBlocks: RawEndpointBlock[],
  filePath?: string,
): NormalizedAgreement {
  if (!rawBlocks || rawBlocks.length === 0) {
    throw new MoksyAgreementError(AGREEMENT_MESSAGES.EMPTY_AGREEMENT, {
      filePath,
    });
  }

  const endpoints: NormalizedEndpoint[] = [];
  for (const block of rawBlocks) {
    endpoints.push(normalizeSingleEndpoint(block, filePath));
  }

  return {
    filePath,
    endpoints,
  };
}
