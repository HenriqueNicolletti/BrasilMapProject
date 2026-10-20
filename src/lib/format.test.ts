import { describe, expect, it } from 'vitest';
import { NO_DATA, formatCompactValue, formatDecimal, formatIndicatorValue, formatInteger, formatPercent } from './format';

describe('formatInteger', () => {
  it('groups thousands the pt-BR way', () => {
    expect(formatInteger(11451999)).toBe('11.451.999');
  });

  it('keeps a real zero as 0', () => {
    expect(formatInteger(0)).toBe('0');
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])('reads %s as "sem dado"', (value) => {
    expect(formatInteger(value)).toBe(NO_DATA);
  });
});

describe('formatDecimal', () => {
  it('uses a decimal comma with one digit', () => {
    expect(formatDecimal(34.56)).toBe('34,6');
  });

  it('reads missing values as "sem dado"', () => {
    expect(formatDecimal(null)).toBe(NO_DATA);
  });
});

describe('formatPercent', () => {
  it('formats a fraction as a percentage', () => {
    expect(formatPercent(0.253)).toBe('25,3%');
  });

  it('keeps a real 0% as 0%', () => {
    expect(formatPercent(0)).toBe('0,0%');
  });

  it('reads missing values as "sem dado"', () => {
    expect(formatPercent(undefined)).toBe(NO_DATA);
  });
});

describe('formatIndicatorValue', () => {
  // pt-BR currency uses a non-breaking space after "R$".
  const plain = (text: string) => text.replace(/\u00a0/g, ' ');

  it('formats a fraction as a percentage', () => {
    expect(formatIndicatorValue(0.253, 'fração')).toBe('25,3%');
  });

  it('formats people as a whole number', () => {
    expect(formatIndicatorValue(11451999, 'pessoas')).toBe('11.451.999');
  });

  it('formats density, area, median age and ageing with one decimal', () => {
    expect(formatIndicatorValue(7528.26, 'hab/km²')).toBe('7.528,3');
    expect(formatIndicatorValue(1521.2, 'km²')).toBe('1.521,2');
    expect(formatIndicatorValue(37, 'anos')).toBe('37,0');
    expect(formatIndicatorValue(72.53, 'idosos por 100 jovens')).toBe('72,5');
  });

  it('formats money in reais without cents', () => {
    expect(plain(formatIndicatorValue(72387.4, 'R$'))).toBe('R$ 72.387');
  });

  it('reads a missing value as "sem dado" whatever the unit', () => {
    expect(formatIndicatorValue(null, 'fração')).toBe(NO_DATA);
    expect(formatIndicatorValue(Number.NaN, 'R$')).toBe(NO_DATA);
  });

  it('fails on a unit it does not know instead of guessing a format', () => {
    expect(() => formatIndicatorValue(1, 'furlongs')).toThrow(/furlongs/);
  });
});

describe('formatCompactValue', () => {
  it('shortens big numbers for labels printed on the map', () => {
    expect(formatCompactValue(44411238, 'pessoas')).toBe('44 mi');
    expect(formatCompactValue(830018, 'pessoas')).toBe('830 mil');
  });

  it('shortens decimals and areas too, and keeps a share as a percentage', () => {
    expect(formatCompactValue(248219.485, 'km²')).toBe('248 mil');
    expect(formatCompactValue(0.253, 'fração')).toBe('25%');
  });

  it('reads a missing value as an empty label, so nothing is printed on the map', () => {
    expect(formatCompactValue(null, 'pessoas')).toBe('');
    expect(formatCompactValue(Number.NaN, 'fração')).toBe('');
  });

  it('fails on a unit it does not know', () => {
    expect(() => formatCompactValue(1, 'furlongs')).toThrow(/furlongs/);
  });
});
