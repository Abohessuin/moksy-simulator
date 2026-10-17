import { FieldLocation, HttpMethod } from '../../common/types.js';

/**
 * Protocol-agnostic representation of an incoming HTTP request.
 */
export interface EngineRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * Validated and coerced request data with converted scalar types and injected defaults.
 */
export interface CoercedRequest {
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, string | undefined>;
  body?: any;
}

/**
 * Structured diagnostic details for an individual field validation failure.
 */
export interface ValidationErrorItem {
  location: FieldLocation;
  field: string;
  message: string;
}

/**
 * Result of request validation.
 * Discriminated by 'isValid':
 * - true: coerced request ready for response generation.
 * - false: HTTP status code, formatted agreed error payload, and programmatic errors list.
 */
export type ValidationResult =
  | {
      isValid: true;
      coercedRequest: CoercedRequest;
    }
  | {
      isValid: false;
      status: number;
      errorPayload: Record<string, any>;
      errors: ValidationErrorItem[];
    };
