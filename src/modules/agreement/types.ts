import { AuthType, BodyContentType, ErrorTrigger, FieldLocation, FieldType, HttpMethod } from '../../common/types.js';

export interface FieldConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  enum?: (string | number | boolean)[];
  pattern?: string;
  default?: any;
  nullable?: boolean;
}

export interface ParsedRequestField {
  field: string;
  location: FieldLocation;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  constraints: FieldConstraints;
  defaultValue?: any;
}

export interface ParsedResponseField {
  field: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  constraints: FieldConstraints;
}

export interface ParsedErrorField {
  status: number;
  trigger: ErrorTrigger;
  field: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  constraints: FieldConstraints;
}

export interface NormalizedEndpoint {
  apiName: string;
  method: HttpMethod;
  path: string;
  pathParamNames: string[];
  authentication: AuthType;
  requestBodyContentType: BodyContentType;
  successStatus: number;
  successBodyContentType: BodyContentType;
  requestFields: ParsedRequestField[];
  pathSchema?: any;
  querySchema?: any;
  headerSchema?: any;
  bodySchema?: any;
  successResponseSchema?: any;
  errorResponses: Record<number, { trigger: ErrorTrigger; schema?: any }>;
}

export interface NormalizedAgreement {
  filePath?: string;
  endpoints: NormalizedEndpoint[];
}
