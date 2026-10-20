import { describe, expect, it } from 'vitest';
import { makeRanker } from './rank.ts';

describe('makeRanker', () => {
  const ranker = makeRanker([10, 30, 20, null, Number.NaN, 40]);

  it('puts the highest value at position 1, out of the values that exist', () => {
    expect(ranker(40)).toEqual({ posicao: 1, total: 4 });
    expect(ranker(30)).toEqual({ posicao: 2, total: 4 });
    expect(ranker(10)).toEqual({ posicao: 4, total: 4 });
  });

  it('gives tied values the same position (competition ranking), and skips the next', () => {
    const tied = makeRanker([5, 5, 5, 1]);
    expect(tied(5)).toEqual({ posicao: 1, total: 4 });
    expect(tied(1)).toEqual({ posicao: 4, total: 4 });
  });

  it('has no position for a missing value', () => {
    expect(ranker(null)).toBeNull();
    expect(ranker(Number.NaN)).toBeNull();
  });

  it('counts only present values in the total', () => {
    expect(ranker(20)?.total).toBe(4);
  });

  it('has no ranking at all when nothing has a value', () => {
    expect(makeRanker([null, Number.NaN])(1)).toBeNull();
  });
});
