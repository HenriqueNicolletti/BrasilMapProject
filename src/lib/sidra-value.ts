/** `count` is a tally (households, people); `measure` is anything else (area, median age, money). */
export type SidraKind = 'count' | 'measure';

const MISSING_SYMBOLS = new Set(['X', '..', '...', '']);
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Reads one value from an IBGE aggregates response.
 *
 * `null` means "sem dado". A lone "-" is IBGE's mark for a true zero, which is real data, but only
 * in a count; in a measure it would be a guess, so it throws instead.
 */
export function parseSidraValue(raw: string, kind: SidraKind): number | null {
  if (MISSING_SYMBOLS.has(raw)) return null;
  if (raw === '-') {
    if (kind === 'count') return 0;
    throw new Error(`Unexpected "-" in a measure value; it only means zero in counts (kind: ${kind})`);
  }
  if (NUMBER.test(raw)) return Number(raw);
  throw new Error(`Unknown IBGE value symbol: "${raw}"`);
}
