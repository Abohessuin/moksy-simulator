import process from 'node:process';
import { SERVER_MESSAGES } from '../common/messages.js';
import { createApp } from './app.js';
import { formatStartupBanner } from './banner.js';
import { ServerInstance, ServerOptions } from './types.js';

export { createApp } from './app.js';
export { formatStartupBanner } from './banner.js';
export * from './constants.js';
export * from './types.js';

/**
 * Boots the Fastify HTTP server and listens on the configured host and port.
 * Prints the terminal startup banner and registers clean process termination handlers.
 * @param {ServerOptions} options - Server configuration and parsed agreement.
 * @returns {Promise<ServerInstance>} Running server instance with close() helper.
 * @example
 * const server = await startServer({ config, agreement });
 * console.log("Server running!");
 * await server.close();
 */
export async function startServer(options: ServerOptions): Promise<ServerInstance> {
  const app = createApp(options);
  const host = options.config.host || '127.0.0.1';
  const port = options.config.port || 4500;

  let isClosing = false;
  async function gracefulShutdown(signal: string) {
    if (isClosing) return;
    isClosing = true;
    console.log('\n' + SERVER_MESSAGES.SHUTDOWN_SIGNAL(signal));
    try {
      await app.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

  const address = await app.listen({ host, port });
  console.log(formatStartupBanner(address, options.agreement.endpoints));

  return {
    app,
    listen: async () => address,
    close: async () => {
      await app.close();
    }
  };
}
