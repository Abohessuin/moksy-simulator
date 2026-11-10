import { DEFAULT_CONFIG, type RawSimulatorConfig } from './types.js';

/** The connection fields shared by the server and the embedded dashboard. */
export type MoksyConnectionConfig = Pick<RawSimulatorConfig, 'host' | 'port'>;

/**
 * Builds a browser-reachable HTTP origin from Moksy's configuration.
 * Uses the server defaults for omitted fields and loopback for wildcard bindings.
 * The agreement's basePath is excluded: dashboard routes live at /_moksy.
 *
 * @param config - Host and port values from the Moksy configuration.
 * @returns A browser-reachable HTTP origin without a trailing slash.
 */
export function getMoksyServerOrigin(config: MoksyConnectionConfig): string {
  const configuredHost = (config.host ?? DEFAULT_CONFIG.host).trim();
  let hostname = configuredHost.replace(/^\[|\]$/g, '');

  if (hostname === '0.0.0.0') hostname = '127.0.0.1';
  if (hostname === '::') hostname = '::1';
  if (hostname.includes(':')) hostname = `[${hostname}]`;

  return `http://${hostname}:${config.port ?? DEFAULT_CONFIG.port}`;
}
