import { describe, expect, it } from 'vitest';
import { normalizeForSearch, rankByName } from './search-rank.ts';

describe('normalizeForSearch', () => {
  it('ignores case, accents, apostrophes and repeated spaces', () => {
    expect(normalizeForSearch("  São  Paulo d'Oeste ")).toBe('sao paulo d oeste');
  });
});

describe('rankByName', () => {
  const names = ['Campina Grande', 'Campinas', 'Campina Verde', 'Santa Campinas'];
  const items = names.map((nome) => ({ nome }));

  it('puts an exact name first, whatever order the search engine returned', () => {
    expect(rankByName(items, 'campinas').map((i) => i.nome)[0]).toBe('Campinas');
  });

  it('puts names that start with the query before the others', () => {
    const ranked = rankByName(items, 'campina').map((i) => i.nome);
    expect(ranked.indexOf('Santa Campinas')).toBe(ranked.length - 1);
  });

  it('keeps the engine order inside the same group', () => {
    const ranked = rankByName(items, 'campina').map((i) => i.nome);
    expect(ranked.slice(0, 3)).toEqual(['Campina Grande', 'Campinas', 'Campina Verde']);
  });

  it('matches without accents', () => {
    const ranked = rankByName([{ nome: 'Sao Paulo do Potengi' }, { nome: 'São Paulo' }], 'sao paulo');
    expect(ranked[0]?.nome).toBe('São Paulo');
  });
});
