import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { MoksyConfigError } from '../../common/errors.js';
import { CONFIG_MESSAGES } from '../../common/messages.js';
import { validateConfig } from './config-validator.js';
import { RawSimulatorConfig, SimulatorConfig } from './types.js';

export interface LoadConfigOptions {
  configPath?: string;
  agreementPath?: string;
  port?: number | string;
  host?: string;
  cwd?: string;
}

/**
 * Resolves the configuration file path relative to cwd.
 * @param {string} [configPath] - Optional path specified by user.
 * @param {string} [cwd] - Optional working directory.
 * @returns {string | undefined} Absolute file path or undefined if not provided.
 */
export function resolveConfigFilePath(configPath?: string, cwd: string = process.cwd()): string | undefined {
  if (!configPath) return undefined;
  return path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath);
}

/**
 * Reads and parses a JSON configuration file from disk.
 * @param {string} filePath - Absolute path to JSON file.
 * @returns {RawSimulatorConfig} Parsed JSON object.
 * @throws {MoksyConfigError} If file cannot be read or contains malformed JSON.
 */
export function readConfigFile(filePath: string): RawSimulatorConfig {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      throw new MoksyConfigError(CONFIG_MESSAGES.MALFORMED_JSON(err.message), filePath);
    }
    throw new MoksyConfigError(CONFIG_MESSAGES.READ_FAILED(err.message), filePath);
  }
}

/**
 * Merges CLI override options into a raw configuration object.
 * @param {RawSimulatorConfig} base - Base configuration.
 * @param {LoadConfigOptions} options - CLI override options.
 * @returns {RawSimulatorConfig} Merged configuration.
 */
export function mergeConfigOverrides(
  base: RawSimulatorConfig,
  options: LoadConfigOptions
): RawSimulatorConfig {
  const merged: RawSimulatorConfig = { ...base };

  if (options.agreementPath) {
    merged.agreementPath = options.agreementPath;
  }
  if (options.port !== undefined) {
    merged.port = typeof options.port === 'string' ? parseInt(options.port, 10) : options.port;
  }
  if (options.host !== undefined) {
    merged.host = options.host;
  }

  return merged;
}

/**
 * Resolves the agreement file path relative to config file directory or cwd, ensuring it exists.
 * @param {string} rawAgreementPath - Agreement file path declared in settings.
 * @param {string} [configFilePath] - Resolved path to configuration file (if any).
 * @param {string} [cwd] - Current working directory.
 * @returns {string} Absolute path to existing agreement file.
 * @throws {MoksyConfigError} If the agreement file does not exist.
 */
export function resolveAgreementFilePath(
  rawAgreementPath: string,
  configFilePath?: string,
  cwd: string = process.cwd()
): string {
  const baseDir = configFilePath && fs.existsSync(configFilePath)
    ? path.dirname(configFilePath)
    : cwd;

  const resolved = path.isAbsolute(rawAgreementPath)
    ? rawAgreementPath
    : path.resolve(baseDir, rawAgreementPath);

  if (!fs.existsSync(resolved)) {
    throw new MoksyConfigError(CONFIG_MESSAGES.AGREEMENT_NOT_FOUND(resolved), configFilePath);
  }

  return resolved;
}

/**
 * Validates a configuration object directly in memory.
 * Useful for programmatic library consumption or web UI uploads without reading from disk.
 * @param {RawSimulatorConfig} rawConfig - In-memory raw configuration object.
 * @param {string} [sourceContext] - Optional context name or virtual path.
 * @returns {SimulatorConfig} Validated simulator configuration.
 */
export function loadConfigFromObject(
  rawConfig: RawSimulatorConfig,
  sourceContext: string = 'in-memory'
): SimulatorConfig {
  return validateConfig(rawConfig, sourceContext);
}

/**
 * Loads, merges, and validates configuration from disk and CLI options.
 * @param {LoadConfigOptions} [options] - Configuration loading options.
 * @returns {SimulatorConfig} Complete, validated simulator configuration.
 * @throws {MoksyConfigError} If file is missing, malformed, or fails validation.
 */
export function loadConfig(options: LoadConfigOptions = {}): SimulatorConfig {
  const cwd = options.cwd || process.cwd();
  const resolvedConfigPath = resolveConfigFilePath(options.configPath, cwd);

  let rawConfig: RawSimulatorConfig = {};

  if (resolvedConfigPath) {
    if (fs.existsSync(resolvedConfigPath)) {
      rawConfig = readConfigFile(resolvedConfigPath);
    } else if (options.configPath !== './simulator.config.json') {
      throw new MoksyConfigError(CONFIG_MESSAGES.FILE_NOT_FOUND(resolvedConfigPath), resolvedConfigPath);
    }
  }

  const merged = mergeConfigOverrides(rawConfig, options);
  const validated = validateConfig(merged, resolvedConfigPath);
  const resolvedAgreementPath = resolveAgreementFilePath(validated.agreementPath, resolvedConfigPath, cwd);

  return {
    ...validated,
    agreementPath: resolvedAgreementPath
  };
}
