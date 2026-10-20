import { describe, expect, it } from 'vitest';
import {
  agregadoResponseSchema,
  localidadeMunicipioSchema,
  malhaSchema,
  municipioSchema,
  nomesResponseSchema,
  ufProcessadaSchema,
  ufSchema,
} from './schemas.ts';

const UF_MT = { id: 51, sigla: 'MT', nome: 'Mato Grosso', regiao: { id: 5, sigla: 'CO', nome: 'Centro-Oeste' } };
const IMEDIATA = { id: 510008, nome: 'Sorriso', 'regiao-intermediaria': { id: 5103, nome: 'Sinop', UF: UF_MT } };

describe('localidadeMunicipioSchema', () => {
  it('accepts a municipality whose microrregiao is null (Boa Esperança do Norte)', () => {
    const parsed = localidadeMunicipioSchema.parse({
      id: 5101837,
      nome: 'Boa Esperança do Norte',
      microrregiao: null,
      'regiao-imediata': IMEDIATA,
    });
    expect(parsed['regiao-imediata']['regiao-intermediaria'].UF.sigla).toBe('MT');
  });

  it('rejects a municipality with no regiao-imediata, since the state would be unknown', () => {
    expect(() => localidadeMunicipioSchema.parse({ id: 1, nome: 'X', microrregiao: null })).toThrow();
  });
});

describe('ufSchema', () => {
  it('reads a state', () => {
    expect(ufSchema.parse(UF_MT).regiao.sigla).toBe('CO');
  });
});

describe('agregadoResponseSchema', () => {
  it('reads variables, classifications and per-municipality series', () => {
    const parsed = agregadoResponseSchema.parse([
      {
        id: '93',
        variavel: 'População residente',
        unidade: 'Pessoas',
        resultados: [
          {
            classificacoes: [{ id: '1', nome: 'Situação do domicílio', categoria: { '100': 'Urbana' } }],
            series: [{ localidade: { id: '3550308', nivel: { id: 'N6', nome: 'Município' }, nome: 'São Paulo (SP)' }, serie: { '2022': '11451999' } }],
          },
        ],
      },
    ]);
    expect(parsed[0]?.resultados[0]?.series[0]?.serie['2022']).toBe('11451999');
  });

  it('rejects a response that is not an array of variables', () => {
    expect(() => agregadoResponseSchema.parse({ statusCode: 500, message: 'Internal server error' })).toThrow();
  });
});

describe('nomesResponseSchema', () => {
  it('accepts a list shorter than 20 names', () => {
    const parsed = nomesResponseSchema.parse([
      { localidade: '1100015', sexo: null, res: [{ nome: 'MARIA', frequencia: 1135, ranking: 1 }] },
    ]);
    expect(parsed[0]?.res).toHaveLength(1);
  });
});

describe('municipioSchema (processed file)', () => {
  const valid = { codigo: '3550308', nome: 'São Paulo', slug: 'sao-paulo-sp', uf: 'SP', ufCodigo: '35', regiao: 'Sudeste', regiaoImediata: 'São Paulo', temDados: true, lat: -23.55, lon: -46.63 };

  it('keeps codes as strings with the right number of digits', () => {
    expect(municipioSchema.parse(valid).codigo).toBe('3550308');
    expect(() => municipioSchema.parse({ ...valid, codigo: 3550308 })).toThrow();
    expect(() => municipioSchema.parse({ ...valid, codigo: '355030' })).toThrow();
    expect(() => municipioSchema.parse({ ...valid, ufCodigo: '3' })).toThrow();
  });
});

describe('municipioSchema coordinates', () => {
  const base = { codigo: '3550308', nome: 'São Paulo', slug: 'sao-paulo-sp', uf: 'SP', ufCodigo: '35', regiao: 'Sudeste', regiaoImediata: 'São Paulo', temDados: true };

  it('keeps [lat, lon] inside Brazil, or null when the mesh has no geometry', () => {
    expect(municipioSchema.parse({ ...base, lat: -23.55, lon: -46.63 }).lat).toBe(-23.55);
    expect(municipioSchema.parse({ ...base, lat: null, lon: null }).lon).toBeNull();
  });

  it('rejects swapped coordinates (longitude where latitude goes)', () => {
    expect(() => municipioSchema.parse({ ...base, lat: -46.63, lon: -23.55 })).toThrow();
  });
});

describe('ufProcessadaSchema state figures', () => {
  it('carries population, area and density from the state-level table', () => {
    const parsed = ufProcessadaSchema.parse({ codigo: '35', sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste', populacao: 44411238, area: 248219.485, densidade: 178.92 });
    expect(parsed.populacao).toBe(44411238);
  });

  it('requires them: a state with no figures should fail the pipeline, not render as 0', () => {
    expect(() => ufProcessadaSchema.parse({ codigo: '35', sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' })).toThrow();
  });
});

describe('malhaSchema', () => {
  const topo = {
    type: 'Topology',
    objects: { UF12MU: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: { codarea: '1200013' }, arcs: [[0]] }] } },
    arcs: [[[0, 0], [0, 1]]],
    transform: { scale: [0.1, 0.1], translate: [-70, -10] },
  };

  it('accepts an IBGE mesh topology', () => {
    expect(malhaSchema.parse(topo).type).toBe('Topology');
  });

  it('rejects a geometry with no codarea', () => {
    const broken = { ...topo, objects: { X: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: {}, arcs: [[0]] }] } } };
    expect(() => malhaSchema.parse(broken)).toThrow();
  });

  it('rejects an error payload that is not a topology', () => {
    expect(() => malhaSchema.parse({ statusCode: 500 })).toThrow();
  });
});
