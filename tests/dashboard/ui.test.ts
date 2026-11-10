import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDashboard, request } from '../../src/modules/dashboard/ui/src/api.js';
import { DashboardView } from '../../src/modules/dashboard/ui/src/components/DashboardView.js';
import type { Workspace } from '../../src/modules/dashboard/ui/src/types.js';

const workspace: Workspace = {
  configName: 'simulator.config.json',
  agreementName: 'agreement.docx',
  baseUrl: 'http://localhost:4700',
  port: 4700,
  seed: '42',
  endpointCount: 1,
  collectionCount: 0
};

describe('dashboard HTTP client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['GET', 'POST', 'DELETE'])(
    'uses the iframe server origin and omits JSON content type for bodyless %s requests',
    async (method) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }))
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(request('/workspace/reset', { method })).resolves.toEqual({ ok: true });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/_moksy/api/workspace/reset');
      expect(init?.method).toBe(method);
      expect(new Headers(init?.headers).has('content-type')).toBe(false);
    }
  );

  it('sends override JSON with its content type and preserves caller headers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 500 }))
    );
    vi.stubGlobal('fetch', fetchMock);
    const body = JSON.stringify({ status: 500 });

    await request('/endpoints/GET%20%2Fproducts/override', {
      method: 'PUT', body, headers: { 'x-request-id': 'override-test' }
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.body).toBe(body);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-request-id')).toBe('override-test');
  });

  it('accepts empty successful responses and surfaces server error messages', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Status not allowed' }), {
        status: 400
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/endpoints/key/override', { method: 'DELETE' })).resolves.toBeUndefined();
    await expect(request('/endpoints/key/override', {
      method: 'PUT', body: JSON.stringify({ status: 999 })
    })).rejects.toThrow('Status not allowed');
  });

  it('loads visible dashboard data without depending on the hidden Testing feature', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(workspace)))
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    const { signal } = new AbortController();

    await expect(loadDashboard(signal)).resolves.toEqual({
      workspace, endpoints: [], collections: []
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/_moksy/api/workspace', '/_moksy/api/endpoints', '/_moksy/api/collections'
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => init?.signal === signal)).toBe(true);
  });
});

describe('dashboard presentation', () => {
  it('renders Setup and APIs while keeping Testing hidden and displaying action feedback', () => {
    const markup = renderToStaticMarkup(createElement(DashboardView, {
      workspace,
      endpointCount: 1,
      tab: 'setup',
      notice: 'Workspace reloaded',
      error: 'Could not apply response',
      pending: false,
      children: 'Current runtime',
      onTabChange: vi.fn(),
      onCopyUrl: vi.fn()
    }));

    expect(markup).toContain('Setup');
    expect(markup).toContain('APIs');
    expect(markup).not.toContain('Testing');
    expect(markup).toContain('Current runtime');
    expect(markup).toContain('localhost:4700');
    expect(markup).toContain('role="status">Workspace reloaded');
    expect(markup).toContain('role="alert">Could not apply response');
  });
});
