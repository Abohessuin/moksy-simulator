import { MoksyAgreementError } from '../../common/errors.js';
import { FieldType } from '../../common/types.js';
import { FieldConstraints } from './types.js';

export interface FieldRowForSchema {
  field: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  constraints: FieldConstraints;
  defaultValue?: any;
}

export interface SchemaBuildContext {
  filePath?: string;
  endpoint?: string;
  section?: string;
  row?: number;
  field?: string;
}

export type PathToken =
  | { kind: 'property'; name: string }
  | { kind: 'item' };

/**
 * Tokenizes a dot/bracket notation path string into property and array-item navigation steps.
 * @param {string} fieldPath - Dot or bracket path (e.g. "data[].id" or "user.profile.name").
 * @returns {PathToken[]} Sequential list of path tokens.
 * @example
 * parsePathToTokens("data[].id");
 * // Returns:
 * // [
 * //   { kind: "property", name: "data" },
 * //   { kind: "item" },
 * //   { kind: "property", name: "id" }
 * // ]
 */
export function parsePathToTokens(fieldPath: string): PathToken[] {
  const parts = fieldPath.split('.');
  const tokens: PathToken[] = [];

  for (const part of parts) {
    if (part.endsWith('[]')) {
      const baseName = part.slice(0, -2).trim();
      if (baseName) {
        tokens.push({ kind: 'property', name: baseName });
      }
      tokens.push({ kind: 'item' });
    } else {
      tokens.push({ kind: 'property', name: part.trim() });
    }
  }

  return tokens;
}

/**
 * Strategy object organizing constraint applicators for each supported schema type.
 */
export const TYPE_CONSTRAINT_APPLICATORS: Record<
  FieldType,
  (schema: Record<string, any>, constraints: FieldConstraints) => void
> = {
  integer: (schema, constraints) => {
    if (constraints.min !== undefined) schema.minimum = constraints.min;
    if (constraints.max !== undefined) schema.maximum = constraints.max;
  },
  number: (schema, constraints) => {
    if (constraints.min !== undefined) schema.minimum = constraints.min;
    if (constraints.max !== undefined) schema.maximum = constraints.max;
  },
  string: (schema, constraints) => {
    if (constraints.minLength !== undefined) schema.minLength = constraints.minLength;
    if (constraints.maxLength !== undefined) schema.maxLength = constraints.maxLength;
    if (constraints.pattern !== undefined) schema.pattern = constraints.pattern;
  },
  array: (schema, constraints) => {
    if (constraints.minItems !== undefined) schema.minItems = constraints.minItems;
    if (constraints.maxItems !== undefined) schema.maxItems = constraints.maxItems;
  },
  object: (schema) => {
    schema.properties = schema.properties || {};
    schema.required = schema.required || [];
    schema.additionalProperties = false;
  },
  boolean: () => {}
};

/**
 * Converts field type and constraints into a leaf JSON Schema node.
 * @param {FieldRowForSchema} row - Field row definition.
 * @returns {Record<string, any>} Leaf JSON Schema object.
 * @example
 * // Input:
 * convertConstraintsToJsonSchema({
 *   field: "age",
 *   type: "integer",
 *   required: true,
 *   nullable: false,
 *   constraints: { min: 18, max: 120 }
 * });
 * // Expected Output:
 * // { type: "integer", minimum: 18, maximum: 120 }
 */
export function convertConstraintsToJsonSchema(row: FieldRowForSchema): Record<string, any> {
  const schema: Record<string, any> = {};
  const { type, nullable, constraints } = row;

  schema.type = nullable ? [type, 'null'] : type;

  const applicator = TYPE_CONSTRAINT_APPLICATORS[type];
  if (applicator) {
    applicator(schema, constraints);
  }

  if (constraints.enum !== undefined && constraints.enum.length > 0) {
    schema.enum = constraints.enum;
  }

  if (row.defaultValue !== undefined) {
    schema.default = row.defaultValue;
  } else if (constraints.default !== undefined) {
    schema.default = constraints.default;
  }

  return schema;
}

/**
 * Traverses parent container nodes (objects or array items) according to path tokens.
 * @param {Record<string, any>} root - Root schema node.
 * @param {PathToken[]} parentTokens - Intermediate tokens before the final leaf.
 * @param {SchemaBuildContext} context - Diagnostic error context.
 * @returns {Record<string, any>} The parent container node where the leaf should be attached.
 * @throws {MoksyAgreementError} If a parent container was not declared or has an invalid type.
 */
export function navigateParentContainers(
  root: Record<string, any>,
  parentTokens: PathToken[],
  context: SchemaBuildContext
): Record<string, any> {
  let current = root;

  for (const token of parentTokens) {
    if (token.kind === 'property') {
      if (!current.properties || !current.properties[token.name]) {
        throw new MoksyAgreementError(
          `Parent field "${token.name}" must be declared before its child fields`,
          context
        );
      }
      current = current.properties[token.name];
    } else if (token.kind === 'item') {
      const isArray = current.type === 'array' || (Array.isArray(current.type) && current.type.includes('array'));
      if (!isArray) {
        throw new MoksyAgreementError('Encountered array item indexing on a non-array parent', context);
      }
      if (!current.items) {
        current.items = {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        };
      }
      current = current.items;
    }
  }

  return current;
}

/**
 * Attaches a named property schema to a parent object schema.
 * @param {Record<string, any>} parent - Parent object schema.
 * @param {string} propertyName - Name of the property.
 * @param {Record<string, any>} leafSchema - Property schema node.
 * @param {boolean} required - Whether property is required.
 * @param {SchemaBuildContext} context - Diagnostic error context.
 * @throws {MoksyAgreementError} If the parent is not an object.
 */
export function attachPropertyLeaf(
  parent: Record<string, any>,
  propertyName: string,
  leafSchema: Record<string, any>,
  required: boolean,
  context: SchemaBuildContext
): void {
  const isObject = parent.type === 'object' || (Array.isArray(parent.type) && parent.type.includes('object'));
  if (!isObject) {
    throw new MoksyAgreementError(`Parent field is not an object, cannot add property "${propertyName}"`, context);
  }

  parent.properties = parent.properties || {};
  parent.properties[propertyName] = leafSchema;

  if (required) {
    parent.required = parent.required || [];
    if (!parent.required.includes(propertyName)) {
      parent.required.push(propertyName);
    }
  }
}

/**
 * Attaches an array item schema to a parent array schema.
 * @param {Record<string, any>} parent - Parent array schema.
 * @param {FieldRowForSchema} row - Field row defining array items.
 * @param {Record<string, any>} leafSchema - Item schema node.
 * @param {SchemaBuildContext} context - Diagnostic error context.
 * @throws {MoksyAgreementError} If the parent was not declared as an array.
 */
export function attachItemLeaf(
  parent: Record<string, any>,
  row: FieldRowForSchema,
  leafSchema: Record<string, any>,
  context: SchemaBuildContext
): void {
  const isArray = parent.type === 'array' || (Array.isArray(parent.type) && parent.type.includes('array'));
  if (!isArray) {
    throw new MoksyAgreementError(`Parent field for "${row.field}" was not declared as an array`, context);
  }

  if (row.type === 'object') {
    parent.items = parent.items || {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    };
  } else {
    parent.items = leafSchema;
  }
}

/**
 * Inserts a single field row into the evolving root schema AST.
 * @param {Record<string, any>} root - Root schema AST.
 * @param {FieldRowForSchema} row - Field row to insert.
 * @param {SchemaBuildContext & { row: number; field: string }} context - Error context.
 */
export function insertFieldIntoSchema(
  root: Record<string, any>,
  row: FieldRowForSchema,
  context: SchemaBuildContext & { row: number; field: string }
): void {
  const tokens = parsePathToTokens(row.field);
  if (tokens.length === 0) return;

  const parentTokens = tokens.slice(0, -1);
  const lastToken = tokens[tokens.length - 1];
  const parentContainer = navigateParentContainers(root, parentTokens, context);
  const leafSchema = convertConstraintsToJsonSchema(row);

  if (lastToken.kind === 'property') {
    attachPropertyLeaf(parentContainer, lastToken.name, leafSchema, row.required, context);
  } else if (lastToken.kind === 'item') {
    attachItemLeaf(parentContainer, row, leafSchema, context);
  }
}

/**
 * Recursively cleans empty required arrays from an evolving schema AST.
 * @param {Record<string, any>} schema - Schema AST to sanitize.
 */
export function cleanupSchema(schema: Record<string, any>): void {
  if (!schema || typeof schema !== 'object') return;

  const isObject = schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'));
  if (isObject) {
    if (Array.isArray(schema.required) && schema.required.length === 0) {
      delete schema.required;
    }
    if (schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        cleanupSchema(prop as Record<string, any>);
      }
    }
  }

  const isArray = schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'));
  if (isArray && schema.items) {
    cleanupSchema(schema.items);
  }
}

/**
 * Compiles a list of flat or hierarchical field rows into a complete JSON Schema object.
 * @param {FieldRowForSchema[]} rows - List of field definitions.
 * @param {SchemaBuildContext} [context] - Optional diagnostic error context.
 * @returns {Record<string, any>} Compiled JSON Schema object.
 * @throws {MoksyAgreementError} If hierarchy order or types are invalid.
 * @example
 * // Input:
 * const rows = [
 *   { field: "title", type: "string", required: true, nullable: false, constraints: { minLength: 1 } },
 *   { field: "price", type: "number", required: true, nullable: false, constraints: { min: 0 } }
 * ];
 * buildJsonSchema(rows);
 * // Expected Output:
 * // {
 * //   type: "object",
 * //   required: ["title", "price"],
 * //   additionalProperties: false,
 * //   properties: {
 * //     title: { type: "string", minLength: 1 },
 * //     price: { type: "number", minimum: 0 }
 * //   }
 * // }
 */
export function buildJsonSchema(
  rows: FieldRowForSchema[],
  context: SchemaBuildContext = {}
): Record<string, any> {
  const rootSchema: Record<string, any> = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowCtx = { ...context, row: rowIndex + 1, field: row.field };

    if (!row.field || row.field === '-') continue;

    insertFieldIntoSchema(rootSchema, row, rowCtx);
  }

  cleanupSchema(rootSchema);
  return rootSchema;
}
