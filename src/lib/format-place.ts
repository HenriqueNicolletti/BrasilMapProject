import { NO_DATA, formatInteger } from './format.ts';
import type { Rank } from './rank.ts';

/** Census 2010 names arrive in upper case without accents: "MARIA DAS GRACAS" becomes "Maria Das Gracas". */
export function capitalizeName(name: string): string {
  return name.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);
}

const degrees = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `23,65° S, 46,65° O`: latitude first, with the hemisphere spelled the pt-BR way (O for west, L for east). */
export function formatCoordinates(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return NO_DATA;
  return `${degrees.format(Math.abs(lat))}° ${lat < 0 ? 'S' : 'N'}, ${degrees.format(Math.abs(lon))}° ${lon < 0 ? 'O' : 'L'}`;
}

/** `12º de 5.570`. */
export function formatRank(rank: Rank | null): string {
  return rank === null ? NO_DATA : `${formatInteger(rank.posicao)}º de ${formatInteger(rank.total)}`;
}
