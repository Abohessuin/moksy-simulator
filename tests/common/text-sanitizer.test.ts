import { describe, it, expect } from 'vitest';
import { sanitizeWordText, isPlaceholderCell } from '../../src/common/text-sanitizer.js';

describe('text-sanitizer', () => {
  it('converts smart quotes to standard quotes', () => {
    const input = '“Hello” and ‘World’ with „German“ and «French» quotes';
    const output = sanitizeWordText(input);
    expect(output).toBe('"Hello" and \'World\' with "German" and "French" quotes');
  });

  it('normalizes em-dash and en-dash to standard hyphen', () => {
    const input = 'min=1–max=10—default=5';
    const output = sanitizeWordText(input);
    expect(output).toBe('min=1-max=10-default=5');
  });

  it('converts non-breaking spaces and zero-width spaces', () => {
    const input = 'field\u00A0name\u200Bwith\uFEFFspaces';
    const output = sanitizeWordText(input);
    expect(output).toBe('field namewithspaces');
  });

  it('detects placeholder cells correctly', () => {
    expect(isPlaceholderCell('-')).toBe(true);
    expect(isPlaceholderCell('—')).toBe(true);
    expect(isPlaceholderCell('–')).toBe(true);
    expect(isPlaceholderCell('')).toBe(true);
    expect(isPlaceholderCell('  ')).toBe(true);
    expect(isPlaceholderCell('none')).toBe(true);
    expect(isPlaceholderCell('N/A')).toBe(true);
    expect(isPlaceholderCell('min=1')).toBe(false);
  });
});
