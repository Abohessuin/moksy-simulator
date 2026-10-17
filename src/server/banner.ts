import { NormalizedEndpoint } from '../modules/agreement/types.js';

/**
 * Formats a clean terminal banner displayed when Moksy mock server starts.
 * @param {string} serverUrl - The base URL where the server is listening.
 * @param {NormalizedEndpoint[]} endpoints - List of mounted mock endpoints.
 * @returns {string} Formatted startup banner string.
 */
export function formatStartupBanner(serverUrl: string, endpoints: NormalizedEndpoint[]): string {
  const lines = [
    '==============================================================',
    '  Moksy API Simulator — Mock Server Running',
    '==============================================================',
    `  Listening at: ${serverUrl}`,
    `  Endpoints   : ${endpoints.length} active`,
    '--------------------------------------------------------------'
  ];

  for (const ep of endpoints) {
    const methodPad = ep.method.padEnd(6, ' ');
    lines.push(`  ${methodPad} ${ep.path} (Success: ${ep.successStatus})`);
  }

  lines.push('==============================================================');
  lines.push('  Press Ctrl+C to stop the server.');
  lines.push('');

  return lines.join('\n');
}
