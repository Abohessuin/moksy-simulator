import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import type { SimulatorConfig } from '../../src/modules/config/types.js';
import { createDashboardController } from '../../src/modules/dashboard/dashboard-controller.js';
import { ScenarioStore } from '../../src/modules/dashboard/scenario-store.js';
import { createStatefulRuntime } from '../../src/modules/state/stateful-runtime.js';
import { createApp } from '../../src/server/app.js';

describe('dashboard module', () => {
  const apps: FastifyInstance[] = [];
  const temporaryDirectories: string[] = [];
  const agreementPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');
  const config: SimulatorConfig = {
    host: '127.0.0.1', port: 4500, basePath: '', allowedOrigins: ['*'], seed: 42,
    agreementPath, responses: {}
  };

  /** Creates a dashboard backed by an isolated scenario file and seeded runtime. */
  async function setup(configOverrides: Partial<SimulatorConfig> = {}) {
    const activeConfig = { ...config, ...configOverrides };
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moksy-dashboard-'));
    temporaryDirectories.push(directory);
    const agreement = loadAndValidateAgreement(agreementPath, activeConfig);
    const runtime = createStatefulRuntime(agreement, activeConfig);
    const controller = createDashboardController(
      { config: activeConfig, agreement, runtime },
      new ScenarioStore(path.join(directory, 'scenarios.json'))
    );
    const app = createApp({ config: activeConfig, agreement, statefulRuntime: runtime, dashboard: controller });
    await app.ready();
    apps.push(app);
    return { app, controller };
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  });

  it('serves the dashboard and projects the active agreement', async () => {
    const { app } = await setup();
    const page = await app.inject({ method: 'GET', url: '/_moksy' });
    expect(page.statusCode).toBe(200);
    expect(page.payload).toContain('id="root"');

    const endpoints = await app.inject({ method: 'GET', url: '/_moksy/api/endpoints' });
    const body = endpoints.json<Array<{ key: string; collection?: string }>>();
    expect(body.some((endpoint) => endpoint.key === 'GET /products')).toBe(true);
    expect(body.some((endpoint) => endpoint.collection === 'products')).toBe(true);
  });

  it('reports the configured server address and keeps dashboard routes outside the API base path', async () => {
    const { app } = await setup({ host: '::', port: 4700, basePath: '/v1' });
    const workspace = await app.inject({ method: 'GET', url: '/_moksy/api/workspace' });
    expect(workspace.statusCode).toBe(200);
    expect(workspace.json()).toMatchObject({
      baseUrl: 'http://[::1]:4700/v1',
      port: 4700,
      seed: '42 · Deterministic'
    });
    expect((await app.inject({ method: 'GET', url: '/v1/products' })).statusCode).toBe(200);
  });

  it('restricts dashboard pages and controls to loopback clients without restricting mock APIs', async () => {
    const { app } = await setup();
    for (const url of ['/_moksy', '/_moksy?embedded=true', '/_moksy/api/workspace', '/_moksy/assets/app.js']) {
      const response = await app.inject({ method: 'GET', url, remoteAddress: '192.0.2.20' });
      expect(response.statusCode).toBe(403);
    }
    for (const remoteAddress of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      const response = await app.inject({ method: 'GET', url: '/_moksy/api/workspace', remoteAddress });
      expect(response.statusCode).toBe(200);
    }
    const mockResponse = await app.inject({ method: 'GET', url: '/products', remoteAddress: '192.0.2.20' });
    expect(mockResponse.statusCode).toBe(200);
  });

  it('applies a live agreed error without mutating state and restores normal behavior', async () => {
    const { app, controller } = await setup();
    const before = controller.snapshotCollections()[0].records.length;
    await app.inject({
      method: 'PUT', url: '/_moksy/api/endpoints/POST%20%2Fproducts/override',
      payload: { status: 500 }
    });
    const forced = await app.inject({
      method: 'POST', url: '/products', headers: { 'content-type': 'application/json' },
      payload: { name: 'Blocked', price: 10, category: 'books' }
    });
    expect(forced.statusCode).toBe(500);
    expect(controller.snapshotCollections()[0].records).toHaveLength(before);

    await app.inject({ method: 'DELETE', url: '/_moksy/api/endpoints/POST%20%2Fproducts/override' });
    const normal = await app.inject({
      method: 'POST', url: '/products', headers: { 'content-type': 'application/json' },
      payload: { name: 'Created', price: 10, category: 'books' }
    });
    expect(normal.statusCode).toBe(201);
    expect(controller.snapshotCollections()[0].records).toHaveLength(before + 1);
  });

  it('records sanitized real traffic, persists a scenario, and replays it', async () => {
    const { app } = await setup();
    await app.inject({ method: 'POST', url: '/_moksy/api/recorder/start' });
    await app.inject({
      method: 'GET', url: '/products?page=1&pageSize=2',
      headers: { authorization: 'Bearer secret-token' }
    });
    await app.inject({ method: 'POST', url: '/_moksy/api/recorder/stop' });
    const recorder = JSON.parse((await app.inject({ method: 'GET', url: '/_moksy/api/recorder' })).payload);
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0].headers.authorization).toBe('[REDACTED]');

    const saved = await app.inject({
      method: 'POST', url: '/_moksy/api/scenarios',
      payload: { name: 'List products', eventIds: [recorder.events[0].id] }
    });
    expect(saved.statusCode).toBe(201);
    const scenario = JSON.parse(saved.payload);
    expect(fs.existsSync(path.join(temporaryDirectories[0], 'scenarios.json'))).toBe(true);

    const run = await app.inject({ method: 'POST', url: `/_moksy/api/scenarios/${scenario.id}/run` });
    expect(JSON.parse(run.payload)).toMatchObject({ passed: 1, failed: 0 });
  });

  it('accepts bodyless reset and recorder commands while restoring data and preserving scenarios', async () => {
    const { app, controller } = await setup();
    const originalRuntime = controller.context.runtime;
    const initialCollections = controller.snapshotCollections();
    const started = await app.inject({ method: 'POST', url: '/_moksy/api/recorder/start' });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ active: true, events: [] });

    const created = await app.inject({
      method: 'POST', url: '/products',
      payload: { name: 'Temporary', price: 10, category: 'books' }
    });
    expect(created.statusCode).toBe(201);
    const stopped = await app.inject({ method: 'POST', url: '/_moksy/api/recorder/stop' });
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json()).toMatchObject({ active: false });
    const events = controller.recordingStatus().events;
    const saved = controller.saveScenario({ name: 'Create product', eventIds: [events[0].id] });
    controller.setOverride('GET /products', 500);
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(500);

    const reset = await app.inject({ method: 'POST', url: '/_moksy/api/workspace/reset' });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ ok: true });
    expect(controller.context.runtime).toBe(originalRuntime);
    expect(controller.snapshotCollections()).toEqual(initialCollections);
    expect(controller.recordingStatus().events).toEqual(events);
    expect(controller.listScenarios()).toEqual([saved]);
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(200);
  });

  it('rejects invalid scenario payloads with a client error', async () => {
    const { app } = await setup();
    const invalidPayloads = [
      { name: 42, eventIds: ['event'] },
      { name: 'Test', eventIds: 'event' },
      { name: 'Test', eventIds: [42] },
      { name: 'Test', eventIds: ['event'], description: 42 }
    ];
    for (const payload of invalidPayloads) {
      const response = await app.inject({ method: 'POST', url: '/_moksy/api/scenarios', payload });
      expect(response.statusCode).toBe(400);
    }
  });
});
