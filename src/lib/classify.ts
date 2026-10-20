import { scaleQuantile } from 'd3-scale';

const isValue = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value);

/**
 * Quantile breaks for `classes` classes (up to classes-1 breaks). Repeated breaks are merged, and a
 * break at the minimum is dropped (it would leave class 0 empty), so heavy ties give fewer classes
 * instead of colours that mean nothing.
 */
export function classBreaks(values: readonly (number | null | undefined)[], classes: number): number[] {
  const present = values.filter(isValue);
  if (present.length === 0) return [];
  const min = Math.min(...present);
  const quantiles = scaleQuantile()
    .domain(present)
    .range(Array.from({ length: classes }, (_, i) => i))
    .quantiles();
  return [...new Set(quantiles)].filter((breakpoint) => breakpoint > min);
}

/** Class of a value: a value equal to a break falls in the upper class. `null` when there is no data. */
export function classIndex(value: number | null | undefined, breaks: readonly number[]): number | null {
  if (!isValue(value)) return null;
  return breaks.filter((breakpoint) => breakpoint <= value).length;
}

export interface LegendRange {
  index: number;
  from: number;
  to: number;
}

export function legendRanges(breaks: readonly number[], min: number, max: number): LegendRange[] {
  const edges = [min, ...breaks, max];
  return edges.slice(0, -1).map((from, index) => ({ index, from, to: edges[index + 1] as number }));
}
