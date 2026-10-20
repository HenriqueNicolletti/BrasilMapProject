import { describe, expect, it } from 'vitest';
import { extremes, rankColumn } from './ranking.ts';

describe('rankColumn', () => {
  it('orders from highest to lowest and numbers from 1', () => {
    expect(rankColumn([10, 30, 20]).map((entry) => [entry.row, entry.posicao])).toEqual([
      [1, 1],
      [2, 2],
      [0, 3],
    ]);
  });

  it('leaves out missing values instead of ranking them as zero', () => {
    const ranked = rankColumn([5, null, Number.NaN, undefined, 0]);
    expect(ranked.map((entry) => entry.row)).toEqual([0, 4]);
    expect(ranked[1]).toMatchObject({ value: 0, posicao: 2 }); // a true zero is data
  });

  it('gives ties the same position and skips the next one, keeping row order', () => {
    const ranked = rankColumn([7, 9, 7, 7, 1]);
    expect(ranked.map((entry) => [entry.row, entry.posicao])).toEqual([
      [1, 1],
      [0, 2],
      [2, 2],
      [3, 2],
      [4, 5],
    ]);
  });

  it('agrees with makeRanker positions', async () => {
    const { makeRanker } = await import('./rank.ts');
    const values = [4, 8, 8, null, 1, 4, 9];
    const rank = makeRanker(values);
    for (const entry of rankColumn(values)) expect(entry.posicao).toBe(rank(entry.value)?.posicao);
  });

  it('is empty when nothing has a value', () => {
    expect(rankColumn([null, Number.NaN])).toEqual([]);
  });
});

describe('extremes', () => {
  const ranked = rankColumn([1, 2, 3, 4, 5, 6, 7]);

  it('takes the highest from the top and the lowest, lowest first, from the bottom', () => {
    const { top, bottom, total } = extremes(ranked, 2);
    expect(top.map((entry) => entry.value)).toEqual([7, 6]);
    expect(bottom.map((entry) => entry.value)).toEqual([1, 2]);
    expect(total).toBe(7);
  });

  it('keeps the true position of the lowest values', () => {
    expect(extremes(ranked, 2).bottom.map((entry) => entry.posicao)).toEqual([7, 6]);
  });

  it('never lists a municipality in both lists', () => {
    const { top, bottom } = extremes(ranked, 5);
    expect(top).toHaveLength(5);
    expect(bottom.map((entry) => entry.value)).toEqual([1, 2]);
  });

  it('handles an empty column', () => {
    expect(extremes([], 3)).toEqual({ top: [], bottom: [], total: 0 });
  });
});

describe('indicatorSlug', () => {
  it('swaps underscores for hyphens, and every real indicator gets a distinct slug', async () => {
    const { indicatorSlug } = await import('./ranking.ts');
    const { INDICATORS } = await import('./indicators.ts');
    expect(indicatorSlug('idade_mediana')).toBe('idade-mediana');
    expect(new Set(INDICATORS.map((indicator) => indicatorSlug(indicator.id))).size).toBe(INDICATORS.length);
  });
});
