import { describe, expect, it } from 'vitest';
import { INDICATORS, deriveIndicators, type RawKey, type RawTables } from './indicators.ts';

const CODE = '3550308';

function tablesFor(values: Partial<Record<RawKey, number | null>>): RawTables {
  const keys: RawKey[] = [
    'pop', 'area', 'dens', 'idadeMediana', 'envelhecimento', 'popTotal', 'popUrbana', 'pib',
    'vaTotal', 'vaAgro', 'vaInd', 'vaServ', 'vaAdm', 'rendaPc', 'domEsgotoTotal', 'domEsgotoRede',
    'domLixoTotal', 'domLixoColetado',
  ];
  const tables = {} as Record<RawKey, Map<string, number | null>>;
  for (const key of keys) {
    tables[key] = new Map(key in values ? [[CODE, values[key] ?? null]] : []);
  }
  return tables;
}

function column(result: number[], id: string): number {
  const index = INDICATORS.findIndex((indicator) => indicator.id === id);
  expect(index, `indicator ${id} is defined`).toBeGreaterThanOrEqual(0);
  return result[index] as number;
}

const FULL = {
  pop: 1000, area: 50, dens: 20, idadeMediana: 33, envelhecimento: 60,
  popTotal: 1000, popUrbana: 800,
  pib: 5000, // mil reais
  vaTotal: 4000, vaAgro: 400, vaInd: 1000, vaServ: 1600, vaAdm: 1000,
  rendaPc: 1182.47,
  domEsgotoTotal: 300, domEsgotoRede: 150, domLixoTotal: 300, domLixoColetado: 270,
} as const;

describe('INDICATORS', () => {
  it('defines the 14 indicators of the twin profile in 4 axes', () => {
    expect(INDICATORS).toHaveLength(14);
    expect(new Set(INDICATORS.map((i) => i.eixo))).toEqual(
      new Set(['demografia', 'territorio', 'economia', 'infraestrutura']),
    );
    expect(new Set(INDICATORS.map((i) => i.id)).size).toBe(14);
  });

  it('compares household income per capita on a log scale, in the economy axis', () => {
    const renda = INDICATORS.find((i) => i.id === 'renda_pc');
    expect(renda).toMatchObject({ eixo: 'economia', transform: 'log', unidade: 'R$', ano: '2022' });
  });
});

describe('deriveIndicators', () => {
  it('returns one value per indicator, in the order of INDICATORS', () => {
    expect(deriveIndicators(tablesFor(FULL), CODE)).toHaveLength(INDICATORS.length);
  });

  it('passes direct measures through', () => {
    const result = deriveIndicators(tablesFor(FULL), CODE);
    expect(column(result, 'pop')).toBe(1000);
    expect(column(result, 'dens')).toBe(20);
    expect(column(result, 'idade_mediana')).toBe(33);
    expect(column(result, 'area')).toBe(50);
    expect(column(result, 'renda_pc')).toBe(1182.47);
  });

  it('leaves household income as "sem dado" when IBGE has no value', () => {
    expect(column(deriveIndicators(tablesFor({ ...FULL, rendaPc: null }), CODE), 'renda_pc')).toBeNaN();
  });

  it('derives the urban share as a fraction of the total population', () => {
    expect(column(deriveIndicators(tablesFor(FULL), CODE), 'urbana_pct')).toBeCloseTo(0.8);
  });

  it('derives GDP per capita in reais from GDP in thousands of reais', () => {
    expect(column(deriveIndicators(tablesFor(FULL), CODE), 'pib_pc')).toBe(5000);
  });

  it('derives sector shares of value added', () => {
    const result = deriveIndicators(tablesFor(FULL), CODE);
    expect(column(result, 'va_agro_pct')).toBeCloseTo(0.1);
    expect(column(result, 'va_serv_pct')).toBeCloseTo(0.4);
  });

  it('keeps a real zero numerator as 0, not as missing', () => {
    const result = deriveIndicators(tablesFor({ ...FULL, domEsgotoRede: 0 }), CODE);
    expect(column(result, 'esgoto_pct')).toBe(0);
  });

  it('turns a share into NaN when its denominator is zero', () => {
    const result = deriveIndicators(tablesFor({ ...FULL, domEsgotoTotal: 0, domEsgotoRede: 0 }), CODE);
    expect(column(result, 'esgoto_pct')).toBeNaN();
  });

  it('turns sector shares into NaN when total value added is not positive', () => {
    const result = deriveIndicators(tablesFor({ ...FULL, vaTotal: -227726 }), CODE);
    expect(column(result, 'va_agro_pct')).toBeNaN();
    expect(column(result, 'va_ind_pct')).toBeNaN();
  });

  it('keeps a negative sector value as is when the total is positive', () => {
    const result = deriveIndicators(tablesFor({ ...FULL, vaInd: -100 }), CODE);
    expect(column(result, 'va_ind_pct')).toBeCloseTo(-0.025);
  });

  it('is NaN everywhere for a municipality with no data at all', () => {
    const result = deriveIndicators(tablesFor({}), CODE);
    expect(result.every((value) => Number.isNaN(value))).toBe(true);
  });

  it('is NaN for GDP per capita when population is zero or missing', () => {
    expect(column(deriveIndicators(tablesFor({ ...FULL, pop: 0 }), CODE), 'pib_pc')).toBeNaN();
    expect(column(deriveIndicators(tablesFor({ ...FULL, pop: null }), CODE), 'pib_pc')).toBeNaN();
  });
});
