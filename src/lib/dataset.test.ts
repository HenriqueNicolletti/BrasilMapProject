import { describe, expect, it } from 'vitest';
import { buildDataset } from './dataset.ts';
import { INDICATORS, type RawKey, type RawTables } from './indicators.ts';
import type { LocalidadeMunicipio } from './schemas.ts';

const UF = (sigla: string, id: number) => ({ id, sigla, nome: `Estado ${sigla}`, regiao: { id: 1, sigla: 'N', nome: 'Norte' } });
const local = (id: number, nome: string, sigla: string, ufId: number): LocalidadeMunicipio => ({
  id,
  nome,
  'regiao-imediata': { id: 1, nome: `Imediata ${nome}`, 'regiao-intermediaria': { id: 2, nome: 'Inter', UF: UF(sigla, ufId) } },
});

const RAW_KEYS: RawKey[] = [
  'pop', 'area', 'dens', 'idadeMediana', 'envelhecimento', 'popTotal', 'popUrbana', 'pib',
  'vaTotal', 'vaAgro', 'vaInd', 'vaServ', 'vaAdm', 'rendaPc', 'domEsgotoTotal', 'domEsgotoRede', 'domLixoTotal', 'domLixoColetado',
];

function rawFor(codes: string[]): RawTables {
  const tables = {} as Record<RawKey, Map<string, number | null>>;
  for (const key of RAW_KEYS) {
    tables[key] = new Map(codes.map((code) => [code, key === 'popUrbana' ? 5 : 10]));
  }
  return tables;
}

describe('buildDataset', () => {
  it('sorts municipalities by code and builds one matrix row each, in that order', () => {
    const result = buildDataset([local(2200002, 'Beta', 'PI', 22), local(1100015, 'Alfa', 'RO', 11)], rawFor(['1100015', '2200002']));
    expect(result.municipios.map((m) => m.codigo)).toEqual(['1100015', '2200002']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toHaveLength(INDICATORS.length);
  });

  it('derives code strings, state and slug from the locality', () => {
    const [m] = buildDataset([local(2200002, 'São Beta', 'PI', 22)], rawFor(['2200002'])).municipios;
    expect(m).toMatchObject({ codigo: '2200002', uf: 'PI', ufCodigo: '22', slug: 'sao-beta-pi', regiao: 'Norte', regiaoImediata: 'Imediata São Beta' });
  });

  it('flags a municipality with no data at all and gives it an all-NaN row', () => {
    const result = buildDataset([local(1100015, 'Alfa', 'RO', 11), local(5101837, 'Nova', 'MT', 51)], rawFor(['1100015']));
    const nova = result.municipios.find((m) => m.codigo === '5101837');
    expect(nova?.temDados).toBe(false);
    expect(result.rows[1]?.every((value) => Number.isNaN(value))).toBe(true);
    expect(result.municipios.find((m) => m.codigo === '1100015')?.temDados).toBe(true);
  });

  it('counts how many municipalities have a value for each indicator', () => {
    const result = buildDataset([local(1100015, 'Alfa', 'RO', 11), local(5101837, 'Nova', 'MT', 51)], rawFor(['1100015']));
    expect(result.cobertura.pop).toBe(1);
  });

  it('fails when two municipalities end up with the same slug', () => {
    expect(() => buildDataset([local(1100015, 'Alfa', 'RO', 11), local(1100016, 'Alfa', 'RO', 11)], rawFor([]))).toThrow(/alfa-ro/);
  });

  it('fails when the raw tables mention a municipality that is not in the locality list', () => {
    expect(() => buildDataset([local(1100015, 'Alfa', 'RO', 11)], rawFor(['1100015', '9999999']))).toThrow(/9999999/);
  });
});
