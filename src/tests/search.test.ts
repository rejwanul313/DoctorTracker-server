import { describe, expect, it } from 'vitest';
import { buildSearchTokens, escapeRegex, searchTokensFilter, searchWords } from '../utils/search';

describe('search tokens', () => {
  it('builds name, email and phone tokens (incl. local phone format)', () => {
    const tokens = buildSearchTokens({
      name: 'Dr. Farhana Rahman',
      email: 'Farhana.Rahman@squarehospital.com',
      phone: '+880 1711-204518',
    });
    expect(tokens).toEqual(
      expect.arrayContaining([
        'dr',
        'farhana',
        'rahman',
        'farhana.rahman@squarehospital.com',
        '8801711204518',
        '01711204518',
      ]),
    );
  });

  it('normalizes queries', () => {
    expect(searchWords('  Farhana  RAH ')).toEqual(['farhana', 'rah']);
    expect(searchWords('+880 1711-20')).toEqual(['880171120']);
    expect(searchWords('dr.')).toEqual(['dr']);
    expect(searchWords('a@b.c')).toEqual(['a@b.c']);
    expect(searchWords('!!!')).toEqual([]);
  });

  it('escapes regex characters and anchors every word', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(searchTokensFilter('a@b.c')).toEqual({ $all: [/^a@b\.c/] });
    expect(searchTokensFilter('   ')).toBeUndefined();
  });
});
