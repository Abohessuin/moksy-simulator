import { describe, it, expect } from 'vitest';
import { parseRules } from '../../src/modules/agreement/rule-parser.js';
import { MoksyAgreementError } from '../../src/common/errors.js';

describe('rule-parser', () => {
  it('parses valid numeric bounds and default', () => {
    const rules = parseRules('min=1; max=100; default=10', 'integer');
    expect(rules.min).toBe(1);
    expect(rules.max).toBe(100);
    expect(rules.default).toBe(10);
  });

  it('parses string length bounds and regex pattern', () => {
    const rules = parseRules('minLength=2; maxLength=50; pattern=^[A-Z]+$', 'string');
    expect(rules.minLength).toBe(2);
    expect(rules.maxLength).toBe(50);
    expect(rules.pattern).toBe('^[A-Z]+$');
  });

  it('parses array items and enums', () => {
    const rules = parseRules('minItems=1; maxItems=5', 'array');
    expect(rules.minItems).toBe(1);
    expect(rules.maxItems).toBe(5);

    const enumRules = parseRules('enum=["apple", "banana"]', 'string');
    expect(enumRules.enum).toEqual(['apple', 'banana']);
  });

  it('parses boolean defaults and nullable', () => {
    const rules = parseRules('default=true; nullable', 'boolean');
    expect(rules.default).toBe(true);
    expect(rules.nullable).toBe(true);
  });

  it('rejects unsatisfiable bounds (min > max)', () => {
    expect(() => parseRules('min=100; max=50', 'integer')).toThrow(MoksyAgreementError);
    expect(() => parseRules('minLength=20; maxLength=5', 'string')).toThrow(MoksyAgreementError);
    expect(() => parseRules('minItems=10; maxItems=2', 'array')).toThrow(MoksyAgreementError);
  });

  it('rejects rules incompatible with field type', () => {
    expect(() => parseRules('min=10', 'string')).toThrow(MoksyAgreementError);
    expect(() => parseRules('minLength=5', 'integer')).toThrow(MoksyAgreementError);
    expect(() => parseRules('minItems=1', 'number')).toThrow(MoksyAgreementError);
  });

  it('rejects unknown rule keys', () => {
    expect(() => parseRules('unknownKey=123', 'string')).toThrow(MoksyAgreementError);
  });
});
