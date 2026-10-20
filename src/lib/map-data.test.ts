import { describe, expect, it } from 'vitest';
import { indicatorValues, itemHref, type MapIndicator, type MapItemRef } from './map-data.ts';
import { decodeMatrix, encodeMatrix } from './matrix.ts';

const base = { id: 'pop', rotulo: 'População', unidade: 'pessoas', ano: '2022', fonte: 'IBGE' };
const itens: MapItemRef[] = [
  { codigo: 'a', nome: 'A', row: 0 },
  { codigo: 'b', nome: 'B', row: 1 },
];

describe('indicatorValues', () => {
  it('reads inline values in item order', () => {
    const indicator: MapIndicator = { ...base, valores: [10, null] };
    expect(indicatorValues(indicator, itens, null)).toEqual([10, null]);
  });

  it('reads a matrix column through each item row, keeping NaN as null', () => {
    const matrix = decodeMatrix(encodeMatrix([[1, 2], [3, Number.NaN]]), 2, 2);
    expect(indicatorValues({ ...base, coluna: 1 }, itens, matrix)).toEqual([2, null]);
  });

  it('gives null to an item that has no matrix row', () => {
    const matrix = decodeMatrix(encodeMatrix([[1]]), 1, 1);
    expect(indicatorValues({ ...base, coluna: 0 }, [{ codigo: 'a', nome: 'A' }], matrix)).toEqual([null]);
  });

  it('fails when a matrix column is needed but the matrix is not loaded', () => {
    expect(() => indicatorValues({ ...base, coluna: 0 }, itens, null)).toThrow(/matrix/);
  });

  it('fails when an indicator has neither inline values nor a column', () => {
    expect(() => indicatorValues(base, itens, null)).toThrow(/pop/);
  });
});

describe('itemHref', () => {
  const item = { codigo: '3550308', nome: 'São Paulo', slug: 'sao-paulo-sp' };
  it('prefers an explicit destination for the item', () => {
    expect(itemHref({ hrefs: { '3550308': '/uf/sp/' }, hrefBase: '/municipio/' }, item)).toBe('/uf/sp/');
  });

  it('builds the destination from the base and the slug', () => {
    expect(itemHref({ hrefBase: '/municipio/' }, item)).toBe('/municipio/sao-paulo-sp/');
  });

  it('has no destination when the item has no page', () => {
    expect(itemHref({}, item)).toBeUndefined();
    expect(itemHref({ hrefBase: '/municipio/' }, { codigo: '1', nome: 'X' })).toBeUndefined();
  });
});
