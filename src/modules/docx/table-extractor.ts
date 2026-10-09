import { MoksyAgreementError } from '../../common/errors.js';
import { DOCX_MESSAGES } from '../../common/messages.js';
import { DocxElement, RawEndpointBlock, RawEndpointMetadata, RawTable } from './types.js';

type SectionKind = 'request_fields' | 'success_response' | 'error_responses';

const METADATA_KEY_MAP: Record<string, keyof RawEndpointMetadata> = {
  apiname: 'apiName',
  method: 'method',
  path: 'path',
  authentication: 'authentication',
  requestbody: 'requestBody',
  successstatus: 'successStatus',
  successbody: 'successBody'
};

const SECTION_HEADER_PATTERNS: Array<{ section: SectionKind; regex: RegExp }> = [
  { section: 'request_fields', regex: /^\d*\s*request\s+fields$/i },
  { section: 'success_response', regex: /^\d*\s*success\s+response(?:\s+fields)?$/i },
  { section: 'error_responses', regex: /^\d*\s*error\s+responses?$/i }
];

/**
 * Identifies the intended role of a table based on its header column names.
 * @param {RawTable} table - Raw parsed table.
 * @returns {SectionKind | 'unknown'} Identified section role.
 */
export function identifyTableKind(table: RawTable): SectionKind | 'unknown' {
  const normalizedHeaders = table.headers.map((h) => h.toLowerCase().trim());

  if (normalizedHeaders.includes('location')) return 'request_fields';
  if (normalizedHeaders.includes('trigger') || normalizedHeaders.includes('status')) return 'error_responses';
  if (normalizedHeaders.includes('field') && normalizedHeaders.includes('type')) return 'success_response';

  return 'unknown';
}

/**
 * Detects if a paragraph text represents a section heading.
 * @param {string} text - Paragraph text.
 * @returns {SectionKind | null} Section kind or null.
 */
export function detectSectionHeading(text: string): SectionKind | null {
  for (const { section, regex } of SECTION_HEADER_PATTERNS) {
    if (regex.test(text)) {
      return section;
    }
  }
  return null;
}

/**
 * Extracts metadata key and value from a paragraph text line.
 * @param {string} text - Paragraph text.
 * @returns {{ key: keyof RawEndpointMetadata; value: string } | null} Metadata entry or null.
 */
export function extractMetadataEntry(text: string): { key: keyof RawEndpointMetadata; value: string } | null {
  const match = text.match(/^(API\s+name|Method|Path|Authentication|Request\s+body|Success\s+status|Success\s+body):\s*(.*)$/i);
  if (!match) return null;

  const rawKey = match[1].toLowerCase().replace(/\s+/g, '');
  const propertyKey = METADATA_KEY_MAP[rawKey];
  if (!propertyKey) return null;

  return {
    key: propertyKey,
    value: match[2].trim()
  };
}

/**
 * Detects if a paragraph text represents the start of a new endpoint block.
 * Per the template specification: "Start every API with Endpoint: followed by its name."
 * @param {string} text - Paragraph text.
 * @returns {string | null} Endpoint name if found, or null.
 */
export function detectEndpointBoundary(text: string): string | null {
  const endpointMatch = text.match(/^endpoint\s*:\s*(.*)$/i);
  if (endpointMatch) {
    return endpointMatch[1].trim() || 'Untitled Endpoint';
  }
  return null;
}

/**
 * Table assigners dispatch table to the appropriate property on the endpoint block,
 * enforcing that duplicate tables for the same section are rejected.
 */
export const TABLE_ASSIGNERS: Record<
  SectionKind,
  (block: RawEndpointBlock, table: RawTable) => void
> = {
  request_fields: (block, table) => {
    if (block.requestFieldsTable) {
      throw new MoksyAgreementError(DOCX_MESSAGES.DUPLICATE_SECTION_TABLE('Request fields'), {
        endpoint: block.metadata.apiName
      });
    }
    block.requestFieldsTable = table;
  },
  success_response: (block, table) => {
    if (block.successResponseTable) {
      throw new MoksyAgreementError(DOCX_MESSAGES.DUPLICATE_SECTION_TABLE('Success response fields'), {
        endpoint: block.metadata.apiName
      });
    }
    block.successResponseTable = table;
  },
  error_responses: (block, table) => {
    if (block.errorResponsesTable) {
      throw new MoksyAgreementError(DOCX_MESSAGES.DUPLICATE_SECTION_TABLE('Error responses'), {
        endpoint: block.metadata.apiName
      });
    }
    block.errorResponsesTable = table;
  }
};

/**
 * Assigns a table to an endpoint block based on active section heading or header auto-detection.
 * @param {RawEndpointBlock} block - The active endpoint block.
 * @param {RawTable} table - The table to attach.
 * @param {SectionKind | null} activeSection - Current active section.
 */
export function assignTableToBlock(
  block: RawEndpointBlock,
  table: RawTable,
  activeSection: SectionKind | null
): void {
  const autoKind = identifyTableKind(table);
  const targetSection = autoKind !== 'unknown' ? autoKind : activeSection;

  if (targetSection && TABLE_ASSIGNERS[targetSection]) {
    TABLE_ASSIGNERS[targetSection](block, table);
  }
}

/**
 * Processes an individual DocxElement (paragraph or table) into the endpoint aggregation state.
 * @param {DocxElement} el - Document element.
 * @param {EndpointCollectorState} state - Collector state tracking blocks and active section.
 */
export interface EndpointCollectorState {
  blocks: RawEndpointBlock[];
  currentBlock: RawEndpointBlock | null;
  currentSection: SectionKind | null;
}

export function processDocumentElement(el: DocxElement, state: EndpointCollectorState): void {
  if (el.type === 'paragraph' && el.text) {
    const text = el.text.trim();

    // Check 1: Explicit Endpoint boundary (Endpoint: <Name>)
    const endpointName = detectEndpointBoundary(text);
    if (endpointName !== null) {
      finalizeCurrentBlock(state);
      state.currentBlock = {
        metadata: { apiName: endpointName }
      };
      state.currentSection = null;
      return;
    }

    // Check 2: Section Heading
    const sectionHeading = detectSectionHeading(text);
    if (sectionHeading !== null) {
      state.currentSection = sectionHeading;
      return;
    }

    // Check 3: Metadata key-value
    const metaEntry = extractMetadataEntry(text);
    if (metaEntry !== null) {
      if (!state.currentBlock) {
        state.currentBlock = { metadata: {} };
      }
      state.currentBlock.metadata[metaEntry.key] = metaEntry.value;
      return;
    }
  } else if (el.type === 'table' && el.table) {
    if (!state.currentBlock) {
      state.currentBlock = { metadata: {} };
    }
    assignTableToBlock(state.currentBlock, el.table, state.currentSection);
  }
}

/**
 * Finalizes the active block if it has a method, path, or apiName.
 * @param {EndpointCollectorState} state - Collector state.
 */
export function finalizeCurrentBlock(state: EndpointCollectorState): void {
  if (state.currentBlock) {
    const hasMetadata =
      state.currentBlock.metadata.method ||
      state.currentBlock.metadata.path ||
      state.currentBlock.metadata.apiName;

    if (hasMetadata) {
      state.blocks.push(state.currentBlock);
    }
  }
  state.currentBlock = null;
  state.currentSection = null;
}

/**
 * Extracts and groups paragraphs and tables into structured RawEndpointBlock instances.
 * @param {DocxElement[]} elements - Ordered list of document paragraphs and tables.
 * @returns {RawEndpointBlock[]} List of parsed endpoint blocks.
 */
export function extractEndpointBlocks(elements: DocxElement[]): RawEndpointBlock[] {
  const state: EndpointCollectorState = {
    blocks: [],
    currentBlock: null,
    currentSection: null
  };

  for (const el of elements) {
    processDocumentElement(el, state);
  }

  finalizeCurrentBlock(state);
  return state.blocks;
}
