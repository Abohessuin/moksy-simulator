import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import { generateResponse } from '../../src/modules/engine/generation/response-generator.js';
import { createPrng } from '../../src/modules/engine/generation/prng.js';
import { NormalizedEndpoint } from '../../src/modules/agreement/types.js';

describe('response-generator', () => {
  const sampleDocxPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');
  let getEndpoint: NormalizedEndpoint;
  let postEndpoint: NormalizedEndpoint;

  beforeAll(() => {
    const agreement = loadAndValidateAgreement(sampleDocxPath);
    getEndpoint = agreement.endpoints.find((ep) => ep.method === 'GET')!;
    postEndpoint = agreement.endpoints.find((ep) => ep.method === 'POST')!;
  });

  it('generates a valid 200 response with nested data array for GET /products', () => {
    const prng = createPrng(42);
    const response = generateResponse(getEndpoint, undefined, prng);

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);

    if (response.body.data.length > 0) {
      const item = response.body.data[0];
      expect(typeof item.id).toBe('number');
      expect(item.id).toBeGreaterThanOrEqual(1);
      expect(item.id).toBeLessThanOrEqual(1000000);
      expect(typeof item.name).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(['books', 'electronics', 'clothes']).toContain(item.category);
      expect(typeof item.inStock).toBe('boolean');
    }
  });

  it('generates a valid 201 response with tags array for POST /products', () => {
    const prng = createPrng(100);
    const response = generateResponse(postEndpoint, undefined, prng);

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(typeof response.body.id).toBe('number');
    expect(typeof response.body.name).toBe('string');
    expect(typeof response.body.price).toBe('number');
    expect(typeof response.body.inStock).toBe('boolean');
    expect(Array.isArray(response.body.tags)).toBe(true);
  });

  it('returns status 204 with no body for 204 endpoints', () => {
    const deleteEndpoint: NormalizedEndpoint = {
      ...getEndpoint,
      method: 'DELETE',
      path: '/products/{id}',
      successStatus: 204,
      successBodyContentType: 'none',
      successResponseSchema: undefined
    };

    const response = generateResponse(deleteEndpoint);
    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
  });

  it('generates agreed error body when status 500 is selected in static configuration', () => {
    const config: any = {
      responses: {
        'GET /products': 500
      }
    };

    const response = generateResponse(getEndpoint, config);
    expect(response.status).toBe(500);
    expect(response.body).toBeDefined();
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThanOrEqual(1);
  });

  it('generates identical response payloads when given identical seeds', () => {
    const config1: any = { seed: 98765 };
    const config2: any = { seed: 98765 };

    const response1 = generateResponse(getEndpoint, config1);
    const response2 = generateResponse(getEndpoint, config2);

    expect(response1.status).toBe(response2.status);
    expect(response1.body).toEqual(response2.body);
  });
});
