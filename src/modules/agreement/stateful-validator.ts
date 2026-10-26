import { MoksyAgreementError } from '../../common/errors.js';
import { inferStatefulOperation } from '../state/utils/operation-resolver.js';
import { canonicalRecordSchema, findListShape, hasSchemaField } from '../state/utils/schema-utils.js';
import { STATE_AGREEMENT_MESSAGES } from './messages.js';
import type { NormalizedEndpoint } from './types.js';

type EndpointRule = (endpoint: NormalizedEndpoint, operation: string | null, filePath?: string) => void;

const endpointContext = (endpoint: NormalizedEndpoint, filePath?: string) => ({
  filePath,
  endpoint: `${endpoint.method} ${endpoint.path}`
});

const requireKnownOperation: EndpointRule = (endpoint, operation, filePath) => {
  if (!operation) throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.CRUD_SHAPE_REQUIRED, endpointContext(endpoint, filePath));
};

const requireSinglePathParameter: EndpointRule = (endpoint, _operation, filePath) => {
  if (endpoint.pathParamNames.length > 1) {
    throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.SINGLE_PATH_PARAMETER_REQUIRED, endpointContext(endpoint, filePath));
  }
};

const requireNotFoundResponse: EndpointRule = (endpoint, operation, filePath) => {
  const itemOperations = new Set(['read', 'patch', 'replace', 'delete']);
  if (operation && itemOperations.has(operation) && endpoint.errorResponses[404]?.trigger !== 'not_found') {
    throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.NOT_FOUND_RESPONSE_REQUIRED, {
      ...endpointContext(endpoint, filePath), section: 'Error responses'
    });
  }
};

const restrictBehaviorToLists: EndpointRule = (endpoint, operation, filePath) => {
  if (operation !== 'list' && endpoint.requestFields.some(({ behavior }) => behavior)) {
    throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.BEHAVIOR_LIST_ONLY, {
      ...endpointContext(endpoint, filePath), section: 'Request fields'
    });
  }
};

const ENDPOINT_RULES: EndpointRule[] = [
  requireKnownOperation,
  requireSinglePathParameter,
  requireNotFoundResponse,
  restrictBehaviorToLists
];

function groupCollections(endpoints: NormalizedEndpoint[], filePath?: string): Map<string, NormalizedEndpoint[]> {
  return endpoints.reduce((groups, endpoint) => {
    if (!endpoint.collection) return groups;
    const operation = inferStatefulOperation(endpoint);
    ENDPOINT_RULES.forEach((rule) => rule(endpoint, operation, filePath));
    groups.set(endpoint.collection, [...(groups.get(endpoint.collection) ?? []), endpoint]);
    return groups;
  }, new Map<string, NormalizedEndpoint[]>());
}

function validateSingletonBehaviors(endpoint: NormalizedEndpoint, filePath?: string): void {
  const fields = endpoint.requestFields.filter(({ behavior }) => behavior);
  ['page', 'pageSize'].forEach((kind) => {
    if (fields.filter(({ behavior }) => behavior?.kind === kind).length > 1) {
      throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.SINGLE_BEHAVIOR(kind), {
        ...endpointContext(endpoint, filePath), section: 'Request fields'
      });
    }
  });
}

function validateBehaviorTargets(
  endpoint: NormalizedEndpoint, recordSchema: Record<string, any>, collection: string, filePath?: string
): void {
  endpoint.requestFields.filter(({ behavior }) => behavior && 'recordField' in behavior)
    .forEach((field) => {
      const behavior = field.behavior as { recordField: string };
      if (!hasSchemaField(recordSchema, behavior.recordField)) {
        throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.BEHAVIOR_TARGET_MISSING(behavior.recordField, collection), {
          ...endpointContext(endpoint, filePath), section: 'Request fields', field: field.field
        });
      }
    });
}

function validateCollection(name: string, endpoints: NormalizedEndpoint[], filePath?: string): void {
  const lists = endpoints.filter((endpoint) => inferStatefulOperation(endpoint) === 'list');
  if (lists.length > 1) throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.SINGLE_LIST_ENDPOINT(name), { filePath });
  const recordSchema = canonicalRecordSchema(endpoints);
  if (lists[0]) {
    const listSchema = findListShape(lists[0]).itemSchema;
    validateSingletonBehaviors(lists[0], filePath);
    validateBehaviorTargets(lists[0], listSchema, name, filePath);
  }
  if (!recordSchema?.properties?.id) {
    throw new MoksyAgreementError(STATE_AGREEMENT_MESSAGES.ID_FIELD_REQUIRED(name), { filePath });
  }
}

export function validateStatefulCollections(endpoints: NormalizedEndpoint[], filePath?: string): void {
  groupCollections(endpoints, filePath).forEach((collectionEndpoints, name) =>
    validateCollection(name, collectionEndpoints, filePath));
}
