import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readDocxElements } from '../../src/modules/docx/docx-reader.js';
import { extractEndpointBlocks } from '../../src/modules/docx/table-extractor.js';

describe('docx-reader & table-extractor', () => {
  const sampleDocxPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');

  it('reads docx elements in sequence', () => {
    const elements = readDocxElements(sampleDocxPath);
    expect(elements.length).toBeGreaterThan(10);
    const tables = elements.filter((el) => el.type === 'table');
    expect(tables.length).toBe(15); // 3 tables per endpoint * 5 endpoints
  });

  it('extracts two endpoint blocks with all tables intact', () => {
    const elements = readDocxElements(sampleDocxPath);
    const blocks = extractEndpointBlocks(elements);

    expect(blocks.length).toBe(5);

    // Endpoint 1: List products
    const ep1 = blocks[0];
    expect(ep1.metadata.apiName).toBe('List products');
    expect(ep1.metadata.method).toBe('GET');
    expect(ep1.metadata.path).toBe('/products');
    expect(ep1.metadata.successStatus).toBe('200');
    expect(ep1.metadata.successBody).toBe('json');
    expect(ep1.metadata.collection).toBe('products');
    expect(ep1.requestFieldsTable?.headers).toContain('Behavior');
    expect(ep1.requestFieldsTable?.rows.length).toBe(4);
    expect(ep1.successResponseTable?.rows.length).toBe(7);
    expect(ep1.errorResponsesTable?.rows.length).toBe(2);

    // Endpoint 2: Create product
    const ep2 = blocks[1];
    expect(ep2.metadata.apiName).toBe('Create product');
    expect(ep2.metadata.method).toBe('POST');
    expect(ep2.metadata.path).toBe('/products');
    expect(ep2.metadata.successStatus).toBe('201');
    expect(ep2.metadata.requestBody).toBe('json');
    expect(ep2.metadata.collection).toBe('products');
    expect(ep2.requestFieldsTable?.rows.length).toBe(6);
    expect(ep2.successResponseTable?.rows.length).toBe(7);
    expect(ep2.errorResponsesTable?.rows.length).toBe(2);

    expect(blocks[2].metadata.path).toBe('/products/{id}');
    expect(blocks[2].metadata.method).toBe('GET');
    expect(blocks[3].metadata.method).toBe('PATCH');
    expect(blocks[4].metadata.method).toBe('DELETE');
  });
});
