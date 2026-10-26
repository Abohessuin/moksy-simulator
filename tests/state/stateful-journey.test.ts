import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import { SimulatorConfig } from '../../src/modules/config/types.js';
import { createApp } from '../../src/server/app.js';

describe('stateful collection journey', () => {
  const agreementPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');
  const apps: FastifyInstance[] = [];
  const config: SimulatorConfig = {
    host: '127.0.0.1',
    port: 4500,
    basePath: '',
    allowedOrigins: ['*'],
    seed: 42,
    agreementPath,
    responses: {}
  };

  async function makeApp(
    customConfig: SimulatorConfig = config,
    includePutEndpoint = false
  ): Promise<FastifyInstance> {
    const agreement = loadAndValidateAgreement(agreementPath, customConfig);
    if (includePutEndpoint) {
      const patchEndpoint = agreement.endpoints.find((endpoint) => endpoint.method === 'PATCH')!;
      agreement.endpoints.push({
        ...patchEndpoint,
        apiName: 'Replace product',
        method: 'PUT'
      });
    }
    const app = createApp({
      config: customConfig,
      agreement
    });
    await app.ready();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('persists create, read, patch, filter, and delete operations in one server session', async () => {
    const app = await makeApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Ahmed Laptop',
        price: 850,
        category: 'electronics',
        tags: ['work']
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.payload);
    expect(created.name).toBe('Ahmed Laptop');
    expect(created.id).toBeDefined();

    const readResponse = await app.inject({ method: 'GET', url: `/products/${created.id}` });
    expect(readResponse.statusCode).toBe(200);
    expect(JSON.parse(readResponse.payload)).toEqual(created);

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/products/${created.id}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Ahmed Work Laptop', price: 900 }
    });
    expect(patchResponse.statusCode).toBe(200);
    const updated = JSON.parse(patchResponse.payload);
    expect(updated.name).toBe('Ahmed Work Laptop');
    expect(updated.price).toBe(900);
    expect(updated.category).toBe('electronics');

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/products?search=Ahmed&category=electronics&page=1&pageSize=5'
    });
    expect(searchResponse.statusCode).toBe(200);
    const searchBody = JSON.parse(searchResponse.payload);
    expect(searchBody.data.some((record: any) => record.id === created.id)).toBe(true);
    expect(searchBody.data.length).toBeLessThanOrEqual(5);

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/products/${created.id}` });
    expect(deleteResponse.statusCode).toBe(204);

    const missingResponse = await app.inject({ method: 'GET', url: `/products/${created.id}` });
    expect(missingResponse.statusCode).toBe(404);
    expect(JSON.parse(missingResponse.payload).message).toBeDefined();
  });

  it('recreates the same initial collection from the same seed after restart', async () => {
    const firstApp = await makeApp();
    const first = await firstApp.inject({ method: 'GET', url: '/products?page=1&pageSize=10' });
    await firstApp.close();
    apps.splice(apps.indexOf(firstApp), 1);

    const secondApp = await makeApp();
    const second = await secondApp.inject({ method: 'GET', url: '/products?page=1&pageSize=10' });
    expect(JSON.parse(second.payload)).toEqual(JSON.parse(first.payload));
  });

  it('replaces a stored record through a conventional PUT item endpoint', async () => {
    const app = await makeApp(config, true);
    const createdResponse = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Before replace', price: 10, category: 'books' }
    });
    const created = JSON.parse(createdResponse.payload);

    const replaceResponse = await app.inject({
      method: 'PUT',
      url: `/products/${created.id}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'After replace', price: 25, category: 'electronics' }
    });
    expect(replaceResponse.statusCode).toBe(200);
    const replaced = JSON.parse(replaceResponse.payload);
    expect(replaced.id).toBe(created.id);
    expect(replaced.name).toBe('After replace');
    expect(replaced.price).toBe(25);
    expect(replaced.category).toBe('electronics');
  });

  it('does not mutate the collection when a configured failure is selected', async () => {
    const failureConfig: SimulatorConfig = {
      ...config,
      responses: { 'POST /products': 500 }
    };
    const app = await makeApp(failureConfig);
    const before = await app.inject({ method: 'GET', url: '/products?search=FailureOnly' });

    const failedCreate = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'FailureOnly', price: 20, category: 'books' }
    });
    expect(failedCreate.statusCode).toBe(500);

    const after = await app.inject({ method: 'GET', url: '/products?search=FailureOnly' });
    expect(JSON.parse(after.payload).data).toEqual(JSON.parse(before.payload).data);
  });
});
