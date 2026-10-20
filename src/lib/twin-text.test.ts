import { describe, expect, it } from 'vitest';
import { closestRelative, describeTwin, inSentence } from './twin-text.ts';

const indicators = [
  { rotulo: 'Idade mediana', unidade: 'anos' },
  { rotulo: 'População residente', unidade: 'pessoas' },
  { rotulo: 'Domicílios com lixo coletado', unidade: 'fração' },
];

describe('describeTwin', () => {
  it('formats values in pt-BR with their units', () => {
    const result = describeTwin(
      { similar: [{ col: 0, gap: 0.1 }, { col: 2, gap: 0.2 }], different: { col: 1, gap: 3 } },
      indicators,
      (col) => [32.1, 11451999, 0.953][col] ?? null,
      (col) => [32.4, 3202, 0.951][col] ?? null,
    );
    expect(result.similar).toEqual(['idade mediana: 32,1 e 32,4', 'domicílios com lixo coletado: 95,3% e 95,1%']);
    expect(result.different).toBe('população residente: 11.451.999 contra 3.202');
  });

  it('has no "different" line when there is none', () => {
    expect(describeTwin({ similar: [], different: null }, indicators, () => null, () => null).different).toBeNull();
  });

  it('writes "sem dado" instead of a number when a value is missing', () => {
    const result = describeTwin({ similar: [{ col: 0, gap: 0 }], different: null }, indicators, () => null, () => 30);
    expect(result.similar[0]).toBe('idade mediana: sem dado e 30,0');
  });
});

describe('inSentence', () => {
  it('lowercases the first letter of a plain label', () => {
    expect(inSentence('População residente')).toBe('população residente');
    expect(inSentence('Índice de envelhecimento')).toBe('índice de envelhecimento');
  });
  it('keeps an acronym as it is', () => {
    expect(inSentence('PIB per capita')).toBe('PIB per capita');
  });
  it('handles an empty label', () => {
    expect(inSentence('')).toBe('');
  });
});

describe('closestRelative', () => {
  const a = [2315560, 0.061, 290];
  const b = [1773718, 0.065, 288];
  it('picks the indicator with the smallest gap relative to its size', () => {
    expect(closestRelative([0, 1, 2], (c) => a[c] ?? null, (c) => b[c] ?? null)).toBe(2);
  });
  it('skips columns with a missing value, and is null when nothing is comparable', () => {
    expect(closestRelative([0, 2], (c) => (c === 2 ? null : (a[c] ?? null)), (c) => b[c] ?? null)).toBe(0);
    expect(closestRelative([1], () => null, () => 1)).toBeNull();
  });
  it('treats two zeros as identical', () => {
    expect(closestRelative([0, 1], (c) => (c === 0 ? 0 : 5), (c) => (c === 0 ? 0 : 9))).toBe(0);
  });
});

describe('bothAtLimit', () => {
  it('flags two shares both at 100% or both at 0%', async () => {
    const { bothAtLimit } = await import('./twin-text.ts');
    expect(bothAtLimit('fração', 1, 0.9999)).toBe(true);
    expect(bothAtLimit('fração', 0, 0.0001)).toBe(true);
    expect(bothAtLimit('fração', 1, 0.95)).toBe(false);
    expect(bothAtLimit('pessoas', 1, 1)).toBe(false);
  });
});

describe('closestRelative with skip', () => {
  it('passes over skipped columns', () => {
    const a = [1, 290, 9293];
    const b = [1, 288, 9536];
    expect(closestRelative([0, 1, 2], (c) => a[c] ?? null, (c) => b[c] ?? null, (col) => col === 0)).toBe(1);
    expect(closestRelative([0, 1, 2], (c) => a[c] ?? null, (c) => b[c] ?? null, (col) => col !== 2)).toBe(2);
  });
});
