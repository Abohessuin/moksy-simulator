export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FieldLocation = 'path' | 'query' | 'header' | 'body';

export type FieldType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';

export type AuthType = 'none' | 'bearer' | 'required';

export type BodyContentType = 'json' | 'none';

export type ErrorTrigger = 'validation' | 'selected' | 'not_found';
