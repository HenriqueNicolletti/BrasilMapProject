export interface RankedEntry {
  row: number;
  value: number;
  /** 1 is the highest value. Ties share a position (1, 2, 2, 4), as in `makeRanker`. */
  posicao: number;
}

/**
 * Every row that has a value, highest first. Missing values (null, undefined, NaN) are left out, never
 * ranked as zero. Ties keep row order, so the list is stable.
 */
export function rankColumn(values: readonly (number | null | undefined)[]): RankedEntry[] {
  const present: { row: number; value: number }[] = [];
  values.forEach((value, row) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) present.push({ row, value });
  });
  present.sort((a, b) => b.value - a.value || a.row - b.row);
  let posicao = 0;
  return present.map((entry, index) => {
    if (index === 0 || entry.value !== (present[index - 1] as { value: number }).value) posicao = index + 1;
    return { ...entry, posicao };
  });
}

export interface Extremes {
  /** Highest values first. */
  top: RankedEntry[];
  /** Lowest value first. */
  bottom: RankedEntry[];
  /** Municipalities with a value. */
  total: number;
}

/** The `count` highest and the `count` lowest; with few values the two lists do not overlap. */
export function extremes(ranked: readonly RankedEntry[], count: number): Extremes {
  const total = ranked.length;
  const top = ranked.slice(0, count);
  const bottom = ranked.slice(Math.max(count, total - count)).reverse();
  return { top, bottom, total };
}

/** URL segment of an indicator: `idade_mediana` becomes `idade-mediana`. */
export function indicatorSlug(id: string): string {
  return id.replace(/_/g, '-');
}
