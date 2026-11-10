import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getMoksyServerOrigin,
  type MoksyConnectionConfig
} from '../../src/modules/config/server-address.js';
import type { MoksyDevtools } from '../../src/react/MoksyDevtools.js';

describe('configured Moksy server origin', () => {
  it.each<[MoksyConnectionConfig, string]>([
    [{}, 'http://127.0.0.1:4500'],
    [{ port: 4700 }, 'http://127.0.0.1:4700'],
    [{ host: 'localhost', port: 4800 }, 'http://localhost:4800'],
    [{ host: '0.0.0.0' }, 'http://127.0.0.1:4500'],
    [{ host: '::' }, 'http://[::1]:4500'],
    [{ host: '[::]' }, 'http://[::1]:4500'],
    [{ host: '::1', port: 4600 }, 'http://[::1]:4600'],
    [{ host: '[2001:db8::1]' }, 'http://[2001:db8::1]:4500']
  ])('maps %j to a browser-reachable address', (config, expected) => {
    expect(getMoksyServerOrigin(config)).toBe(expected);
  });
});

describe('packaged React devtools', () => {
  const bundlePath = path.resolve(process.cwd(), 'dist/react/index.js');
  let Devtools: typeof MoksyDevtools;

  beforeAll(async () => {
    const module = await import(bundlePath);
    Devtools = module.MoksyDevtools;
  });

  it('renders only the launcher until opened', () => {
    const markup = renderToStaticMarkup(createElement(Devtools, { config: {} }));
    expect(markup).toContain('aria-label="Open Moksy Devtools"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('role="dialog"');
  });

  it('opens the dashboard at the configured origin independently of the mock API base path', () => {
    const config = { host: 'localhost', port: 4701, basePath: '/api/v2' };
    const markup = renderToStaticMarkup(createElement(Devtools, {
      config, initialIsOpen: true, position: 'bottom-left'
    }));

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Close Moksy Devtools"');
    expect(markup).toContain('src="http://localhost:4701/_moksy"');
    expect(markup).not.toContain('/api/v2');
  });

  it('preserves the client boundary and external React without bundling server modules', () => {
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    expect(bundle).toMatch(/^['"]use client['"];?/);
    expect(bundle).toMatch(/from\s+['"]react['"]/);
    expect(bundle).toMatch(/from\s+['"]react\/jsx-runtime['"]/);
    expect(bundle).not.toMatch(/(?:from\s+|import\s*\()['"](?:node:|fastify|@fastify|adm-zip|ajv)/);
    expect(bundle).not.toContain('createDashboardController');
    expect(bundle).not.toContain('loadAndValidateAgreement');
  });
});
