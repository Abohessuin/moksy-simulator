import { describe, it, expect } from 'vitest';
import { adaptFastifyRequest, convertPathToFastifySyntax } from '../../src/server/route-adapter.js';

describe('route-adapter', () => {
  it('converts OpenAPI path parameters to Fastify colon format', () => {
    expect(convertPathToFastifySyntax('/products')).toBe('/products');
    expect(convertPathToFastifySyntax('/categories/{id}')).toBe('/categories/:id');
    expect(convertPathToFastifySyntax('/users/{userId}/orders/{orderId}/items')).toBe('/users/:userId/orders/:orderId/items');
  });

  it('adapts Fastify request into protocol-agnostic EngineRequest', () => {
    const mockFastifyReq: any = {
      method: 'post',
      url: '/products?page=2',
      params: { id: '10' },
      query: { page: '2' },
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token'
      },
      body: { name: 'Sample' }
    };

    const engineReq = adaptFastifyRequest(mockFastifyReq);

    expect(engineReq.method).toBe('POST');
    expect(engineReq.path).toBe('/products');
    expect(engineReq.params).toEqual({ id: '10' });
    expect(engineReq.query).toEqual({ page: '2' });
    expect(engineReq.headers['content-type']).toBe('application/json');
    expect(engineReq.body).toEqual({ name: 'Sample' });
  });
});
