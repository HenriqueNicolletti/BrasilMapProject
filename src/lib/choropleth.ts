import { classBreaks, classIndex, legendRanges } from './classify.ts';
import { NO_DATA, formatCompactValue, formatIndicatorValue } from './format.ts';

/** Steps in the colour ramp (`--scale-seq-1` to `--scale-seq-7`). */
export const RAMP_STEPS = 7;

export interface MapItemInput {
  codigo: string;
  nome: string;
  value: number | null;
}

export interface ClassifiedItem extends MapItemInput {
  /** Class among the classes in use; `null` means "sem dado" and gets no colour of the scale. */
  cls: number | null;
  /** Position on the colour ramp, 0 to 6; `null` with `cls`. */
  step: number | null;
  valueText: string;
  /** Short form for a label printed on the map; empty when there is no value. */
  compactText: string;
}

export interface LegendEntry {
  cls: number;
  step: number;
  label: string;
}

export interface ChoroplethModel {
  items: ClassifiedItem[];
  legend: LegendEntry[];
  hasNoData: boolean;
}

/** Fewer classes are spread over the whole ramp, so contrast does not shrink with them. */
function stepFor(cls: number, classesInUse: number): number {
  if (classesInUse <= 1) return Math.floor(RAMP_STEPS / 2);
  return Math.round((cls * (RAMP_STEPS - 1)) / (classesInUse - 1));
}

export function classifyItems(
  inputs: readonly MapItemInput[],
  unidade: string,
  options: { classes?: number } = {},
): ChoroplethModel {
  const classes = options.classes ?? RAMP_STEPS;
  const values = inputs.map((input) => input.value);
  const breaks = classBreaks(values, classes);
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const classesInUse = present.length === 0 ? 0 : breaks.length + 1;

  const items = inputs.map((input) => {
    const cls = classIndex(input.value, breaks);
    return {
      ...input,
      cls,
      step: cls === null ? null : stepFor(cls, classesInUse),
      valueText: formatIndicatorValue(input.value, unidade),
      compactText: formatCompactValue(input.value, unidade),
    };
  });

  const legend =
    present.length === 0
      ? []
      : legendRanges(breaks, Math.min(...present), Math.max(...present)).map((range) => ({
          cls: range.index,
          step: stepFor(range.index, classesInUse),
          label: `${formatIndicatorValue(range.from, unidade)} a ${formatIndicatorValue(range.to, unidade)}`,
        }));

  return { items, legend, hasNoData: items.some((item) => item.valueText === NO_DATA) };
}
