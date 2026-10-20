// Build-time loader for src/data/. Imported only from Astro frontmatter (it reads the disk);
// nothing here ships to the browser. Each file is validated again on load.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Topology } from 'topojson-specification';
import { z } from 'zod';
import { topologyFeatures, type CodedFeature } from './geo.ts';
import { INDICATORS } from './indicators.ts';
import { decodeMatrix } from './matrix.ts';
import { makeRanker, type Rank } from './rank.ts';
import {
  indicadoresMetaSchema,
  municipioSchema,
  nomesProcessadosSchema,
  parseMalha,
  ufProcessadaSchema,
  type Municipio,
  type UfProcessada,
} from './schemas.ts';

// `astro build` and `astro dev` both run from the project root.
const DATA = join(process.cwd(), 'src', 'data');

const readJson = (relative: string): unknown => JSON.parse(readFileSync(join(DATA, relative), 'utf8'));

export const municipios = z.array(municipioSchema).parse(readJson('municipios.json'));
export const ufs = z.array(ufProcessadaSchema).parse(readJson('ufs.json'));
export const meta = indicadoresMetaSchema.parse(readJson('indicadores.meta.json'));
export const matrix = decodeMatrix(new Uint8Array(readFileSync(join(DATA, 'indicadores.bin'))), meta.linhas, meta.colunas);
export const nomes = nomesProcessadosSchema.parse(readJson('nomes.json'));

/** Row of a municipality in the matrix: `municipios.json` is sorted by code, like the matrix. */
export const municipioRow = new Map(municipios.map((municipio, row) => [municipio.codigo, row]));
export const ufByCodigo = new Map(ufs.map((uf) => [uf.codigo, uf]));

export function brasilUfMesh(): Topology {
  return parseMalha(readJson('malhas/uf.topo.json'));
}

// Every municipality page of a state reads the same mesh; parse each one once.
const meshCache = new Map<string, Topology>();
export function ufMunicipiosMesh(sigla: string): Topology {
  const key = sigla.toLowerCase();
  let mesh = meshCache.get(key);
  if (!mesh) {
    mesh = parseMalha(readJson(`malhas/uf/${key}.topo.json`));
    meshCache.set(key, mesh);
  }
  return mesh;
}

const featureCache = new Map<string, CodedFeature[]>();
/** Municipality shapes of a state, by municipality code. */
export function ufMunicipiosFeatures(sigla: string): CodedFeature[] {
  const key = sigla.toLowerCase();
  let features = featureCache.get(key);
  if (!features) {
    features = topologyFeatures(ufMunicipiosMesh(key));
    featureCache.set(key, features);
  }
  return features;
}

let ufOutlines: Map<string, CodedFeature> | undefined;
/** The outline of a state, from the country-level mesh. */
export function ufOutline(codigoUf: string): CodedFeature | undefined {
  ufOutlines ??= new Map(topologyFeatures(brasilUfMesh()).map((feature) => [feature.codigo, feature]));
  return ufOutlines.get(codigoUf);
}

// ---- Rankings: position of a municipality among all, and among those of its state ----

const column = (c: number, rows: readonly number[]) => rows.map((row) => matrix.get(row, c));
const allRows = municipios.map((_, row) => row);
const nacional = INDICATORS.map((_, c) => makeRanker(column(c, allRows)));
const porUf = new Map<string, ReturnType<typeof makeRanker>[]>();

function ufRankers(codigoUf: string) {
  let rankers = porUf.get(codigoUf);
  if (!rankers) {
    const rows = allRows.filter((row) => municipios[row]?.ufCodigo === codigoUf);
    rankers = INDICATORS.map((_, c) => makeRanker(column(c, rows)));
    porUf.set(codigoUf, rankers);
  }
  return rankers;
}

export interface MunicipioRanks {
  brasil: (Rank | null)[];
  uf: (Rank | null)[];
}

export function ranksOf(municipio: Municipio): MunicipioRanks {
  const row = municipioRow.get(municipio.codigo);
  if (row === undefined) throw new Error(`Municipality ${municipio.codigo} is not in the matrix`);
  const state = ufRankers(municipio.ufCodigo);
  const value = (c: number) => matrix.get(row, c);
  return {
    brasil: nacional.map((rank, c) => rank(value(c))),
    uf: state.map((rank, c) => rank(value(c))),
  };
}

export function ufOf(municipio: Municipio): UfProcessada {
  const uf = ufByCodigo.get(municipio.ufCodigo);
  if (!uf) throw new Error(`State ${municipio.ufCodigo} is not in ufs.json`);
  return uf;
}
