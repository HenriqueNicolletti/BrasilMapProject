import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_SECONDS, revealTiming } from './motion-timing.ts';

describe('revealTiming', () => {
  it('has no spread for a single element', () => {
    expect(revealTiming(1).spread).toBe(0);
    expect(revealTiming(0).spread).toBe(0);
  });

  it('never runs past the limit, however many elements there are', () => {
    for (const count of [1, 2, 6, 25, 5570]) expect(revealTiming(count).total).toBeLessThanOrEqual(MAX_TOTAL_SECONDS);
  });
});
