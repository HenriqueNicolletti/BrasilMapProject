const LOCALE = 'pt-BR';

export const NO_DATA = 'sem dado';

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function isUsable(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/** Missing data is never rendered as 0: null, undefined, NaN and Infinity all read "sem dado". */
export function formatInteger(value: number | null | undefined): string {
  return isUsable(value) ? integer.format(value) : NO_DATA;
}

export function formatDecimal(value: number | null | undefined): string {
  return isUsable(value) ? decimal.format(value) : NO_DATA;
}

/** Takes a fraction (0.253 becomes "25,3%"). */
export function formatPercent(fraction: number | null | undefined): string {
  return isUsable(fraction) ? percent.format(fraction) : NO_DATA;
}

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Formats one indicator value for its unit (see `unidade` in `indicadores.meta.json`). */
export function formatIndicatorValue(value: number | null | undefined, unidade: string): string {
  switch (unidade) {
    case 'fração':
      return formatPercent(value);
    case 'pessoas':
      return formatInteger(value);
    case 'hab/km²':
    case 'km²':
    case 'anos':
    case 'idosos por 100 jovens':
      return formatDecimal(value);
    case 'R$':
      return isUsable(value) ? currency.format(value) : NO_DATA;
    default:
      throw new Error(`No format defined for unit "${unidade}"`);
  }
}

const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', compactDisplay: 'short' });
const compactCurrency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL', notation: 'compact', compactDisplay: 'short' });
const compactPercent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });

/** A short form for labels printed on a map ("44 mi"); empty when there is nothing to print. */
export function formatCompactValue(value: number | null | undefined, unidade: string): string {
  switch (unidade) {
    case 'fração':
      return isUsable(value) ? compactPercent.format(value) : '';
    case 'pessoas':
    case 'hab/km²':
    case 'km²':
    case 'anos':
    case 'idosos por 100 jovens':
      return isUsable(value) ? compact.format(value).replace(/ /g, ' ') : '';
    case 'R$':
      return isUsable(value) ? compactCurrency.format(value).replace(/\u00a0/g, ' ') : '';
    default:
      throw new Error(`No compact format defined for unit "${unidade}"`);
  }
}
