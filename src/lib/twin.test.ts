import { describe, expect, it } from 'vitest';
import type { Eixo } from './indicators.ts';
import { applyTransform, columnParams, columnWeights, explainPair, findTwins, MIN_COMPARABLE_SHARE, normalizeMatrix, pairDistance, Z_CLIP } from './twin.ts';

const NaNv = null;

function build(table: (number | null)[][], indicators: { eixo: Eixo; transform: 'log' | 'linear' }[]) {
  return normalizeMatrix(table.length, indicators, (row, col) => table[row]?.[col] ?? null);
}

describe('applyTransform', () => {
  it('uses log1p so a true zero stays finite, and rejects negatives', () => {
    expect(applyTransform(0, { transform: 'log' })).toBe(0);
    expect(applyTransform(Math.E - 1, { transform: 'log' })).toBeCloseTo(1);
    expect(applyTransform(-1, { transform: 'log' })).toBeNaN();
    expect(applyTransform(5, { transform: 'linear' })).toBe(5);
    expect(applyTransform(Number.NaN, { transform: 'linear' })).toBeNaN();
  });
});

describe('columnParams', () => {
  it('uses the median and 1.4826 × MAD', () => {
    const { median, scale } = columnParams([1, 2, 3, 4, 100]);
    expect(median).toBe(3);
    expect(scale).toBeCloseTo(1.4826); // MAD of [2,1,0,1,97] is 1
  });
  it('ignores NaN', () => {
    expect(columnParams([1, Number.NaN, 3]).median).toBe(2);
  });
  it('falls back to the standard deviation when the MAD is zero, then to 1', () => {
    expect(columnParams([1, 1, 1, 1, 6]).scale).toBeGreaterThan(0);
    expect(columnParams([1, 1, 1, 1, 6]).scale).not.toBe(1);
    expect(columnParams([2, 2, 2]).scale).toBe(1);
    expect(columnParams([]).scale).toBe(1);
  });
});

describe('normalizeMatrix', () => {
  it('keeps missing data as NaN and clips extremes', () => {
    const data = build([[1], [2], [3], [NaNv], [1000]], [{ eixo: 'demografia', transform: 'linear' }]);
    expect(data.z[3]).toBeNaN();
    expect(data.z[4]).toBe(Z_CLIP);
    expect(data.z[2]).toBeCloseTo(0.5 / 1.4826); // median 2.5, MAD 1
  });
});

describe('columnWeights', () => {
  const indicators: { eixo: Eixo }[] = [{ eixo: 'demografia' }, { eixo: 'demografia' }, { eixo: 'economia' }, { eixo: 'territorio' }];
  it('gives each enabled axis the same total weight', () => {
    const weights = columnWeights(indicators, new Set<Eixo>(['demografia', 'economia']));
    expect([...weights]).toEqual([0.5, 0.5, 1, 0]);
  });
  it('is all zero with no axis on', () => {
    expect([...columnWeights(indicators, new Set())]).toEqual([0, 0, 0, 0]);
  });
});

describe('findTwins', () => {
  const indicators: { eixo: Eixo; transform: 'log' | 'linear' }[] = [
    { eixo: 'demografia', transform: 'linear' },
    { eixo: 'demografia', transform: 'linear' },
    { eixo: 'economia', transform: 'linear' },
  ];
  const all = new Set<Eixo>(['demografia', 'economia']);

  it('ranks by distance and never returns the city itself', () => {
    const data = build(
      [
        [0, 0, 0],
        [0.1, 0, 0],
        [5, 5, 5],
        [1, 1, 1],
        [-3, 2, 4],
      ],
      indicators,
    );
    const result = findTwins(data, indicators, 0, { axes: all, limit: 3 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.twins.map((twin) => twin.row)[0]).toBe(1);
    expect(result.twins.map((twin) => twin.row)).not.toContain(0);
    expect(result.twins).toHaveLength(3);
    expect(result.twins[0]?.distance).toBeLessThan(result.twins[1]?.distance ?? 0);
  });

  it('is symmetric in distance', () => {
    const data = build([[0, 1, 2], [3, 1, 0], [1, 1, 1]], indicators);
    const forward = findTwins(data, indicators, 0, { axes: all, limit: 5 });
    const back = findTwins(data, indicators, 1, { axes: all, limit: 5 });
    if (forward.status !== 'ok' || back.status !== 'ok') throw new Error('expected ok');
    expect(forward.twins.find((twin) => twin.row === 1)?.distance).toBeCloseTo(back.twins.find((twin) => twin.row === 0)?.distance ?? -1);
  });

  it('excludes pairs below the comparable share and counts them', () => {
    const data = build(
      [
        [0, 0, 0],
        [0, NaNv, NaNv], // 1 of 3 comparable (33%)
        [0, 0, NaNv], // 2 of 3 comparable (67%)
        [NaNv, NaNv, NaNv], // no data at all: not counted as excluded
      ],
      indicators,
    );
    const result = findTwins(data, indicators, 0, { axes: all });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.twins.map((twin) => twin.row)).toEqual([2]);
    expect(result.excluded).toBe(1);
    expect(result.twins[0]).toMatchObject({ comparable: 2, enabled: 3 });
  });

  it('accepts a pair exactly at the 60% threshold', () => {
    const five = Array.from({ length: 5 }, () => ({ eixo: 'demografia' as const, transform: 'linear' as const }));
    const data = build([[0, 0, 0, 0, 0], [0, 0, 0, NaNv, NaNv], [0, 0, NaNv, NaNv, NaNv]], five);
    const result = findTwins(data, five, 0, { axes: new Set<Eixo>(['demografia']), minShare: MIN_COMPARABLE_SHARE });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.twins.map((twin) => twin.row)).toEqual([1]);
    expect(result.excluded).toBe(1);
  });

  it('reports "sem-dado" when the city itself lacks the indicators', () => {
    const data = build([[NaNv, NaNv, NaNv], [1, 1, 1]], indicators);
    expect(findTwins(data, indicators, 0, { axes: all })).toEqual({ status: 'sem-dado', enabled: 3, available: 0 });
  });

  it('reports "sem-dado" when no axis is on', () => {
    const data = build([[1, 1, 1], [2, 2, 2]], indicators);
    expect(findTwins(data, indicators, 0, { axes: new Set() }).status).toBe('sem-dado');
  });

  it('ignores switched-off axes', () => {
    const data = build(
      [
        [0, 0, 0],
        [0, 0, 9], // same demography, very different economy
        [3, 3, 0], // same economy, different demography
        [9, 9, 9],
      ],
      indicators,
    );
    const demographyOnly = findTwins(data, indicators, 0, { axes: new Set<Eixo>(['demografia']), limit: 1 });
    if (demographyOnly.status !== 'ok') throw new Error('expected ok');
    expect(demographyOnly.twins[0]?.row).toBe(1);
    const economyOnly = findTwins(data, indicators, 0, { axes: new Set<Eixo>(['economia']), limit: 1 });
    if (economyOnly.status !== 'ok') throw new Error('expected ok');
    expect(economyOnly.twins[0]?.row).toBe(2);
  });

  it('breaks ties by row order, so the result is stable', () => {
    const data = build([[0, 0, 0], [1, 1, 1], [1, 1, 1]], indicators);
    const result = findTwins(data, indicators, 0, { axes: all });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.twins.map((twin) => twin.row)).toEqual([1, 2]);
  });
});

describe('pairDistance', () => {
  const indicators: { eixo: Eixo; transform: 'log' | 'linear' }[] = [
    { eixo: 'demografia', transform: 'linear' },
    { eixo: 'demografia', transform: 'linear' },
    { eixo: 'economia', transform: 'linear' },
  ];
  const all = new Set<Eixo>(['demografia', 'economia']);

  it('matches the distance findTwins reports for the same pair', () => {
    const data = build([[0, 0, 0], [1, 2, 3], [4, 1, 0]], indicators);
    const found = findTwins(data, indicators, 0, { axes: all, limit: 5 });
    if (found.status !== 'ok') throw new Error('expected ok');
    for (const twin of found.twins) expect(pairDistance(data, indicators, 0, twin.row, all)?.distance).toBeCloseTo(twin.distance);
  });

  it('is null below the comparable share and for a pair with no data', () => {
    const data = build([[0, 0, 0], [0, NaNv, NaNv], [NaNv, NaNv, NaNv]], indicators);
    expect(pairDistance(data, indicators, 0, 1, all)).toBeNull();
    expect(pairDistance(data, indicators, 0, 2, all)).toBeNull();
  });

  it('is 0 for identical rows', () => {
    const data = build([[1, 2, 3], [1, 2, 3], [9, 9, 9]], indicators);
    expect(pairDistance(data, indicators, 0, 1, all)?.distance).toBe(0);
  });
});

describe('explainPair', () => {
  const indicators: { eixo: Eixo; transform: 'log' | 'linear' }[] = Array.from({ length: 5 }, (_, i) => ({
    eixo: i < 4 ? 'demografia' : 'economia',
    transform: 'linear',
  }));

  it('returns the three closest indicators and the one that differs most', () => {
    const data = normalizeMatrix(3, indicators, (row, col) => [[0, 0, 0, 0, 0], [0, 0.1, 0.5, 2, 3], [9, 9, 9, 9, 9]][row]?.[col] ?? null);
    const { similar, different } = explainPair(data, indicators, 0, 1, new Set<Eixo>(['demografia', 'economia']));
    expect(similar.map((item) => item.col)).toEqual([0, 1, 2]);
    expect(different?.col).toBe(4);
  });

  it('skips missing data and switched-off axes, and has no "different" with a single indicator', () => {
    const data = normalizeMatrix(2, indicators, (row, col) => (row === 1 && col === 0 ? null : col));
    const result = explainPair(data, indicators, 0, 1, new Set<Eixo>(['economia']));
    expect(result.similar.map((item) => item.col)).toEqual([4]);
    expect(result.different).toBeNull();
  });
});
