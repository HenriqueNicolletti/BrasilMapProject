import type { Topology } from 'topojson-specification';
import { z } from 'zod';

// ---- IBGE API responses (validated before anything is saved) ----

export const ufSchema = z.object({
  id: z.number(),
  sigla: z.string().length(2),
  nome: z.string(),
  regiao: z.object({ id: z.number(), sigla: z.string(), nome: z.string() }),
});

/**
 * `microrregiao` is null for municipalities created after the micro-region grid was frozen
 * (Boa Esperança do Norte, MT). `regiao-imediata` is always present, so the state comes from there.
 */
export const localidadeMunicipioSchema = z.object({
  id: z.number(),
  nome: z.string(),
  'regiao-imediata': z.object({
    id: z.number(),
    nome: z.string(),
    'regiao-intermediaria': z.object({
      id: z.number(),
      nome: z.string(),
      UF: ufSchema,
    }),
  }),
});

const agregadoSerieSchema = z.object({
  localidade: z.object({
    id: z.string(),
    nivel: z.object({ id: z.string(), nome: z.string() }),
    nome: z.string(),
  }),
  serie: z.record(z.string(), z.string()),
});

const agregadoResultadoSchema = z.object({
  classificacoes: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      categoria: z.record(z.string(), z.string()),
    }),
  ),
  series: z.array(agregadoSerieSchema),
});

export const agregadoResponseSchema = z.array(
  z.object({
    id: z.string(),
    variavel: z.string(),
    unidade: z.string(),
    resultados: z.array(agregadoResultadoSchema),
  }),
);

export const nomesResponseSchema = z.array(
  z.object({
    localidade: z.string(),
    sexo: z.string().nullable(),
    res: z.array(z.object({ nome: z.string(), frequencia: z.number(), ranking: z.number() })),
  }),
);

/** An IBGE mesh: one topology whose geometries each carry the IBGE code in `codarea`. */
export const malhaSchema = z.looseObject({
  type: z.literal('Topology'),
  objects: z.record(
    z.string(),
    z.looseObject({
      type: z.literal('GeometryCollection'),
      geometries: z.array(z.looseObject({ properties: z.looseObject({ codarea: z.string() }) })),
    }),
  ),
  arcs: z.array(z.array(z.array(z.number()))),
  transform: z.looseObject({ scale: z.tuple([z.number(), z.number()]), translate: z.tuple([z.number(), z.number()]) }).optional(),
});

/** The validated mesh, typed for topojson-client. The schema above is what guarantees the shape. */
export function parseMalha(input: unknown): Topology {
  return malhaSchema.parse(input) as unknown as Topology;
}

// ---- Processed files committed to src/data/ ----

const codigoMunicipio = z.string().regex(/^\d{7}$/, 'municipality code must be a 7-digit string');
const codigoUf = z.string().regex(/^\d{2}$/, 'state code must be a 2-digit string');

export const municipioSchema = z.object({
  codigo: codigoMunicipio,
  nome: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  uf: z.string().length(2),
  ufCodigo: codigoUf,
  regiao: z.string(),
  regiaoImediata: z.string(),
  /** false when IBGE publishes the municipality but none of the indicators (e.g. one created after the 2022 Census). */
  temDados: z.boolean(),
  /** Centroid of the mesh geometry; null when the mesh has none for this municipality. */
  lat: z.number().min(-34).max(6).nullable(),
  lon: z.number().min(-75).max(-28).nullable(),
});

export const ufProcessadaSchema = z.object({
  codigo: codigoUf,
  sigla: z.string().length(2),
  nome: z.string(),
  regiao: z.string(),
  /** State-level figures straight from IBGE table 4714 (2022), not summed from municipalities. */
  populacao: z.number().int().positive(),
  area: z.number().positive(),
  densidade: z.number().positive(),
});

export const indicadoresMetaSchema = z.object({
  /** Changes whenever the matrix or its definitions change; lets the client drop a stale cache. */
  hash: z.string(),
  linhas: z.number().int(),
  colunas: z.number().int(),
  indicadores: z.array(
    z.object({
      id: z.string(),
      rotulo: z.string(),
      unidade: z.string(),
      eixo: z.enum(['demografia', 'territorio', 'economia', 'infraestrutura']),
      ano: z.string(),
      fonte: z.string(),
      transform: z.enum(['log', 'linear']),
      /** Municipalities with a value, out of `linhas`. */
      cobertura: z.number().int(),
    }),
  ),
});

export const nomesProcessadosSchema = z.object({
  ano: z.number().int(),
  fonte: z.string(),
  porMunicipio: z.record(codigoMunicipio, z.array(z.object({ nome: z.string(), frequencia: z.number().int() }))),
});

export type Uf = z.infer<typeof ufSchema>;
export type LocalidadeMunicipio = z.infer<typeof localidadeMunicipioSchema>;
export type AgregadoResponse = z.infer<typeof agregadoResponseSchema>;
export type NomesResponse = z.infer<typeof nomesResponseSchema>;
export type Municipio = z.infer<typeof municipioSchema>;
export type UfProcessada = z.infer<typeof ufProcessadaSchema>;
export type IndicadoresMeta = z.infer<typeof indicadoresMetaSchema>;
export type NomesProcessados = z.infer<typeof nomesProcessadosSchema>;
