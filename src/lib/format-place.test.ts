import { describe, expect, it } from 'vitest';
import { NO_DATA } from './format.ts';
import { capitalizeName, formatCoordinates, formatRank } from './format-place.ts';

describe('capitalizeName', () => {
  it('turns the Census upper case into a name', () => {
    expect(capitalizeName('MARIA')).toBe('Maria');
  });

  it('capitalizes each word and each part of a hyphenated name', () => {
    expect(capitalizeName('MARIA DAS GRACAS')).toBe('Maria Das Gracas');
    expect(capitalizeName('ANA-MARIA')).toBe('Ana-Maria');
  });

  it('does not invent accents: the Census names have none', () => {
    expect(capitalizeName('JOSE')).toBe('Jose');
  });
});

describe('formatCoordinates', () => {
  it('writes latitude and longitude with the hemisphere, in pt-BR', () => {
    expect(formatCoordinates(-23.6497, -46.6478)).toBe('23,65° S, 46,65° O');
  });

  it('uses N and L for the northern and eastern hemispheres', () => {
    expect(formatCoordinates(2.82, 60.67)).toBe('2,82° N, 60,67° L');
  });

  it('reads missing coordinates as "sem dado"', () => {
    expect(formatCoordinates(null, null)).toBe(NO_DATA);
    expect(formatCoordinates(-10, null)).toBe(NO_DATA);
  });
});

describe('formatRank', () => {
  it('writes the position out of the total with the ordinal mark', () => {
    expect(formatRank({ posicao: 12, total: 5570 })).toBe('12º de 5.570');
  });

  it('reads a missing rank as "sem dado"', () => {
    expect(formatRank(null)).toBe(NO_DATA);
  });
});
