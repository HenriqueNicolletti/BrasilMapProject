import { describe, expect, it } from 'vitest';
import { classBreaks, classIndex, legendRanges } from './classify.ts';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('classBreaks', () => {
  it('splits a spread of values into quantile classes (n classes, n-1 breaks)', () => {
    expect(classBreaks(range(100), 4)).toEqual([25.75, 50.5, 75.25]);
  });

  it('ignores missing values', () => {
    const withGaps = [...range(100), Number.NaN, Number.NaN];
    expect(classBreaks(withGaps, 4)).toEqual([25.75, 50.5, 75.25]);
  });

  it('merges repeated breaks when many values tie, so a class is never empty by construction', () => {
    const breaks = classBreaks([0, 0, 0, 0, 0, 0, 0, 5, 9, 10], 5);
    expect(new Set(breaks).size).toBe(breaks.length);
    expect(breaks.length).toBeLessThan(4);
  });

  it('returns no breaks when there are no values', () => {
    expect(classBreaks([], 7)).toEqual([]);
    expect(classBreaks([Number.NaN], 7)).toEqual([]);
  });
});

describe('classIndex', () => {
  const breaks = [10, 20, 30];

  it('puts a value in the class whose range holds it', () => {
    expect(classIndex(5, breaks)).toBe(0);
    expect(classIndex(15, breaks)).toBe(1);
    expect(classIndex(25, breaks)).toBe(2);
    expect(classIndex(99, breaks)).toBe(3);
  });

  it('puts a value that equals a break in the upper class', () => {
    expect(classIndex(10, breaks)).toBe(1);
    expect(classIndex(30, breaks)).toBe(3);
  });

  it('returns null for a missing value, so it never gets a colour of the scale', () => {
    expect(classIndex(Number.NaN, breaks)).toBeNull();
    expect(classIndex(null, breaks)).toBeNull();
  });

  it('puts everything in class 0 when there are no breaks', () => {
    expect(classIndex(42, [])).toBe(0);
  });
});

describe('legendRanges', () => {
  it('turns breaks into labelled ranges that cover min to max', () => {
    expect(legendRanges([10, 20], 1, 30)).toEqual([
      { index: 0, from: 1, to: 10 },
      { index: 1, from: 10, to: 20 },
      { index: 2, from: 20, to: 30 },
    ]);
  });

  it('gives one range when there are no breaks', () => {
    expect(legendRanges([], 3, 8)).toEqual([{ index: 0, from: 3, to: 8 }]);
  });
});
