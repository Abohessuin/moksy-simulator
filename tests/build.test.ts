import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('Rsbuild Output & Library Verification', () => {
  const rootDir = process.cwd();
  const distDir = path.resolve(rootDir, 'dist');
  const indexJsPath = path.resolve(distDir, 'index.js');
  const cliJsPath = path.resolve(distDir, 'cli.js');
  const indexDtsPath = path.resolve(distDir, 'index.d.ts');
  const cliDtsPath = path.resolve(distDir, 'cli.d.ts');
  const binScriptPath = path.resolve(rootDir, 'bin/moksy.js');
  const templatePath = path.resolve(rootDir, 'templates/API_Agreement_Two_Examples.docx');

  it('should generate dist/index.js and dist/cli.js without extraneous chunks', () => {
    expect(fs.existsSync(indexJsPath)).toBe(true);
    expect(fs.existsSync(cliJsPath)).toBe(true);
  });

  it('should generate TypeScript declaration files', () => {
    expect(fs.existsSync(indexDtsPath)).toBe(true);
    expect(fs.existsSync(cliDtsPath)).toBe(true);
    const dtsContent = fs.readFileSync(indexDtsPath, 'utf8');
    expect(dtsContent).toContain('export { createCli, runCli }');
    expect(dtsContent).toContain('loadAndValidateAgreement');
  });

  it('should dynamically import dist/index.js and expose all core exports', async () => {
    const library = await import(indexJsPath);
    expect(typeof library.createApp).toBe('function');
    expect(typeof library.createCli).toBe('function');
    expect(typeof library.runCli).toBe('function');
    expect(typeof library.loadConfig).toBe('function');
    expect(typeof library.loadAndValidateAgreement).toBe('function');
    expect(typeof library.normalizeAgreement).toBe('function');
    expect(typeof library.validateStartup).toBe('function');
    expect(typeof library.createStatefulRuntime).toBe('function');
    expect(typeof library.formatDiagnosticError).toBe('function');
    expect(library.DEFAULT_CONFIG).toBeDefined();
  });

  it('should run Fastify app created with dist/index.js exports', async () => {
    const { createApp, loadAndValidateAgreement, DEFAULT_CONFIG } = await import(indexJsPath);
    const agreement = loadAndValidateAgreement(templatePath);
    const app = createApp({
      config: {
        ...DEFAULT_CONFIG,
        agreementPath: templatePath
      },
      agreement
    });

    await app.ready();
    const response = await app.inject({
      method: 'GET',
      url: '/products'
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
    await app.close();
  });

  it('should successfully execute CLI via node bin/moksy.js --help', async () => {
    const { stdout } = await execFileAsync(process.execPath, [binScriptPath, '--help']);
    expect(stdout).toContain('API Simulator');
    expect(stdout).toContain('start [options]');
    expect(stdout).toContain('validate [options]');
  });

  it('should successfully validate template via node bin/moksy.js validate', async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      binScriptPath,
      'validate',
      '-a',
      './templates/API_Agreement_Two_Examples.docx'
    ]);
    expect(stdout).toContain('Agreement "./templates/API_Agreement_Two_Examples.docx" is valid.');
    expect(stdout).toContain('Loaded 5 endpoint(s):');
  });
});
