import { describe, it, expect } from 'vitest';
import { validateStartup } from '../../src/modules/agreement/startup-validator.js';
import { NormalizedAgreement } from '../../src/modules/agreement/types.js';
import { MoksyAgreementError, MoksyConfigError } from '../../src/common/errors.js';

describe('startup-validator', () => {
  const baseEndpoint: any = {
    apiName: 'Get Users',
    method: 'GET',
    path: '/users',
    pathParamNames: [],
    authentication: 'none',
    requestBodyContentType: 'none',
    successStatus: 200,
    successBodyContentType: 'json',
    requestFields: [],
    errorResponses: {
      400: { trigger: 'validation' }
    }
  };

  it('rejects duplicate operations', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        { ...baseEndpoint },
        { ...baseEndpoint }
      ]
    };
    expect(() => validateStartup(agreement)).toThrow(MoksyAgreementError);
  });

  it('rejects path parameter missing from request fields table', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        {
          ...baseEndpoint,
          path: '/users/{id}',
          pathParamNames: ['id'],
          requestFields: []
        }
      ]
    };
    expect(() => validateStartup(agreement)).toThrow(MoksyAgreementError);
  });

  it('rejects non-required path parameter', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        {
          ...baseEndpoint,
          path: '/users/{id}',
          pathParamNames: ['id'],
          requestFields: [
            { field: 'id', location: 'path', type: 'integer', required: false, nullable: false, constraints: {} }
          ]
        }
      ]
    };
    expect(() => validateStartup(agreement)).toThrow(MoksyAgreementError);
  });

  it('rejects 204 response that defines a response body', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        {
          ...baseEndpoint,
          successStatus: 204,
          successBodyContentType: 'json',
          successResponseSchema: { type: 'object' }
        }
      ]
    };
    expect(() => validateStartup(agreement)).toThrow(MoksyAgreementError);
  });

  it('rejects endpoints missing a validation error response trigger', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        {
          ...baseEndpoint,
          errorResponses: {
            500: { trigger: 'selected' }
          }
        }
      ]
    };
    expect(() => validateStartup(agreement)).toThrow(MoksyAgreementError);
  });

  it('rejects static config selecting status not defined in agreement', () => {
    const agreement: NormalizedAgreement = {
      endpoints: [
        { ...baseEndpoint }
      ]
    };
    const config: any = {
      agreementPath: 'test.docx',
      responses: {
        'GET /users': 503
      }
    };
    expect(() => validateStartup(agreement, config)).toThrow(MoksyConfigError);
  });
});
