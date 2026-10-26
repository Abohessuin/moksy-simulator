export const STATE_AGREEMENT_MESSAGES = {
  COLLECTION_NAME_INVALID: (collection: string) =>
    `Invalid Collection "${collection}". Use letters, numbers, underscores, or hyphens and start with a letter`,
  BEHAVIOR_INVALID: (behavior: string) =>
    `Invalid request Behavior "${behavior}". Supported values: filter=<field>, search=<field>, page, pageSize`,
  BEHAVIOR_QUERY_ONLY: 'Request Behavior is supported only for query fields',
  CRUD_SHAPE_REQUIRED: 'Collection endpoints must use a conventional CRUD method and path shape',
  SINGLE_PATH_PARAMETER_REQUIRED: 'Stateful item endpoints must contain exactly one path parameter',
  NOT_FOUND_RESPONSE_REQUIRED:
    'Stateful item endpoints must define an agreed 404 error response with trigger "not_found"',
  BEHAVIOR_LIST_ONLY: 'Request Behavior is supported only on stateful list endpoints',
  SINGLE_LIST_ENDPOINT: (collection: string) =>
    `Collection "${collection}" can define only one list endpoint`,
  SINGLE_BEHAVIOR: (kind: string) => `Only one query field may use Behavior "${kind}"`,
  BEHAVIOR_TARGET_MISSING: (field: string, collection: string) =>
    `Behavior target "${field}" is not present in collection "${collection}" records`,
  ID_FIELD_REQUIRED: (collection: string) =>
    `Collection "${collection}" record schema must define an "id" field`
} as const;
