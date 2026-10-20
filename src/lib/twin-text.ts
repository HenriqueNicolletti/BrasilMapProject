import { formatIndicatorValue } from './format.ts';
import type { IndicatorDef } from './indicators.ts';
import type { Explanation } from './twin.ts';

export interface TwinSentences {
  /** "idade mediana: 32,1 e 32,4" (follows "Parecem em") */
  similar: string[];
  /** "população residente: 11.451.999 contra 3.202" (follows "Mais diferem em") */
  different: string | null;
}

/**
 * An indicator label as it reads mid-sentence: "População residente" becomes "população residente", but an
 * acronym such as "PIB per capita" keeps its capitals.
 */
export function inSentence(label: string): string {
  const [first = '', second = ''] = label;
  if (second !== second.toLowerCase()) return label;
  return first.toLowerCase() + label.slice(1);
}

/**
 * Among `cols`, the one where the two raw values are closest relative to their size; null when none has
 * both values. Used to pick the one resemblance worth printing: a small z-score gap can still be a 30%
 * gap in people, which does not read as alike. `skip` leaves out columns that would say nothing (see
 * `bothAtLimit`) or were already shown.
 */
export function closestRelative(
  cols: readonly number[],
  valueA: (col: number) => number | null,
  valueB: (col: number) => number | null,
  skip: (col: number, a: number, b: number) => boolean = () => false,
): number | null {
  let best: number | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const col of cols) {
    const a = valueA(col);
    const b = valueB(col);
    if (a === null || b === null || skip(col, a, b)) continue;
    const scale = Math.max(Math.abs(a), Math.abs(b));
    const gap = scale === 0 ? 0 : Math.abs(a - b) / scale;
    if (gap < bestGap) {
      bestGap = gap;
      best = col;
    }
  }
  return best;
}

/**
 * True when two shares both sit at the edge of the scale (both 0% or both 100%, to one decimal place):
 * hundreds of municipalities share that value, so it does not explain why two of them are twins.
 */
export function bothAtLimit(unidade: string, a: number, b: number): boolean {
  if (unidade !== 'fração') return false;
  const atZero = (value: number) => value < 0.0005;
  const atOne = (value: number) => value > 0.9995;
  return (atZero(a) && atZero(b)) || (atOne(a) && atOne(b));
}

/** Plain-Portuguese lines for the indicators where two municipalities are closest and where they differ most. */
export function describeTwin(
  explanation: Explanation,
  indicators: readonly Pick<IndicatorDef, 'rotulo' | 'unidade'>[],
  valueA: (col: number) => number | null,
  valueB: (col: number) => number | null,
): TwinSentences {
  const show = (col: number, get: (c: number) => number | null): string => {
    const indicator = indicators[col];
    if (!indicator) throw new Error(`No indicator at column ${String(col)}`);
    return formatIndicatorValue(get(col), indicator.unidade);
  };
  const label = (col: number): string => inSentence(indicators[col]?.rotulo ?? '');
  return {
    similar: explanation.similar.map((item) => `${label(item.col)}: ${show(item.col, valueA)} e ${show(item.col, valueB)}`),
    different: explanation.different
      ? `${label(explanation.different.col)}: ${show(explanation.different.col, valueA)} contra ${show(explanation.different.col, valueB)}`
      : null,
  };
}
