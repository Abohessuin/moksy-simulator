import { describe, expect, it } from 'vitest';
import { mergeRecord } from '../../src/modules/state/utils/record-utils.js';

describe('mergeRecord', () => {
  it('deeply merges objects, replaces arrays, and preserves protected fields', () => {
    const original = {
      id: 10,
      profile: { name: 'Before', preferences: { theme: 'dark' } },
      tags: ['one', 'two']
    };

    const merged = mergeRecord(
      original,
      { id: 99, profile: { name: 'After' }, tags: ['replacement'] },
      new Set(['id'])
    );

    expect(merged).toEqual({
      id: 10,
      profile: { name: 'After', preferences: { theme: 'dark' } },
      tags: ['replacement']
    });
    expect(original.profile.name).toBe('Before');
  });
});
