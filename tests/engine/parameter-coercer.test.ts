import { describe, it, expect } from 'vitest';
import {
  coerceParameter,
  coercePathParameters,
  coerceQueryParameters
} from '../../src/modules/engine/validation/parameter-coercer.js';

describe('parameter-coercer', () => {
  describe('coerceParameter', () => {
    it('coerces valid integer strings to numbers', () => {
      expect(coerceParameter('42', 'integer', 'id', 'path')).toEqual({ success: true, value: 42 });
      expect(coerceParameter('-10', 'integer', 'offset', 'query')).toEqual({ success: true, value: -10 });
      expect(coerceParameter('0', 'integer', 'zero', 'query')).toEqual({ success: true, value: 0 });
    });

    it('rejects invalid integer strings', () => {
      expect(coerceParameter('abc', 'integer', 'id', 'path').success).toBe(false);
      expect(coerceParameter('12.34', 'integer', 'id', 'path').success).toBe(false);
      expect(coerceParameter('', 'integer', 'id', 'path').success).toBe(false);
    });

    it('coerces valid float/number strings', () => {
      expect(coerceParameter('19.99', 'number', 'price', 'query')).toEqual({ success: true, value: 19.99 });
      expect(coerceParameter('-0.5', 'number', 'temp', 'query')).toEqual({ success: true, value: -0.5 });
    });

    it('rejects invalid number strings', () => {
      expect(coerceParameter('foo', 'number', 'price', 'query').success).toBe(false);
      expect(coerceParameter('', 'number', 'price', 'query').success).toBe(false);
    });

    it('coerces boolean strings', () => {
      expect(coerceParameter('true', 'boolean', 'inStock', 'query')).toEqual({ success: true, value: true });
      expect(coerceParameter('false', 'boolean', 'inStock', 'query')).toEqual({ success: true, value: false });
      expect(coerceParameter('TRUE', 'boolean', 'inStock', 'query')).toEqual({ success: true, value: true });
    });

    it('rejects invalid boolean strings', () => {
      expect(coerceParameter('yes', 'boolean', 'inStock', 'query').success).toBe(false);
      expect(coerceParameter('1', 'boolean', 'inStock', 'query').success).toBe(false);
      expect(coerceParameter('foo', 'boolean', 'inStock', 'query').success).toBe(false);
    });
  });

  describe('coercePathParameters', () => {
    it('coerces declared path parameters according to schema', () => {
      const pathSchema = {
        type: 'object',
        properties: {
          categoryId: { type: 'integer' },
          slug: { type: 'string' }
        }
      };

      const result = coercePathParameters({ categoryId: '15', slug: 'electronics' }, pathSchema);
      expect(result.errors).toEqual([]);
      expect(result.coerced).toEqual({ categoryId: 15, slug: 'electronics' });
    });

    it('records error when path parameter coercion fails', () => {
      const pathSchema = {
        type: 'object',
        properties: {
          id: { type: 'integer' }
        }
      };

      const result = coercePathParameters({ id: 'invalid-id' }, pathSchema);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].location).toBe('path');
      expect(result.errors[0].field).toBe('id');
    });
  });

  describe('coerceQueryParameters', () => {
    const querySchema = {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        pageSize: { type: 'integer', default: 10 },
        inStock: { type: 'boolean' }
      }
    };

    const declaredFields: any[] = [
      { field: 'page', location: 'query', type: 'integer' },
      { field: 'pageSize', location: 'query', type: 'integer' },
      { field: 'inStock', location: 'query', type: 'boolean' }
    ];

    it('coerces parameters and applies schema defaults for omitted fields', () => {
      const result = coerceQueryParameters({ inStock: 'true' }, querySchema, declaredFields);
      expect(result.errors).toEqual([]);
      expect(result.coerced).toEqual({
        inStock: true,
        page: 1,
        pageSize: 10
      });
    });

    it('rejects unknown query parameters', () => {
      const result = coerceQueryParameters({ page: '2', hacked: 'true' }, querySchema, declaredFields);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].field).toBe('hacked');
      expect(result.errors[0].message).toContain('Unknown query parameter');
    });
  });
});
