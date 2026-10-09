import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { validateConfig } from '../../src/modules/config/config-validator.js';
import { loadConfig, loadConfigFromObject } from '../../src/modules/config/config-loader.js';
import { MoksyConfigError } from '../../src/common/errors.js';

describe('config-validator & config-loader', () => {
  it('validates a correct minimal config with defaults', () => {
    const valid = validateConfig({
      agreementPath: './templates/API_Agreement_Two_Examples.docx'
    });
    expect(valid.host).toBe('127.0.0.1');
    expect(valid.port).toBe(4500);
    expect(valid.basePath).toBe('');
    expect(valid.allowedOrigins).toEqual(['*']);
    expect(valid.agreementPath).toBe('./templates/API_Agreement_Two_Examples.docx');
  });

  it('validates and normalizes responses map', () => {
    const valid = validateConfig({
      agreementPath: './templates/API_Agreement_Two_Examples.docx',
      responses: {
        'get /products': 200,
        'post /products': 201
      }
    });
    expect(valid.responses).toEqual({
      'GET /products': 200,
      'POST /products': 201
    });
  });

  it('rejects invalid port', () => {
    expect(() => validateConfig({ agreementPath: './test.docx', port: 70000 })).toThrow(MoksyConfigError);
    expect(() => validateConfig({ agreementPath: './test.docx', port: -1 })).toThrow(MoksyConfigError);
  });

  it('rejects invalid response key or status', () => {
    expect(() => validateConfig({ agreementPath: './test.docx', responses: { 'INVALID /foo': 200 } })).toThrow(MoksyConfigError);
    expect(() => validateConfig({ agreementPath: './test.docx', responses: { 'GET products': 200 } })).toThrow(MoksyConfigError);
    expect(() => validateConfig({ agreementPath: './test.docx', responses: { 'GET /products': 999 } })).toThrow(MoksyConfigError);
  });

  it('loads config with CLI overrides and resolves existing agreement path', () => {
    const config = loadConfig({
      agreementPath: 'templates/API_Agreement_Two_Examples.docx',
      port: 5000,
      host: '0.0.0.0'
    });
    expect(config.port).toBe(5000);
    expect(config.host).toBe('0.0.0.0');
    expect(path.isAbsolute(config.agreementPath)).toBe(true);
  });

  it('throws error if agreement file does not exist', () => {
    expect(() => loadConfig({ agreementPath: './non-existent-file.docx' })).toThrow(MoksyConfigError);
  });

  it('validates configuration directly in memory via loadConfigFromObject', () => {
    const config = loadConfigFromObject({
      agreementPath: 'memory-doc.docx',
      port: 8080,
      host: 'localhost',
      responses: {
        'GET /test': 200
      }
    });
    expect(config.port).toBe(8080);
    expect(config.host).toBe('localhost');
    expect(config.responses).toEqual({ 'GET /test': 200 });
  });
});
