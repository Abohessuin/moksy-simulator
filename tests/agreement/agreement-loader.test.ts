import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadAndValidateAgreement } from '../../src/modules/agreement/agreement-loader.js';
import { SimulatorConfig } from '../../src/modules/config/types.js';

describe('agreement-loader integration test with user template', () => {
  const sampleDocxPath = path.resolve(process.cwd(), 'templates/API_Agreement_Two_Examples.docx');

  it('successfully loads and validates the two example endpoints from docx', () => {
    const config: SimulatorConfig = {
      host: '127.0.0.1',
      port: 4500,
      basePath: '',
      allowedOrigins: ['*'],
      agreementPath: sampleDocxPath,
      responses: {
        'GET /products': 200,
        'POST /products': 201
      }
    };

    const agreement = loadAndValidateAgreement(sampleDocxPath, config);
    expect(agreement.endpoints.length).toBe(2);

    const [getEp, postEp] = agreement.endpoints;

    // Verify GET /products
    expect(getEp.method).toBe('GET');
    expect(getEp.path).toBe('/products');
    expect(getEp.successStatus).toBe(200);
    expect(getEp.querySchema).toBeDefined();
    expect(getEp.querySchema.properties.search).toBeDefined();
    expect(getEp.querySchema.properties.category).toBeDefined();
    expect(getEp.querySchema.properties.category.enum).toEqual(['books', 'electronics', 'clothes']);
    expect(getEp.querySchema.properties.page.minimum).toBe(1);
    expect(getEp.querySchema.properties.page.default).toBe(1);
    expect(getEp.querySchema.properties.pageSize.maximum).toBe(50);
    expect(getEp.querySchema.properties.pageSize.default).toBe(10);
    expect(getEp.successResponseSchema).toBeDefined();
    expect(getEp.successResponseSchema.properties.data.type).toBe('array');
    expect(getEp.errorResponses[400].trigger).toBe('validation');
    expect(getEp.errorResponses[500].trigger).toBe('selected');

    // Verify POST /products
    expect(postEp.method).toBe('POST');
    expect(postEp.path).toBe('/products');
    expect(postEp.successStatus).toBe(201);
    expect(postEp.bodySchema).toBeDefined();
    expect(postEp.bodySchema.properties.name.minLength).toBe(1);
    expect(postEp.bodySchema.properties.name.maxLength).toBe(100);
    expect(postEp.bodySchema.properties.price.minimum).toBe(0);
    expect(postEp.bodySchema.properties.price.maximum).toBe(10000);
    expect(postEp.bodySchema.properties.inStock.default).toBe(true);
    expect(postEp.bodySchema.properties.tags.type).toBe('array');
    expect(postEp.successResponseSchema).toBeDefined();
    expect(postEp.errorResponses[400].trigger).toBe('validation');
  });

  it('allows selecting static error status (500) if defined in agreement', () => {
    const config: SimulatorConfig = {
      host: '127.0.0.1',
      port: 4500,
      basePath: '',
      allowedOrigins: ['*'],
      agreementPath: sampleDocxPath,
      responses: {
        'GET /products': 500
      }
    };

    const agreement = loadAndValidateAgreement(sampleDocxPath, config);
    expect(agreement.endpoints[0].errorResponses[500]).toBeDefined();
  });

  it('loads and validates agreement directly from an in-memory Buffer (UI upload simulation)', () => {
    const fs = require('node:fs');
    const docxBuffer = fs.readFileSync(sampleDocxPath);
    const agreement = loadAndValidateAgreement(docxBuffer);
    expect(agreement.endpoints.length).toBe(2);
    expect(agreement.endpoints[0].method).toBe('GET');
    expect(agreement.endpoints[1].method).toBe('POST');
  });
});
