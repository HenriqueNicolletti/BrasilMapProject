import { describe, expect, it } from 'vitest';
import { findDuplicateSlugs, municipioSlug } from './slug.ts';

describe('municipioSlug', () => {
  it('joins name and state without accents', () => {
    expect(municipioSlug('São Paulo', 'SP')).toBe('sao-paulo-sp');
  });

  it('keeps the same name apart by state', () => {
    expect(municipioSlug('Bom Jesus', 'PI')).toBe('bom-jesus-pi');
    expect(municipioSlug('Bom Jesus', 'RS')).toBe('bom-jesus-rs');
  });

  it("turns apostrophes into a single hyphen (D'Oeste)", () => {
    expect(municipioSlug("Machadinho D'Oeste", 'RO')).toBe('machadinho-d-oeste-ro');
    expect(municipioSlug('Santa Bárbara d’Oeste', 'SP')).toBe('santa-barbara-d-oeste-sp');
  });

  it('handles cedilla, tilde and existing hyphens', () => {
    expect(municipioSlug('Conceição do Araguaia', 'PA')).toBe('conceicao-do-araguaia-pa');
    expect(municipioSlug('Embu-Guaçu', 'SP')).toBe('embu-guacu-sp');
  });

  it('lowercases the state and collapses repeated separators', () => {
    expect(municipioSlug('  Foz  do  Iguaçu ', 'PR')).toBe('foz-do-iguacu-pr');
  });
});

describe('findDuplicateSlugs', () => {
  it('returns nothing when every slug is unique', () => {
    expect(findDuplicateSlugs(['a-sp', 'b-sp', 'a-rj'])).toEqual([]);
  });

  it('returns each repeated slug once', () => {
    expect(findDuplicateSlugs(['a-sp', 'b-sp', 'a-sp', 'a-sp', 'b-sp'])).toEqual(['a-sp', 'b-sp']);
  });
});
