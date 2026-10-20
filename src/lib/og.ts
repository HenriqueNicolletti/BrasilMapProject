import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

// Share cards (1200×630). Satori has no CSS cascade, so the day-chart inks of tokens.css are repeated
// here; og.test.ts fails if they drift apart.
export const OG_INKS = {
  sea: '#e8f1f4',
  land: '#f0de9a',
  shoal: '#bfdde8',
  text: '#14171c',
  note: '#3a4a66',
  deep: '#1b3f7a',
  accent: '#c4155a',
} as const;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgShape {
  viewBox: string;
  /** Drawn first, filled: the state or the country. */
  outline?: string | undefined;
  /** Thin lines on top of the outline (the municipalities of a state). */
  lines?: string[];
  /** Drawn in the accent ink (the municipality the card is about). */
  highlight?: string | undefined;
  /** Filled paths with their own colour (the states of the country). */
  fills?: { d: string; fill: string }[];
}

export interface OgCard {
  title: string;
  subtitle: string;
  figures: { label: string; value: string }[];
  shape?: OgShape | undefined;
}

type Node = { type: string; props: Record<string, unknown> };

function el(type: string, props: Record<string, unknown>, children?: unknown): Node {
  return { type, props: children === undefined ? props : { ...props, children } };
}

/** Long names get a smaller size so they stay on two lines at most. */
export function titleSize(title: string): number {
  if (title.length <= 14) return 110;
  if (title.length <= 22) return 88;
  if (title.length <= 32) return 70;
  return 56;
}

const MARGIN = 64;
const SERIF = 'Source Serif 4';
const LABEL = 'Barlow Semi Condensed';
/** The sheet's sign-off, set at the foot like a chart's title block: brand and source, never a label above the title. */
export const OG_SIGNATURE = 'Brasil em Mapas · Fonte: IBGE';
const FRAME = { position: 'absolute', top: 24, left: 24, right: 24, bottom: 24, border: `2px solid ${OG_INKS.deep}`, display: 'flex' };

function shapeNode(shape: OgShape): Node {
  const [, , w, h] = shape.viewBox.split(' ').map(Number);
  const box = 440;
  const scale = Math.min(box / (w ?? 1), box / (h ?? 1));
  const children: Node[] = [];
  if (shape.outline) children.push(el('path', { d: shape.outline, fill: OG_INKS.land, stroke: OG_INKS.deep, 'stroke-width': 2 }));
  for (const fill of shape.fills ?? []) children.push(el('path', { d: fill.d, fill: fill.fill, stroke: OG_INKS.sea, 'stroke-width': 1 }));
  for (const d of shape.lines ?? []) children.push(el('path', { d, fill: 'none', stroke: OG_INKS.deep, 'stroke-width': 0.6, 'stroke-opacity': 0.55 }));
  if (shape.highlight) children.push(el('path', { d: shape.highlight, fill: OG_INKS.accent, stroke: OG_INKS.accent, 'stroke-width': 3 }));
  return el(
    'svg',
    { width: Math.round((w ?? 1) * scale), height: Math.round((h ?? 1) * scale), viewBox: shape.viewBox, xmlns: 'http://www.w3.org/2000/svg' },
    children,
  );
}

/** The element tree Satori turns into an image. Pure, so it can be tested without rendering. */
export function ogTree(card: OgCard): Node {
  const text = el(
    'div',
    { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 24 } },
    [
      el('div', { style: { display: 'flex', flexDirection: 'column' } }, [
        el(
          'div',
          { style: { display: 'flex', fontFamily: SERIF, fontSize: titleSize(card.title), fontWeight: 600, lineHeight: 1.02, letterSpacing: -1, color: OG_INKS.text } },
          card.title,
        ),
        el('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 34, color: OG_INKS.note, marginTop: 14 } }, card.subtitle),
      ]),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: 28 } }, [
        el(
          'div',
          { style: { display: 'flex', gap: 40 } },
          card.figures.map((figure) =>
            el('div', { style: { display: 'flex', flexDirection: 'column' } }, [
              el('div', { style: { display: 'flex', fontSize: 26, color: OG_INKS.note } }, figure.label),
              // Figures are soundings: italic serif numerals, as on the site.
              el('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 44, fontWeight: 600, fontStyle: 'italic', color: OG_INKS.deep } }, figure.value),
            ]),
          ),
        ),
        el('div', { style: { display: 'flex', fontSize: 24, fontWeight: 600, letterSpacing: 1, color: OG_INKS.note } }, OG_SIGNATURE),
      ]),
    ],
  );
  const children: Node[] = [text];
  if (card.shape) {
    children.push(el('div', { style: { display: 'flex', width: 460, alignItems: 'center', justifyContent: 'center' } }, shapeNode(card.shape)));
  }
  return el(
    'div',
    {
      style: {
        display: 'flex',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: OG_INKS.sea,
        fontFamily: LABEL,
        position: 'relative',
      },
    },
    [
      el('div', { style: FRAME }),
      // Satori sizes boxes without padding, so the margin is a fixed-size inner box.
      el('div', { style: { display: 'flex', width: OG_WIDTH - 2 * MARGIN, height: OG_HEIGHT - 2 * MARGIN, margin: MARGIN } }, children),
    ],
  );
}

// Satori reads WOFF but not WOFF2, so the static WOFF files of the site's two faces are used here.
const fontFile = (family: 'barlow-semi-condensed' | 'source-serif-4', weight: 400 | 600, style: 'normal' | 'italic' = 'normal') =>
  readFileSync(join(process.cwd(), 'node_modules', '@fontsource', family, 'files', `${family}-latin-${String(weight)}-${style}.woff`));

let fonts: { name: string; data: Buffer; weight: 400 | 600; style: 'normal' | 'italic' }[] | undefined;

/** PNG bytes of a share card. */
export async function renderOg(card: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  fonts ??= [
    { name: LABEL, data: fontFile('barlow-semi-condensed', 400), weight: 400, style: 'normal' },
    { name: LABEL, data: fontFile('barlow-semi-condensed', 600), weight: 600, style: 'normal' },
    { name: SERIF, data: fontFile('source-serif-4', 400), weight: 400, style: 'normal' },
    { name: SERIF, data: fontFile('source-serif-4', 600), weight: 600, style: 'normal' },
    { name: SERIF, data: fontFile('source-serif-4', 600, 'italic'), weight: 600, style: 'italic' },
  ];
  const svg = await satori(ogTree(card), { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng());
}
