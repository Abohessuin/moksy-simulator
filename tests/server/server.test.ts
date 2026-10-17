import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import { createApp } from '../../src/server/app.js';
import { SimulatorConfig } from '../../src/modules/config/types.js';

describe('Fastify HTTP Server Integration', () => {
  const sampleDocxPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');
  let app: FastifyInstance;

  const baseConfig: SimulatorConfig = {
    host: '127.0.0.1',
    port: 4500,
    basePath: '',
    allowedOrigins: ['http://localhost:3000'],
    seed: 42,
    agreementPath: sampleDocxPath,
    responses: {
      'GET /products': 200,
      'POST /products': 201
    }
  };

  beforeAll(async () => {
    const agreement = loadAndValidateAgreement(sampleDocxPath);

    // Also add a synthetic 204 endpoint to the agreement to test 204 behavior
    const deleteEndpoint: any = {
      apiName: 'Delete product',
      method: 'DELETE',
      path: '/products/{id}',
      pathParamNames: ['id'],
      authentication: 'none',
      requestBodyContentType: 'none',
      successStatus: 204,
      successBodyContentType: 'none',
      requestFields: [
        { field: 'id', location: 'path', type: 'integer', required: true, nullable: false, constraints: {} }
      ],
      pathSchema: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id']
      },
      errorResponses: {
        400: { trigger: 'validation' }
      }
    };

    agreement.endpoints.push(deleteEndpoint);

    app = createApp({ config: baseConfig, agreement });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles GET /products returning real HTTP 200 and generated dummy data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/products?pageSize=5&category=books'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');

    const json = JSON.parse(res.payload);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('handles POST /products returning real HTTP 201 on valid request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        name: 'Smart Watch',
        price: 199.99,
        category: 'electronics',
        inStock: true,
        tags: ['gadget', 'wearable']
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.headers['content-type']).toContain('application/json');

    const json = JSON.parse(res.payload);
    expect(json.id).toBeDefined();
    expect(json.name).toBeDefined();
  });

  it('validation failure takes precedence over a statically selected 500 status', async () => {
    // Create an instance where POST /products is forced to 500
    const agreement = loadAndValidateAgreement(sampleDocxPath);
    const forced500Config: SimulatorConfig = {
      ...baseConfig,
      responses: {
        'POST /products': 500
      }
    };
    const appWith500 = createApp({ config: forced500Config, agreement });
    await appWith500.ready();

    // Send an INVALID request (price is string instead of number)
    const res = await appWith500.inject({
      method: 'POST',
      url: '/products',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        name: 'Item',
        price: 'invalid-price-string'
      }
    });

    // Must return 400 Bad Request because validation precedes forced response!
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.message).toContain('Request validation failed');

    await appWith500.close();
  });

  it('returns selected 500 error when request is valid and 500 is configured', async () => {
    const agreement = loadAndValidateAgreement(sampleDocxPath);
    const forced500Config: SimulatorConfig = {
      ...baseConfig,
      responses: {
        'GET /products': 500
      }
    };
    const appWith500 = createApp({ config: forced500Config, agreement });
    await appWith500.ready();

    const res = await appWith500.inject({
      method: 'GET',
      url: '/products'
    });

    expect(res.statusCode).toBe(500);
    const json = JSON.parse(res.payload);
    expect(json.message).toBeDefined();

    await appWith500.close();
  });

  it('handles 204 No Content returning status 204 and empty body', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/products/42'
    });

    expect(res.statusCode).toBe(204);
    expect(res.payload).toBe('');
  });

  it('returns HTTP 404 on unknown route with structured JSON error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/non-existent-endpoint'
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Not Found');
    expect(json.message).toContain('Route GET /non-existent-endpoint not found');
  });

  it('returns HTTP 400 with agreed error structure on malformed JSON payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      headers: {
        'content-type': 'application/json'
      },
      payload: '{ broken json: true'
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.message).toBe('Malformed JSON in request body');
  });

  it('handles browser preflight OPTIONS request returning CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/products',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization'
      }
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});
