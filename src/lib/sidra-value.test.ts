import { describe, expect, it } from 'vitest';
import { parseSidraValue } from './sidra-value.ts';

describe('parseSidraValue', () => {
  it('parses plain integers and decimals', () => {
    expect(parseSidraValue('11451999', 'count')).toBe(11451999);
    expect(parseSidraValue('34.6', 'measure')).toBe(34.6);
  });

  it('keeps negative numbers (value added can be negative)', () => {
    expect(parseSidraValue('-227726', 'measure')).toBe(-227726);
  });

  it('reads a real zero as 0', () => {
    expect(parseSidraValue('0', 'count')).toBe(0);
  });

  it('treats a lone "-" as a true zero only in counts', () => {
    expect(parseSidraValue('-', 'count')).toBe(0);
  });

  it('refuses a lone "-" in a measure, because it would be a guess', () => {
    expect(() => parseSidraValue('-', 'measure')).toThrow(/measure/);
  });

  it.each(['X', '..', '...', ''])('reads %j as missing data', (symbol) => {
    expect(parseSidraValue(symbol, 'count')).toBeNull();
    expect(parseSidraValue(symbol, 'measure')).toBeNull();
  });

  it('fails on an unknown symbol instead of guessing', () => {
    expect(() => parseSidraValue('abc', 'count')).toThrow(/abc/);
  });
});
