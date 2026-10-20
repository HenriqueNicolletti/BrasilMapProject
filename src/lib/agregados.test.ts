import { describe, expect, it } from 'vitest';
import { extractSeries } from './agregados.ts';
import type { AgregadoResponse } from './schemas.ts';

const NIVEL = { id: 'N6', nome: 'Município' };
const serie = (id: string, value: string, ano = '2022') => ({
  localidade: { id, nivel: NIVEL, nome: `M${id}` },
  serie: { [ano]: value },
});
const cat = (cls: string, id: string, name: string) => [{ id: cls, nome: 'C', categoria: { [id]: name } }];

const response: AgregadoResponse = [
  {
    id: '93',
    variavel: 'População residente',
    unidade: 'Pessoas',
    resultados: [
      { classificacoes: cat('1', '6795', 'Total'), series: [serie('1111111', '100'), serie('2222222', '50')] },
      { classificacoes: cat('1', '1', 'Urbana'), series: [serie('1111111', '80'), serie('2222222', '-')] },
    ],
  },
  {
    id: '614',
    variavel: 'Densidade',
    unidade: 'hab/km²',
    resultados: [{ classificacoes: [], series: [serie('1111111', '12.5'), serie('2222222', 'X')] }],
  },
];

describe('extractSeries', () => {
  it('reads a variable with no classification', () => {
    const map = extractSeries(response, { variavel: '614', ano: '2022', kind: 'measure' });
    expect(map.get('1111111')).toBe(12.5);
    expect(map.get('2222222')).toBeNull();
  });

  it('picks the result of one category', () => {
    const urbana = extractSeries(response, { variavel: '93', categoria: '1', ano: '2022', kind: 'count' });
    expect(urbana.get('1111111')).toBe(80);
    const total = extractSeries(response, { variavel: '93', categoria: '6795', ano: '2022', kind: 'count' });
    expect(total.get('1111111')).toBe(100);
  });

  it('reads a lone "-" as a true zero in a count', () => {
    const urbana = extractSeries(response, { variavel: '93', categoria: '1', ano: '2022', kind: 'count' });
    expect(urbana.get('2222222')).toBe(0);
  });

  it('fails when the variable is not in the response', () => {
    expect(() => extractSeries(response, { variavel: '999', ano: '2022', kind: 'count' })).toThrow(/999/);
  });

  it('fails when the category is not in the response', () => {
    expect(() => extractSeries(response, { variavel: '93', categoria: '777', ano: '2022', kind: 'count' })).toThrow(/777/);
  });

  it('fails when the year is not in a series', () => {
    expect(() => extractSeries(response, { variavel: '614', ano: '2010', kind: 'measure' })).toThrow(/2010/);
  });

  it('fails on a municipality that appears twice', () => {
    const duplicated: AgregadoResponse = [
      { id: '1', variavel: 'v', unidade: 'u', resultados: [{ classificacoes: [], series: [serie('1111111', '1'), serie('1111111', '2')] }] },
    ];
    expect(() => extractSeries(duplicated, { variavel: '1', ano: '2022', kind: 'count' })).toThrow(/1111111/);
  });
});
