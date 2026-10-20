import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_INKS, OG_SIGNATURE, OG_WIDTH, ogTree, renderOg, titleSize } from './og.ts';

const tokens = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
const dayInks = tokens.slice(0, tokens.indexOf('/* Semantic colour */'));

describe('OG inks', () => {
  it('are the day-chart inks of tokens.css', () => {
    const wanted = { sea: 'sea', land: 'land', shoal: 'shoal', text: 'black', note: 'note', deep: 'deep', accent: 'magenta' } as const;
    for (const [key, token] of Object.entries(wanted)) {
      expect(dayInks).toContain(`--ink-${token}: ${OG_INKS[key as keyof typeof OG_INKS]};`);
    }
  });
});

describe('titleSize', () => {
  it('shrinks for longer names', () => {
    expect(titleSize('Sorriso')).toBeGreaterThan(titleSize('Santo Antônio do Leverger'));
    expect(titleSize('Santo Antônio do Leverger')).toBeGreaterThan(titleSize('Vila Bela da Santíssima Trindade (MT) e mais'));
  });
});

describe('ogTree', () => {
  const card = { title: 'Sorriso', subtitle: 'Mato Grosso', figures: [{ label: 'População', value: '110.635' }] };

  it('carries the text and figures, and has no map column without a shape', () => {
    const json = JSON.stringify(ogTree(card));
    expect(json).toContain(OG_SIGNATURE);
    expect(json).not.toContain('uppercase'); // no label above the title
    expect(json).toContain('Sorriso');
    expect(json).toContain('110.635');
    expect(json).not.toContain('"svg"');
  });

  it('adds the map when there is a shape', () => {
    const json = JSON.stringify(ogTree({ ...card, shape: { viewBox: '0 0 100 80', outline: 'M0 0L10 10Z', highlight: 'M1 1L2 2Z' } }));
    expect(json).toContain('"svg"');
    expect(json).toContain('M1 1L2 2Z');
  });
});

describe('renderOg', () => {
  it('produces a PNG of the share-card size, with accents', async () => {
    const png = await renderOg({
      title: 'São João do Piauí',
      subtitle: 'Piauí',
      figures: [{ label: 'Área', value: '1.527,3 km²' }],
      shape: { viewBox: '0 0 100 80', outline: 'M5 5L90 10L60 70Z', highlight: 'M40 30L50 30L45 40Z' },
    });
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(OG_WIDTH);
    expect(view.getUint32(20)).toBe(OG_HEIGHT);
  });
});
