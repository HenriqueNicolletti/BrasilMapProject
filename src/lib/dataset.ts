import { INDICATORS, deriveIndicators, type RawTables } from './indicators.ts';
import type { LocalidadeMunicipio, Municipio } from './schemas.ts';
import { findDuplicateSlugs, municipioSlug } from './slug.ts';

export interface Dataset {
  /** Sorted by code; row `i` of `rows` belongs to `municipios[i]`. */
  municipios: Municipio[];
  rows: number[][];
  /** Municipalities with a value, per indicator id. */
  cobertura: Record<string, number>;
}

export function buildDataset(localidades: readonly LocalidadeMunicipio[], raw: RawTables): Dataset {
  const municipios: Municipio[] = [...localidades]
    .sort((a, b) => a.id - b.id)
    .map((local) => {
      const intermediaria = local['regiao-imediata']['regiao-intermediaria'];
      const uf = intermediaria.UF;
      return {
        codigo: String(local.id),
        nome: local.nome,
        slug: municipioSlug(local.nome, uf.sigla),
        uf: uf.sigla,
        ufCodigo: String(uf.id),
        regiao: uf.regiao.nome,
        regiaoImediata: local['regiao-imediata'].nome,
        temDados: false,
        // Filled from the mesh by the data script; null until then.
        lat: null,
        lon: null,
      };
    });

  const duplicates = findDuplicateSlugs(municipios.map((m) => m.slug));
  if (duplicates.length > 0) throw new Error(`Duplicate municipality slugs: ${duplicates.join(', ')}`);

  const known = new Set(municipios.map((m) => m.codigo));
  for (const table of Object.values(raw)) {
    for (const code of table.keys()) {
      if (!known.has(code)) throw new Error(`The IBGE tables mention municipality ${code}, which is not in the locality list`);
    }
  }

  const cobertura: Record<string, number> = Object.fromEntries(INDICATORS.map((indicator) => [indicator.id, 0]));
  const rows = municipios.map((municipio) => {
    const row = deriveIndicators(raw, municipio.codigo);
    INDICATORS.forEach((indicator, column) => {
      if (!Number.isNaN(row[column])) cobertura[indicator.id] = (cobertura[indicator.id] ?? 0) + 1;
    });
    municipio.temDados = row.some((value) => !Number.isNaN(value));
    return row;
  });

  return { municipios, rows, cobertura };
}
