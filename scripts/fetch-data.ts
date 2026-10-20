// Downloads the IBGE data the site needs and writes the processed files to src/data/.
//
//   npm run data:fetch              reuse data/raw/ when present
//   npm run data:fetch -- --refresh download everything again
//
// Every API response is validated by a Zod schema BEFORE it is cached, so a changed or broken
// response fails here and never reaches src/data/. The site build never touches the IBGE.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { extractSeries } from '../src/lib/agregados.ts';
import { buildDataset } from '../src/lib/dataset.ts';
import { featureCentroid, topologyFeatures } from '../src/lib/geo.ts';
import { INDICATORS, type RawKey } from '../src/lib/indicators.ts';
import { encodeMatrix } from '../src/lib/matrix.ts';
import { fetchTextWithRetry } from '../src/lib/retry.ts';
import {
  agregadoResponseSchema,
  localidadeMunicipioSchema,
  malhaSchema,
  nomesResponseSchema,
  parseMalha,
  ufSchema,
  type AgregadoResponse,
  type IndicadoresMeta,
  type NomesProcessados,
  type UfProcessada,
} from '../src/lib/schemas.ts';
import type { SidraKind } from '../src/lib/sidra-value.ts';
import { z } from 'zod';

const API = 'https://servicodados.ibge.gov.br/api';
const ROOT = join(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const OUT_DIR = join(ROOT, 'src', 'data');
const REFRESH = process.argv.includes('--refresh');

// If IBGE creates a municipality these change; the script stops so a person looks at why.
const EXPECTED = { municipios: 5571, comDados: 5570, ufs: 27 } as const;

// Each mesh file stays under 1 MB (project rule), measured before compression.
const MAX_MESH_BYTES = 1_000_000;

// The IBGE needs brackets and pipes percent-encoded; some tools fail without it.
const encode = (url: string) => url.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\|/g, '%7C');

async function getJson<T>(cacheName: string, url: string, schema: ZodType<T>): Promise<T> {
  const cachePath = join(RAW_DIR, `${cacheName}.json`);
  if (!REFRESH && existsSync(cachePath)) {
    return schema.parse(JSON.parse(await readFile(cachePath, 'utf8')));
  }
  const text = await fetchTextWithRetry(encode(url));
  const parsed = schema.parse(JSON.parse(text)); // throws before anything is cached
  await mkdir(join(cachePath, '..'), { recursive: true });
  await writeFile(cachePath, text);
  return parsed;
}

interface AgregadoRequest {
  tabela: string;
  periodo: string;
  variaveis: string[];
  classificacao?: string;
  /** Territorial level; municipalities (N6) unless stated. N3 is the state level. */
  nivel?: 'N3' | 'N6';
}

const AGREGADOS: Record<string, AgregadoRequest> = {
  populacaoUf: { tabela: '4714', periodo: '2022', variaveis: ['93', '6318', '614'], nivel: 'N3' },
  populacao: { tabela: '4714', periodo: '2022', variaveis: ['93', '6318', '614'] },
  idade: { tabela: '9515', periodo: '2022', variaveis: ['10612', '10613'] },
  situacao: { tabela: '9923', periodo: '2022', variaveis: ['93'], classificacao: '1[6795,1]' },
  esgoto: { tabela: '6805', periodo: '2022', variaveis: ['381'], classificacao: '11558[46292,46290]' },
  lixo: { tabela: '6892', periodo: '2022', variaveis: ['381'], classificacao: '67[10972,2520]' },
  pib: { tabela: '5938', periodo: '2021', variaveis: ['498', '513', '517', '6575', '525', '37'] },
  // Mean monthly household income per capita; the totals of sex, colour or race and age group.
  renda: { tabela: '10295', periodo: '2022', variaveis: ['13431'], classificacao: '2[6794]|86[95251]|58[95253]' },
};

function agregadoUrl(request: AgregadoRequest): string {
  const classificacao = request.classificacao ? `&classificacao=${request.classificacao}` : '';
  const nivel = request.nivel ?? 'N6';
  return `${API}/v3/agregados/${request.tabela}/periodos/${request.periodo}/variaveis/${request.variaveis.join('|')}?localidades=${nivel}[all]${classificacao}`;
}

interface RawSource {
  key: RawKey;
  from: keyof typeof AGREGADOS;
  variavel: string;
  categoria?: string;
  kind: SidraKind;
}

// A lone "-" is IBGE's true zero only in counts; the parser refuses it in a measure.
const RAW_SOURCES: RawSource[] = [
  { key: 'pop', from: 'populacao', variavel: '93', kind: 'count' },
  { key: 'area', from: 'populacao', variavel: '6318', kind: 'measure' },
  { key: 'dens', from: 'populacao', variavel: '614', kind: 'measure' },
  { key: 'envelhecimento', from: 'idade', variavel: '10612', kind: 'measure' },
  { key: 'idadeMediana', from: 'idade', variavel: '10613', kind: 'measure' },
  { key: 'popTotal', from: 'situacao', variavel: '93', categoria: '6795', kind: 'count' },
  { key: 'popUrbana', from: 'situacao', variavel: '93', categoria: '1', kind: 'count' },
  { key: 'domEsgotoTotal', from: 'esgoto', variavel: '381', categoria: '46292', kind: 'count' },
  { key: 'domEsgotoRede', from: 'esgoto', variavel: '381', categoria: '46290', kind: 'count' },
  { key: 'domLixoTotal', from: 'lixo', variavel: '381', categoria: '10972', kind: 'count' },
  { key: 'domLixoColetado', from: 'lixo', variavel: '381', categoria: '2520', kind: 'count' },
  { key: 'pib', from: 'pib', variavel: '37', kind: 'measure' },
  { key: 'vaTotal', from: 'pib', variavel: '498', kind: 'measure' },
  { key: 'vaAgro', from: 'pib', variavel: '513', kind: 'measure' },
  { key: 'vaInd', from: 'pib', variavel: '517', kind: 'measure' },
  { key: 'vaServ', from: 'pib', variavel: '6575', kind: 'measure' },
  { key: 'vaAdm', from: 'pib', variavel: '525', kind: 'measure' },
  { key: 'rendaPc', from: 'renda', variavel: '13431', categoria: '6794', kind: 'measure' },
];

/** One object per line keeps diffs readable and the files small. */
const toJsonLines = (items: readonly unknown[]) => `[\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n]\n`;

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  console.log(REFRESH ? 'Downloading everything again (--refresh)...' : 'Using data/raw/ where present...');

  console.log('Localities...');
  const estados = await getJson('localidades-estados', `${API}/v1/localidades/estados`, z.array(ufSchema));
  const localidades = await getJson('localidades-municipios', `${API}/v1/localidades/municipios`, z.array(localidadeMunicipioSchema));

  console.log('Aggregates...');
  const responses = new Map<string, AgregadoResponse>();
  for (const [name, request] of Object.entries(AGREGADOS)) {
    console.log(`  ${name} (table ${request.tabela})`);
    responses.set(name, await getJson(`agregado-${name}`, agregadoUrl(request), agregadoResponseSchema));
  }

  const raw = {} as Record<RawKey, ReadonlyMap<string, number | null>>;
  for (const source of RAW_SOURCES) {
    const response = responses.get(source.from);
    if (!response) throw new Error(`No response for ${source.from}`);
    const periodo = AGREGADOS[source.from]?.periodo ?? '';
    const categoria = source.categoria === undefined ? {} : { categoria: source.categoria };
    raw[source.key] = extractSeries(response, { variavel: source.variavel, ano: periodo, kind: source.kind, ...categoria });
  }

  const dataset = buildDataset(localidades, raw);
  const comDados = dataset.municipios.filter((m) => m.temDados).length;
  if (dataset.municipios.length !== EXPECTED.municipios || comDados !== EXPECTED.comDados || estados.length !== EXPECTED.ufs) {
    throw new Error(
      `Unexpected counts: ${String(dataset.municipios.length)} municipalities (${String(comDados)} with data), ${String(estados.length)} states; ` +
        `expected ${String(EXPECTED.municipios)} (${String(EXPECTED.comDados)}) and ${String(EXPECTED.ufs)}. Check what changed at IBGE, then update EXPECTED.`,
    );
  }

  console.log('Meshes (1 for the country by state, 27 by state with municipalities)...');
  const malhaQuery = 'formato=application/json&qualidade=intermediaria';
  const malhaUf = await getJson('malha-uf', `${API}/v3/malhas/paises/BR?${malhaQuery}&intrarregiao=UF`, malhaSchema);
  const malhaFiles: { path: string; text: string }[] = [
    { path: join(OUT_DIR, 'malhas', 'uf.topo.json'), text: JSON.stringify(malhaUf) },
  ];
  const centroids = new Map<string, [number, number]>();
  const knownCodes = new Set(dataset.municipios.map((m) => m.codigo));
  for (const uf of estados) {
    const sigla = uf.sigla.toLowerCase();
    const url = `${API}/v3/malhas/estados/${String(uf.id)}?${malhaQuery}&intrarregiao=municipio`;
    const topology = parseMalha(await getJson(`malha-${sigla}`, url, malhaSchema));
    for (const { codigo, feature } of topologyFeatures(topology)) {
      if (!knownCodes.has(codigo)) throw new Error(`The ${uf.sigla} mesh has municipality ${codigo}, which is not in the locality list`);
      centroids.set(codigo, featureCentroid(feature));
    }
    malhaFiles.push({ path: join(OUT_DIR, 'malhas', 'uf', `${sigla}.topo.json`), text: JSON.stringify(topology) });
  }
  for (const { path, text } of malhaFiles) {
    const bytes = Buffer.byteLength(text);
    if (bytes > MAX_MESH_BYTES) throw new Error(`${path} is ${String(bytes)} bytes, over the ${String(MAX_MESH_BYTES)} limit`);
  }
  for (const municipio of dataset.municipios) {
    const centroid = centroids.get(municipio.codigo);
    if (centroid) {
      municipio.lon = Math.round(centroid[0] * 10000) / 10000;
      municipio.lat = Math.round(centroid[1] * 10000) / 10000;
    }
  }
  const semMalha = dataset.municipios.filter((m) => !centroids.has(m.codigo));
  console.log(`  ${String(centroids.size)} municipalities have geometry; without: ${semMalha.map((m) => m.slug).join(', ') || 'none'}`);

  console.log('Names (one request per municipality, 8 at a time)...');
  const nomesProcessados: NomesProcessados = {
    ano: 2010,
    fonte: 'IBGE, Censo Demográfico 2010 (API de nomes v2)',
    porMunicipio: {},
  };
  let done = 0;
  const nomes = await mapWithConcurrency(dataset.municipios, 8, async (municipio) => {
    const url = `${API}/v2/censos/nomes/ranking?localidade=${municipio.codigo}`;
    const response = await getJson(`nomes/${municipio.codigo}`, url, nomesResponseSchema);
    done += 1;
    if (done % 500 === 0) console.log(`  ${String(done)}/${String(dataset.municipios.length)}`);
    return { codigo: municipio.codigo, res: response[0]?.res ?? [] };
  });
  for (const { codigo, res } of nomes) {
    nomesProcessados.porMunicipio[codigo] = res.map(({ nome, frequencia }) => ({ nome, frequencia }));
  }

  console.log('Writing src/data/...');
  await mkdir(OUT_DIR, { recursive: true });

  const ufResponse = responses.get('populacaoUf');
  if (!ufResponse) throw new Error('No state-level response');
  const ufSeries = (variavel: string, kind: SidraKind) => extractSeries(ufResponse, { variavel, ano: '2022', kind });
  const ufPop = ufSeries('93', 'count');
  const ufArea = ufSeries('6318', 'measure');
  const ufDens = ufSeries('614', 'measure');
  const ufs: UfProcessada[] = estados
    .map((uf) => {
      const codigo = String(uf.id);
      const populacao = ufPop.get(codigo);
      const area = ufArea.get(codigo);
      const densidade = ufDens.get(codigo);
      if (populacao == null || area == null || densidade == null) throw new Error(`State ${uf.sigla} has no population, area or density from IBGE`);
      return { codigo, sigla: uf.sigla, nome: uf.nome, regiao: uf.regiao.nome, populacao, area, densidade };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const bytes = encodeMatrix(dataset.rows);
  const hash = createHash('sha256').update(bytes).update(JSON.stringify(INDICATORS)).digest('hex').slice(0, 16);
  const meta: IndicadoresMeta = {
    hash,
    linhas: dataset.rows.length,
    colunas: INDICATORS.length,
    indicadores: INDICATORS.map((indicator) => ({ ...indicator, cobertura: dataset.cobertura[indicator.id] ?? 0 })),
  };

  const nomesLines = Object.entries(nomesProcessados.porMunicipio).map(([codigo, lista]) => `${JSON.stringify(codigo)}:${JSON.stringify(lista)}`);
  const nomesJson = `{"ano":${String(nomesProcessados.ano)},"fonte":${JSON.stringify(nomesProcessados.fonte)},"porMunicipio":{\n${nomesLines.join(',\n')}\n}}\n`;

  await mkdir(join(OUT_DIR, 'malhas', 'uf'), { recursive: true });
  for (const { path, text } of malhaFiles) await writeFile(path, text);
  await writeFile(join(OUT_DIR, 'ufs.json'), toJsonLines(ufs));
  await writeFile(join(OUT_DIR, 'municipios.json'), toJsonLines(dataset.municipios));
  await writeFile(join(OUT_DIR, 'indicadores.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'indicadores.bin'), bytes);
  await writeFile(join(OUT_DIR, 'nomes.json'), nomesJson);

  console.log(`Done: ${String(dataset.municipios.length)} municipalities (${String(comDados)} with data), ${String(ufs.length)} states, hash ${hash}.`);
}

await main();
