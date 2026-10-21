import type { DecodedMatrix } from './matrix.ts';

/**
 * One selectable indicator. Values come inline (`valores`, which win when present) or from a matrix
 * column (`coluna`, fetched on demand). The default indicator always carries `valores`, so the page
 * can start without loading the matrix.
 */
export interface MapIndicator {
  id: string;
  rotulo: string;
  unidade: string;
  ano: string;
  fonte: string;
  coluna?: number;
  valores?: (number | null)[];
}

export interface MapItemRef {
  codigo: string;
  nome: string;
  /** Row in `indicadores.bin`; absent for items that are not in the matrix. */
  row?: number | undefined;
  /** Page slug, when the item has its own page under `MapData.hrefBase`. */
  slug?: string | undefined;
  /** The state capital, on a state map. */
  capital?: boolean | undefined;
}

/** What the page hands to the browser script, as JSON in `#choropleth-data`. */
export interface MapData {
  /** Plain words for the legend note, e.g. "dos municípios de Minas Gerais". */
  escopo: string;
  binUrl?: string;
  linhas?: number;
  colunas?: number;
  indicadores: MapIndicator[];
  itens: MapItemRef[];
  padrao: string;
  /** Destination for a row or shape, by item code, when the item has its own page. */
  hrefs?: Record<string, string>;
  /** Prefix for pages named by slug, e.g. "/municipio/". */
  hrefBase?: string;
}

/** Where an item leads: its explicit destination, else the base plus its slug, else nowhere. */
export function itemHref(data: Pick<MapData, 'hrefs' | 'hrefBase'>, item: MapItemRef): string | undefined {
  const explicit = data.hrefs?.[item.codigo];
  if (explicit !== undefined) return explicit;
  if (data.hrefBase !== undefined && item.slug !== undefined) return `${data.hrefBase}${item.slug}/`;
  return undefined;
}

export function indicatorValues(
  indicator: MapIndicator,
  itens: readonly MapItemRef[],
  matrix: DecodedMatrix | null,
): (number | null)[] {
  if (indicator.valores) return itens.map((_, index) => indicator.valores?.[index] ?? null);
  if (indicator.coluna === undefined) throw new Error(`Indicator ${indicator.id} has neither values nor a column`);
  const coluna = indicator.coluna;
  if (!matrix) throw new Error(`Indicator ${indicator.id} needs the matrix, which is not loaded`);
  return itens.map((item) => (item.row === undefined ? null : matrix.get(item.row, coluna)));
}
