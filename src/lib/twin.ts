import type { Eixo, IndicatorDef } from './indicators.ts';

/** A twin needs at least this share of the enabled indicators present in both municipalities. */
export const MIN_COMPARABLE_SHARE = 0.6;

/** After the robust z-score, values are clipped here so one extreme indicator cannot decide a match alone. */
export const Z_CLIP = 4;

export interface ColumnParams {
  median: number;
  /** Scale of the column: 1.4826 × MAD, falling back to the standard deviation, then to 1. */
  scale: number;
}

type Transformable = Pick<IndicatorDef, 'transform'>;

/** Long-tailed measures are compared on a log scale. log1p keeps a true zero finite; negatives are not data. */
export function applyTransform(value: number, indicator: Transformable): number {
  if (!Number.isFinite(value)) return Number.NaN;
  if (indicator.transform === 'log') return value < 0 ? Number.NaN : Math.log1p(value);
  return value;
}

function median(sorted: readonly number[]): number {
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** Median and robust scale of one column of already transformed values; NaN is ignored. */
export function columnParams(values: readonly number[]): ColumnParams {
  const present = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (present.length === 0) return { median: 0, scale: 1 };
  const center = median(present);
  const mad = median(present.map((value) => Math.abs(value - center)).sort((a, b) => a - b));
  if (mad > 0) return { median: center, scale: 1.4826 * mad };
  // More than half of the municipalities share one value (e.g. 100% of homes served): use the spread instead.
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  const deviation = Math.sqrt(present.reduce((sum, value) => sum + (value - mean) ** 2, 0) / present.length);
  return { median: center, scale: deviation > 0 ? deviation : 1 };
}

export interface NormalizedMatrix {
  rows: number;
  cols: number;
  /** Row-major z-scores; NaN where the municipality has no data. */
  z: Float64Array;
  params: ColumnParams[];
}

/**
 * Transform, then robust z-score per column (median and MAD). `get` is the raw matrix accessor, where
 * `null` means "sem dado".
 */
export function normalizeMatrix(
  rows: number,
  indicators: readonly Transformable[],
  get: (row: number, col: number) => number | null,
): NormalizedMatrix {
  const cols = indicators.length;
  const z = new Float64Array(rows * cols).fill(Number.NaN);
  const params: ColumnParams[] = [];
  indicators.forEach((indicator, col) => {
    const transformed = new Float64Array(rows);
    for (let row = 0; row < rows; row += 1) {
      const raw = get(row, col);
      transformed[row] = raw === null ? Number.NaN : applyTransform(raw, indicator);
    }
    const column = columnParams([...transformed]);
    params.push(column);
    for (let row = 0; row < rows; row += 1) {
      const value = transformed[row] as number;
      if (Number.isNaN(value)) continue;
      const score = (value - column.median) / column.scale;
      z[row * cols + col] = Math.max(-Z_CLIP, Math.min(Z_CLIP, score));
    }
  });
  return { rows, cols, z, params };
}

export interface TwinOptions {
  /** Axes switched on. At least one is needed to compare anything. */
  axes: ReadonlySet<Eixo>;
  limit?: number;
  minShare?: number;
}

export interface Twin {
  row: number;
  /** Weighted RMS difference over the comparable indicators; 0 is identical. */
  distance: number;
  comparable: number;
  enabled: number;
}

export type TwinResult =
  | { status: 'ok'; twins: Twin[]; /** Other municipalities left out for lacking comparable indicators. */ excluded: number }
  | { status: 'sem-dado'; enabled: number; available: number };

/** Weight of each column: equal per axis, split evenly among the axis's enabled indicators. 0 = switched off. */
export function columnWeights(indicators: readonly Pick<IndicatorDef, 'eixo'>[], axes: ReadonlySet<Eixo>): Float64Array {
  const perAxis = new Map<Eixo, number>();
  for (const indicator of indicators) {
    if (axes.has(indicator.eixo)) perAxis.set(indicator.eixo, (perAxis.get(indicator.eixo) ?? 0) + 1);
  }
  return Float64Array.from(indicators, (indicator) => {
    const count = perAxis.get(indicator.eixo);
    return count ? 1 / count : 0;
  });
}

/**
 * The municipalities most like `row`, nearest first. Distance is a weighted Euclidean distance over the
 * indicators present in both, divided by the weight that was comparable, so a pair compared on fewer
 * indicators is not made to look closer. Pairs below `minShare` of the enabled indicators are excluded.
 */
export function findTwins(
  data: NormalizedMatrix,
  indicators: readonly Pick<IndicatorDef, 'eixo'>[],
  row: number,
  { axes, limit = 5, minShare = MIN_COMPARABLE_SHARE }: TwinOptions,
): TwinResult {
  const { cols, z } = data;
  const weights = columnWeights(indicators, axes);
  const enabledCols: number[] = [];
  weights.forEach((weight, col) => {
    if (weight > 0) enabledCols.push(col);
  });
  const base = row * cols;
  const own = enabledCols.filter((col) => !Number.isNaN(z[base + col] as number));
  if (own.length < Math.ceil(enabledCols.length * minShare) || own.length === 0) {
    return { status: 'sem-dado', enabled: enabledCols.length, available: own.length };
  }

  const found: Twin[] = [];
  let excluded = 0;
  for (let other = 0; other < data.rows; other += 1) {
    if (other === row) continue;
    const otherBase = other * cols;
    let comparable = 0;
    let weight = 0;
    let sum = 0;
    for (const col of own) {
      const theirs = z[otherBase + col] as number;
      if (Number.isNaN(theirs)) continue;
      const diff = (z[base + col] as number) - theirs;
      const w = weights[col] as number;
      comparable += 1;
      weight += w;
      sum += w * diff * diff;
    }
    if (comparable === 0) continue; // no data at all (e.g. a municipality created after the Census)
    if (comparable < enabledCols.length * minShare) {
      excluded += 1;
      continue;
    }
    found.push({ row: other, distance: Math.sqrt(sum / weight), comparable, enabled: enabledCols.length });
  }
  found.sort((a, b) => a.distance - b.distance || a.row - b.row);
  return { status: 'ok', twins: found.slice(0, limit), excluded };
}

/** The same distance `findTwins` uses, for one chosen pair; null when too few indicators are comparable. */
export function pairDistance(
  data: NormalizedMatrix,
  indicators: readonly Pick<IndicatorDef, 'eixo'>[],
  a: number,
  b: number,
  axes: ReadonlySet<Eixo>,
  minShare = MIN_COMPARABLE_SHARE,
): { distance: number; comparable: number; enabled: number } | null {
  const weights = columnWeights(indicators, axes);
  let enabled = 0;
  let comparable = 0;
  let weight = 0;
  let sum = 0;
  weights.forEach((w, col) => {
    if (w === 0) return;
    enabled += 1;
    const first = data.z[a * data.cols + col] as number;
    const second = data.z[b * data.cols + col] as number;
    if (Number.isNaN(first) || Number.isNaN(second)) return;
    comparable += 1;
    weight += w;
    sum += w * (first - second) ** 2;
  });
  if (comparable === 0 || comparable < enabled * minShare) return null;
  return { distance: Math.sqrt(sum / weight), comparable, enabled };
}

export interface Contrast {
  col: number;
  /** Absolute z difference. */
  gap: number;
}

export interface Explanation {
  similar: Contrast[];
  different: Contrast | null;
}

/** The indicators where two municipalities are closest (up to 3) and the one where they differ most. */
export function explainPair(
  data: NormalizedMatrix,
  indicators: readonly Pick<IndicatorDef, 'eixo'>[],
  a: number,
  b: number,
  axes: ReadonlySet<Eixo>,
  similarCount = 3,
): Explanation {
  const gaps: Contrast[] = [];
  indicators.forEach((indicator, col) => {
    if (!axes.has(indicator.eixo)) return;
    const first = data.z[a * data.cols + col] as number;
    const second = data.z[b * data.cols + col] as number;
    if (Number.isNaN(first) || Number.isNaN(second)) return;
    gaps.push({ col, gap: Math.abs(first - second) });
  });
  gaps.sort((x, y) => x.gap - y.gap || x.col - y.col);
  const similar = gaps.slice(0, similarCount);
  const last = gaps[gaps.length - 1];
  const different = last && !similar.some((item) => item.col === last.col) ? last : null;
  return { similar, different };
}
