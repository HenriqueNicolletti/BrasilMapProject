import { describe, expect, it } from 'vitest';
import { classifyItems } from './choropleth.ts';
import { NO_DATA } from './format.ts';

const input = (codigo: string, value: number | null) => ({ codigo, nome: `Lugar ${codigo}`, value });
const many = Array.from({ length: 20 }, (_, i) => input(String(i), (i + 1) * 10));

describe('classifyItems', () => {
  it('gives higher values a higher class, never above 6 (7 classes)', () => {
    const { items } = classifyItems(many, 'pessoas');
    const classes = items.map((item) => item.cls as number);
    expect(classes).toEqual([...classes].sort((a, b) => a - b));
    expect(Math.max(...classes)).toBe(6);
    expect(Math.min(...classes)).toBe(0);
  });

  it('keeps a missing value out of the scale: no class, text "sem dado"', () => {
    const { items, hasNoData } = classifyItems([...many, input('x', null)], 'pessoas');
    const missing = items.find((item) => item.codigo === 'x');
    expect(missing?.cls).toBeNull();
    expect(missing?.valueText).toBe(NO_DATA);
    expect(hasNoData).toBe(true);
  });

  it('reports no missing data when every item has a value', () => {
    expect(classifyItems(many, 'pessoas').hasNoData).toBe(false);
  });

  it('formats values for the unit', () => {
    const { items } = classifyItems([input('a', 0.253), input('b', 0.5)], 'fração');
    expect(items.map((item) => item.valueText)).toEqual(['25,3%', '50,0%']);
  });

  it('builds one legend entry per class in use, covering the data range', () => {
    const { legend } = classifyItems([input('a', 0.1), input('b', 0.2), input('c', 0.3), input('d', 0.4)], 'fração');
    expect(legend.length).toBeGreaterThan(1);
    expect(legend[0]?.label.startsWith('10,0%')).toBe(true);
    expect(legend.at(-1)?.label.endsWith('40,0%')).toBe(true);
  });

  it('has an empty legend and no classes when nothing has a value', () => {
    const { items, legend } = classifyItems([input('a', null), input('b', Number.NaN)], 'pessoas');
    expect(legend).toEqual([]);
    expect(items.every((item) => item.cls === null)).toBe(true);
  });

  it('uses fewer classes, not empty ones, when values tie heavily', () => {
    const tied = [0, 0, 0, 0, 0, 0, 0, 0, 5, 9].map((value, i) => input(String(i), value));
    const { items, legend } = classifyItems(tied, 'hab/km²');
    const used = new Set(items.map((item) => item.cls));
    expect(legend).toHaveLength(used.size);
  });

  it('spreads fewer classes across the whole colour ramp, so two classes are light and dark, not the two lightest', () => {
    const { items } = classifyItems([input('a', 1), input('b', 2), input('c', 100), input('d', 200)], 'pessoas', { classes: 2 });
    const steps = new Set(items.map((item) => item.step));
    expect(steps).toEqual(new Set([0, 6]));
  });
});
