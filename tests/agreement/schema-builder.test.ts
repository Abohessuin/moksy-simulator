import { describe, it, expect } from 'vitest';
import { buildJsonSchema } from '../../src/modules/agreement/schema-builder.js';
import { MoksyAgreementError } from '../../src/common/errors.js';

describe('schema-builder', () => {
  it('builds flat object schema', () => {
    const schema = buildJsonSchema([
      { field: 'name', type: 'string', required: true, nullable: false, constraints: { minLength: 1, maxLength: 50 } },
      { field: 'age', type: 'integer', required: false, nullable: false, constraints: { min: 0 } }
    ]);

    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['name']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.name.minLength).toBe(1);
    expect(schema.properties.age.type).toBe('integer');
    expect(schema.properties.age.minimum).toBe(0);
  });

  it('builds nested object schema using dot-notation', () => {
    const schema = buildJsonSchema([
      { field: 'profile', type: 'object', required: true, nullable: false, constraints: {} },
      { field: 'profile.bio', type: 'string', required: true, nullable: false, constraints: { maxLength: 200 } }
    ]);

    expect(schema.properties.profile.type).toBe('object');
    expect(schema.properties.profile.required).toEqual(['bio']);
    expect(schema.properties.profile.properties.bio.type).toBe('string');
  });

  it('builds array of objects schema with data[] notation', () => {
    const schema = buildJsonSchema([
      { field: 'items', type: 'array', required: true, nullable: false, constraints: { minItems: 1, maxItems: 10 } },
      { field: 'items[]', type: 'object', required: true, nullable: false, constraints: {} },
      { field: 'items[].id', type: 'integer', required: true, nullable: false, constraints: { min: 1 } },
      { field: 'items[].name', type: 'string', required: true, nullable: false, constraints: { minLength: 1 } }
    ]);

    expect(schema.properties.items.type).toBe('array');
    expect(schema.properties.items.minItems).toBe(1);
    expect(schema.properties.items.maxItems).toBe(10);
    expect(schema.properties.items.items.type).toBe('object');
    expect(schema.properties.items.items.required).toEqual(['id', 'name']);
    expect(schema.properties.items.items.properties.id.type).toBe('integer');
  });

  it('throws error if child field is declared before parent object', () => {
    expect(() =>
      buildJsonSchema([
        { field: 'user.name', type: 'string', required: true, nullable: false, constraints: {} }
      ])
    ).toThrow(MoksyAgreementError);
  });
});
