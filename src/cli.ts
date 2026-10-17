import { Command } from 'commander';
import process from 'node:process';
import { formatDiagnosticError } from './common/diagnostic-reporter.js';
import { loadAndValidateAgreement } from './modules/agreement/agreement-loader.js';
import { loadConfig } from './modules/config/config-loader.js';
import { startServer } from './server/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('moksy')
    .description('API Simulator — turns API agreements into callable mock endpoints')
    .version('1.0.0');

  program
    .command('start')
    .description('Start the mock API server from an API agreement and configuration')
    .option('-c, --config <path>', 'Path to configuration file', './simulator.config.json')
    .option('-a, --agreement <path>', 'Path to API agreement (.docx) file')
    .option('-p, --port <number>', 'Port to listen on')
    .option('-H, --host <string>', 'Host address to bind to')
    .action(async (options) => {
      try {
        const config = loadConfig({
          configPath: options.config,
          agreementPath: options.agreement,
          port: options.port,
          host: options.host
        });
        const agreement = loadAndValidateAgreement(config.agreementPath, config);
        await startServer({ config, agreement });
      } catch (err: any) {
        console.error(formatDiagnosticError(err));
        process.exit(1);
      }
    });

  program
    .command('validate')
    .description('Validate an API agreement (.docx) file syntax and constraints without starting the server')
    .requiredOption('-a, --agreement <path>', 'Path to API agreement (.docx) file')
    .action(async (options) => {
      try {
        const agreement = loadAndValidateAgreement(options.agreement);
        console.log(`[Moksy] Agreement "${options.agreement}" is valid.`);
        console.log(`[Moksy] Loaded ${agreement.endpoints.length} endpoint(s):`);
        for (const ep of agreement.endpoints) {
          console.log(`  - ${ep.method} ${ep.path} (Success: ${ep.successStatus})`);
        }
      } catch (err: any) {
        console.error(formatDiagnosticError(err));
        process.exit(1);
      }
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createCli();
  await program.parseAsync(argv);
}
