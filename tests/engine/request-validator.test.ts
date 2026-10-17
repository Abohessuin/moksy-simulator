import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import { validateRequest } from '../../src/modules/engine/validation/request-validator.js';
import { EngineRequest } from '../../src/modules/engine/types.js';
import { NormalizedEndpoint } from '../../src/modules/agreement/types.js';

describe('request-validator', () => {
  const sampleDocxPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');
  let getEndpoint: NormalizedEndpoint;
  let postEndpoint: NormalizedEndpoint;

  beforeAll(() => {
    const agreement = loadAndValidateAgreement(sampleDocxPath);
    getEndpoint = agreement.endpoints.find((ep) => ep.method === 'GET')!;
    postEndpoint = agreement.endpoints.find((ep) => ep.method === 'POST')!;
  });

  describe('GET /products (Query parameters, defaults, unknown fields)', () => {
    it('accepts valid query parameters and applies defaults', () => {
      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {
          search: 'laptop',
          category: 'electronics'
        },
        headers: {}
      };

      const result = validateRequest(request, getEndpoint);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.coercedRequest.query.search).toBe('laptop');
        expect(result.coercedRequest.query.category).toBe('electronics');
        expect(result.coercedRequest.query.page).toBe(1); // default applied
        expect(result.coercedRequest.query.pageSize).toBe(10); // default applied
      }
    });

    it('rejects query parameter exceeding maximum bounds', () => {
      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {
          pageSize: '100' // max is 50
        },
        headers: {}
      };

      const result = validateRequest(request, getEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        expect(result.errors).toBeDefined();
        const pageSizeErr = result.errors.find((e) => e.field === 'pageSize');
        expect(pageSizeErr).toBeDefined();
        expect(pageSizeErr!.message).toContain('<= 50');
      }
    });

    it('rejects query parameter with invalid enum choice', () => {
      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {
          category: 'furniture' // allowed: books, electronics, clothes
        },
        headers: {}
      };

      const result = validateRequest(request, getEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        const catErr = result.errors.find((e) => e.field === 'category');
        expect(catErr).toBeDefined();
        expect(catErr!.message).toContain('one of');
      }
    });

    it('rejects unknown query parameters', () => {
      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {
          unknownFilter: 'active'
        },
        headers: {}
      };

      const result = validateRequest(request, getEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        const err = result.errors.find((e) => e.field === 'unknownFilter');
        expect(err).toBeDefined();
        expect(err!.message).toContain('Unknown query parameter');
      }
    });
  });

  describe('POST /products (JSON Body, Content-Type, strict body typing)', () => {
    it('accepts valid JSON body and headers', () => {
      const request: EngineRequest = {
        method: 'POST',
        path: '/products',
        params: {},
        query: {},
        headers: {
          'content-type': 'application/json'
        },
        body: {
          name: 'Wireless Headphones',
          price: 99.99,
          category: 'electronics',
          inStock: true,
          tags: ['audio', 'wireless']
        }
      };

      const result = validateRequest(request, postEndpoint);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.coercedRequest.body.name).toBe('Wireless Headphones');
      }
    });

    it('rejects request with missing Content-Type header when body expected', () => {
      const request: EngineRequest = {
        method: 'POST',
        path: '/products',
        params: {},
        query: {},
        headers: {},
        body: { name: 'Book', price: 10 }
      };

      const result = validateRequest(request, postEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        expect(result.errorPayload.message).toContain('Missing Content-Type');
      }
    });

    it('rejects unsupported media type (e.g. text/plain)', () => {
      const request: EngineRequest = {
        method: 'POST',
        path: '/products',
        params: {},
        query: {},
        headers: {
          'content-type': 'text/plain'
        },
        body: 'name=Book'
      };

      const result = validateRequest(request, postEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(415);
        expect(result.errorPayload.message).toContain('Unsupported Media Type');
      }
    });

    it('rejects unknown properties in JSON body (additionalProperties: false)', () => {
      const request: EngineRequest = {
        method: 'POST',
        path: '/products',
        params: {},
        query: {},
        headers: {
          'content-type': 'application/json'
        },
        body: {
          name: 'Classic Book',
          price: 19.99,
          category: 'books',
          inStock: true,
          tags: ['reading'],
          extraField: 'not-in-agreement'
        }
      };

      const result = validateRequest(request, postEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        expect(result.errors).toBeDefined();
        const err = result.errors.find((e) => e.field === 'extraField');
        expect(err).toBeDefined();
        expect(err!.message).toContain('Unknown property');
      }
    });

    it('strictly rejects string in numeric body field (ZERO implicit body coercion)', () => {
      const request: EngineRequest = {
        method: 'POST',
        path: '/products',
        params: {},
        query: {},
        headers: {
          'content-type': 'application/json'
        },
        body: {
          name: 'Classic Book',
          price: '99.99', // STRING instead of number!
          category: 'books',
          inStock: true,
          tags: ['reading']
        }
      };

      const result = validateRequest(request, postEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(400);
        expect(result.errors).toBeDefined();
        const priceErr = result.errors.find((e) => e.field === 'price');
        expect(priceErr).toBeDefined();
        expect(priceErr!.message).toContain('expected type "number"');
      }
    });
  });

  describe('Authentication validation', () => {
    it('rejects requests missing required Authorization header', () => {
      const authEndpoint: NormalizedEndpoint = {
        ...getEndpoint,
        authentication: 'required'
      };

      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {},
        headers: {}
      };

      const result = validateRequest(request, authEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(401);
        expect(result.errorPayload.message).toContain('Authorization');
      }
    });

    it('rejects invalid Bearer token prefix when bearer auth required', () => {
      const bearerEndpoint: NormalizedEndpoint = {
        ...getEndpoint,
        authentication: 'bearer'
      };

      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {},
        headers: {
          authorization: 'Basic dXNlcjpwYXNz'
        }
      };

      const result = validateRequest(request, bearerEndpoint);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.status).toBe(401);
        expect(result.errorPayload.message).toContain('Bearer token format');
      }
    });

    it('accepts valid Bearer token case-insensitively', () => {
      const bearerEndpoint: NormalizedEndpoint = {
        ...getEndpoint,
        authentication: 'bearer'
      };

      const request: EngineRequest = {
        method: 'GET',
        path: '/products',
        params: {},
        query: {},
        headers: {
          Authorization: 'Bearer test-token-123'
        }
      };

      const result = validateRequest(request, bearerEndpoint);
      expect(result.isValid).toBe(true);
    });
  });
});
