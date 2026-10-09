import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { MoksyAgreementError } from '../../common/errors.js';
import { DOCX_MESSAGES } from '../../common/messages.js';
import { sanitizeWordText } from '../../common/text-sanitizer.js';
import { DocxElement, RawTable } from './types.js';

/**
 * Recursively traverses an XML AST node to extract text content from Word text nodes (<w:t>).
 * @param {unknown} node - XML AST node produced by fast-xml-parser.
 * @returns {string} Concatenated raw text found within the node.
 * @example
 * // Input:
 * const node = { "w:r": [{ "w:t": [{ "#text": "Method: GET" }] }] };
 * // Expected Output:
 * extractTextFromXmlNode(node); // Returns "Method: GET"
 */
export function extractTextFromXmlNode(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;

  const asObj = node as Record<string, unknown>;
  if (asObj['#text']) return String(asObj['#text']);

  let text = '';
  if (Array.isArray(node)) {
    for (const item of node) {
      text += extractTextFromXmlNode(item);
    }
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, val] of Object.entries(asObj)) {
      if (key === ':@') continue;
      text += extractTextFromXmlNode(val);
    }
  }
  return text;
}

/**
 * Opens a .docx ZIP archive from a file path or in-memory Buffer.
 * @param {string | Buffer} input - Path to file or in-memory Buffer.
 * @returns {AdmZip} Open AdmZip instance.
 * @throws {MoksyAgreementError} If the archive cannot be opened.
 * @example
 * // Input from file path:
 * const zip = openZipArchive("./templates/API_Agreement.docx");
 * // Expected Output:
 * // Initialized AdmZip instance
 *
 * @example
 * // Input from uploaded file Buffer:
 * const zipFromBuffer = openZipArchive(uploadedFileBuffer);
 * // Expected Output:
 * // Initialized AdmZip instance
 */
export function openZipArchive(input: string | Buffer): AdmZip {
  try {
    return new AdmZip(input);
  } catch (err: any) {
    throw new MoksyAgreementError(DOCX_MESSAGES.ARCHIVE_OPEN_FAILED(err.message), {
      filePath: typeof input === 'string' ? input : undefined
    });
  }
}

/**
 * Extracts and returns the raw XML string of word/document.xml from an open ZIP archive.
 * @param {AdmZip} zip - Open zip archive.
 * @param {string} [filePath] - Optional file path for error context.
 * @returns {string} Raw XML string content.
 * @throws {MoksyAgreementError} If word/document.xml is missing.
 * @example
 * // Input:
 * const xml = readDocumentXmlFromZip(zip, "doc.docx");
 * // Expected Output:
 * // "<?xml version='1.0' ...?><w:document><w:body>...</w:body></w:document>"
 */
export function readDocumentXmlFromZip(zip: AdmZip, filePath?: string): string {
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new MoksyAgreementError(DOCX_MESSAGES.MISSING_DOCUMENT_XML, { filePath });
  }
  return zip.readAsText(entry);
}

/**
 * Parses raw Word XML string into an ordered AST preserving element sequence.
 * @param {string} xmlContent - Raw document XML content.
 * @param {string} [filePath] - Optional file path for error context.
 * @returns {any[]} Parsed XML node array.
 * @throws {MoksyAgreementError} If XML syntax is invalid.
 * @example
 * // Input:
 * const ast = parseXmlStringToAst("<w:document><w:body><w:p/></w:body></w:document>");
 * // Expected Output:
 * // [{ "w:document": [{ "w:body": [{ "w:p": [] }] }] }]
 */
export function parseXmlStringToAst(xmlContent: string, filePath?: string): any[] {
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  try {
    return parser.parse(xmlContent);
  } catch (err: any) {
    throw new MoksyAgreementError(DOCX_MESSAGES.MALFORMED_XML(err.message), { filePath });
  }
}

/**
 * Extracts the <w:body> element array from a parsed Word XML AST.
 * @param {any[]} ast - Parsed Word XML AST.
 * @param {string} [filePath] - Optional file path for error context.
 * @returns {any[]} List of child elements inside <w:body>.
 * @throws {MoksyAgreementError} If document or body roots are missing.
 * @example
 * // Input:
 * const body = extractDocumentBody(ast);
 * // Expected Output:
 * // [
 * //   { "w:p": [...] },
 * //   { "w:tbl": [...] }
 * // ]
 */
export function extractDocumentBody(ast: any[], filePath?: string): any[] {
  const wDoc = ast.find((n) => n['w:document'])?.['w:document'];
  if (!wDoc) {
    throw new MoksyAgreementError(DOCX_MESSAGES.MISSING_DOCUMENT_ROOT, { filePath });
  }

  const wBody = wDoc.find((n: any) => n['w:body'])?.['w:body'];
  if (!wBody || !Array.isArray(wBody)) {
    throw new MoksyAgreementError(DOCX_MESSAGES.MISSING_BODY_CONTAINER, { filePath });
  }

  return wBody;
}

/**
 * Converts a <w:p> XML node into a sanitized paragraph DocxElement.
 * @param {any} pNode - Paragraph XML AST node.
 * @returns {DocxElement | null} Paragraph element, or null if empty.
 * @example
 * // Input:
 * const pNode = [{ "w:r": [{ "w:t": [{ "#text": "Endpoint: List products" }] }] }];
 * // Expected Output:
 * parseParagraphNode(pNode);
 * // Returns: { type: "paragraph", text: "Endpoint: List products" }
 */
export function parseParagraphNode(pNode: any): DocxElement | null {
  const rawText = extractTextFromXmlNode(pNode);
  const sanitized = sanitizeWordText(rawText);
  if (sanitized.length === 0) return null;

  return {
    type: 'paragraph',
    text: sanitized
  };
}

/**
 * Extracts sanitized cell strings from a <w:tr> XML node.
 * @param {any} trNode - Table row XML AST node.
 * @returns {string[]} List of cell strings.
 * @example
 * // Input:
 * const trNode = [
 *   { "w:tc": [{ "w:p": [{ "w:r": [{ "w:t": [{ "#text": "search" }] }] }] }] },
 *   { "w:tc": [{ "w:p": [{ "w:r": [{ "w:t": [{ "#text": "query" }] }] }] }] }
 * ];
 * // Expected Output:
 * parseTableRow(trNode); // Returns ["search", "query"]
 */
export function parseTableRow(trNode: any): string[] {
  const cells: string[] = [];
  const cellItems = Array.isArray(trNode) ? trNode : [trNode];

  for (const cellItem of cellItems) {
    if (cellItem['w:tc']) {
      const cellRaw = extractTextFromXmlNode(cellItem['w:tc']);
      cells.push(sanitizeWordText(cellRaw));
    }
  }

  return cells;
}

/**
 * Converts a <w:tbl> XML node into a structured table DocxElement.
 * @param {any} tblNode - Table XML AST node.
 * @returns {DocxElement | null} Table element, or null if table has no rows.
 * @example
 * // Input:
 * const tblNode = [
 *   { "w:tr": [{ "w:tc": [...] /* "Field" *\/ }, { "w:tc": [...] /* "Location" *\/ }] },
 *   { "w:tr": [{ "w:tc": [...] /* "search" *\/ }, { "w:tc": [...] /* "query" *\/ }] }
 * ];
 * // Expected Output:
 * parseTableNode(tblNode);
 * // Returns:
 * // {
 * //   type: "table",
 * //   table: {
 * //     headers: ["Field", "Location"],
 * //     rows: [["search", "query"]]
 * //   }
 * // }
 */
export function parseTableNode(tblNode: any): DocxElement | null {
  const rows: string[][] = [];
  const rowItems = Array.isArray(tblNode) ? tblNode : [tblNode];

  for (const item of rowItems) {
    if (item['w:tr']) {
      const row = parseTableRow(item['w:tr']);
      if (row.length > 0) {
        rows.push(row);
      }
    }
  }

  if (rows.length === 0) return null;

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const table: RawTable = {
    headers,
    rows: dataRows
  };

  return {
    type: 'table',
    table
  };
}

/**
 * Dispatcher object mapping XML tag names to their dedicated element parsers.
 */
export const XML_ELEMENT_PARSERS: Record<string, (node: any) => DocxElement | null> = {
  'w:p': parseParagraphNode,
  'w:tbl': parseTableNode
};

/**
 * Reads a Word document (.docx) from a file path or an in-memory Buffer,
 * extracts word/document.xml, and converts paragraphs and tables into an ordered
 * list of sanitized DocxElement items preserving the exact document flow.
 * @param {string | Buffer} docxPathOrBuffer - Absolute/relative path to a .docx file or an in-memory file Buffer.
 * @returns {DocxElement[]} An ordered array of paragraphs and table matrices.
 * @throws {MoksyAgreementError} If the file is not a valid zip archive or lacks valid Word XML structures.
 * @example
 * // Input:
 * const elements = readDocxElements("./templates/API_Agreement_Two_Examples.docx");
 * // Expected Output:
 * // [
 * //   { type: "paragraph", text: "Endpoint: List products" },
 * //   { type: "paragraph", text: "Method: GET" },
 * //   { type: "paragraph", text: "Path: /products" },
 * //   {
 * //     type: "table",
 * //     table: {
 * //       headers: ["Field", "Location", "Type", "Required", "Nullable", "Rules"],
 * //       rows: [
 * //         ["search", "query", "string", "no", "no", "maxLength=100"],
 * //         ["page", "query", "integer", "no", "no", "min=1; default=1"]
 * //       ]
 * //     }
 * //   }
 * // ]
 */
export function readDocxElements(docxPathOrBuffer: string | Buffer): DocxElement[] {
  const filePath = typeof docxPathOrBuffer === 'string' ? docxPathOrBuffer : undefined;
  const zip = openZipArchive(docxPathOrBuffer);
  const xmlContent = readDocumentXmlFromZip(zip, filePath);
  const ast = parseXmlStringToAst(xmlContent, filePath);
  const body = extractDocumentBody(ast, filePath);

  const elements: DocxElement[] = [];

  for (const item of body) {
    for (const [tag, parser] of Object.entries(XML_ELEMENT_PARSERS)) {
      if (item[tag]) {
        const element = parser(item[tag]);
        if (element) {
          elements.push(element);
        }
        break;
      }
    }
  }

  return elements;
}
