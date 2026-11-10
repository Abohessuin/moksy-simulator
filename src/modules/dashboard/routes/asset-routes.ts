import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { DASHBOARD_PREFIX } from '../constants.js';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

/**
 * Finds built assets in the bundled library, source workspace, or installed CLI.
 *
 * @returns The dashboard build directory, or `undefined` when assets are unavailable.
 */
function dashboardDirectory(): string | undefined {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(moduleDirectory, 'dashboard'),
    path.resolve(process.cwd(), 'dist/dashboard'),
    path.resolve(process.cwd(), 'node_modules/moksy/dist/dashboard'),
    path.resolve(path.dirname(process.argv[1] ?? ''), '../dist/dashboard')
  ].find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
}

/**
 * Streams a built asset while keeping path traversal and SPA fallbacks inside the dashboard.
 *
 * @param assetPath - The dashboard-relative asset path requested by the browser.
 * @param reply - The Fastify response used to stream the asset.
 * @returns The configured Fastify response.
 */
function sendDashboardAsset(assetPath: string, reply: FastifyReply): FastifyReply {
  const directory = dashboardDirectory();
  if (!directory) {
    return reply.type('text/html; charset=utf-8').send(
      '<!doctype html><div id="root">Dashboard assets are not built. Run <code>npm run build</code>.</div>'
    );
  }

  const requested = assetPath && assetPath !== '/' ? assetPath : 'index.html';
  const resolved = path.resolve(directory, requested);
  const safePath = resolved.startsWith(`${directory}${path.sep}`) && fs.existsSync(resolved)
    ? resolved
    : path.join(directory, 'index.html');
  const contentType = CONTENT_TYPES[path.extname(safePath)] ?? 'application/octet-stream';
  return reply.type(contentType).send(fs.createReadStream(safePath));
}

/**
 * Serves the iframe dashboard page and its JavaScript and CSS assets.
 *
 * @param app - The Fastify server on which dashboard asset routes are registered.
 */
export function registerAssetRoutes(app: FastifyInstance): void {
  app.get(DASHBOARD_PREFIX, async (_request, reply) => sendDashboardAsset('index.html', reply));
  app.get(`${DASHBOARD_PREFIX}/`, async (_request, reply) => reply.redirect(DASHBOARD_PREFIX));
  app.get<{ Params: { '*': string } }>(`${DASHBOARD_PREFIX}/*`, async (request, reply) =>
    sendDashboardAsset(request.params['*'], reply));
}
