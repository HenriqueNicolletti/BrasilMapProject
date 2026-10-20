export interface Rank {
  /** 1 is the highest value. Ties share a position (1, 2, 2, 4). */
  posicao: number;
  /** Values that exist, i.e. how many municipalities are being ranked. */
  total: number;
}

/** Builds a ranker over a set of values; missing values (null or NaN) are neither ranked nor counted. */
export function makeRanker(values: readonly (number | null | undefined)[]): (value: number | null | undefined) => Rank | null {
  const present = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const sorted = [...present].sort((a, b) => b - a); // descending
  const total = sorted.length;

  return (value) => {
    if (value === null || value === undefined || !Number.isFinite(value) || total === 0) return null;
    // Position = 1 + how many values are strictly greater: binary search for the first value <= `value`.
    let low = 0;
    let high = total;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((sorted[mid] as number) > value) low = mid + 1;
      else high = mid;
    }
    return { posicao: low + 1, total };
  };
}
