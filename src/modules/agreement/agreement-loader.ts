import { readDocxElements } from '../docx/docx-reader.js';
import { extractEndpointBlocks } from '../docx/table-extractor.js';
import { normalizeAgreement } from './agreement-normalizer.js';
import { validateStartup } from './startup-validator.js';
import { NormalizedAgreement } from './types.js';
import { SimulatorConfig } from '../config/types.js';

/**
 * Loads, normalizes, and validates an API agreement from a .docx file path or an in-memory Buffer.
 * Supports both CLI file-based execution and programmatic / UI file upload execution.
 * @param {string | Buffer} docxPathOrBuffer - Absolute/relative path to a .docx file or an in-memory file Buffer.
 * @param {SimulatorConfig} [config] - Optional simulator configuration to validate static responses against.
 * @returns {NormalizedAgreement} Fully parsed and validated normalized agreement with in-memory schemas.
 * @throws {MoksyAgreementError} If the agreement table syntax or startup invariants are violated.
 * @throws {MoksyConfigError} If a selected static response is not defined in the agreement.
 */
export function loadAndValidateAgreement(
  docxPathOrBuffer: string | Buffer,
  config?: SimulatorConfig
): NormalizedAgreement {
  const elements = readDocxElements(docxPathOrBuffer);
  const blocks = extractEndpointBlocks(elements);
  const sourceLabel = typeof docxPathOrBuffer === 'string' ? docxPathOrBuffer : 'in-memory-upload.docx';
  const agreement = normalizeAgreement(blocks, sourceLabel);
  validateStartup(agreement, config);
  return agreement;
} 
