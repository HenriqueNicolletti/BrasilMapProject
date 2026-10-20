import { geoConicEqualArea, geoPath, type GeoContext } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';
import { classifyItems, type ChoroplethModel } from '../lib/choropleth.ts';
import { formatIndicatorValue } from '../lib/format.ts';
import { formatRank } from '../lib/format-place.ts';
import { topologyFeatures } from '../lib/geo.ts';
import { INDICATORS } from '../lib/indicators.ts';
import { makeRanker } from '../lib/rank.ts';
import { escapeHtml, legendHtml } from '../lib/render.ts';
import { centerOn, clampView, IDENTITY, idToRgb, panBy, rgbToId, zoomAt, type View } from '../lib/viewport.ts';
import { createPicker, loadAtlas, must } from './atlas-client.ts';
import { reveal } from './motion.ts';

// The whole country, drawn on a canvas. 5.570 shapes are far too many SVG nodes for a phone; a canvas
// draws them as eight fills (one per colour class) and a hidden second canvas answers "which one is
// under the pointer" by colour.

const WORLD = 1000; // the map is laid out in a 1000 × 1000 box; the canvas scales it to its CSS size
const SLUGS = ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to'];
const NO_DATA_STEP = 7;
const BORDER_ZOOM = 3.5; // below this the municipal borders are finer than a pixel and are left out
const SIZE = { width: WORLD, height: WORLD };

/** The canvas cannot read CSS variables, so the inks are copied from tokens.css at draw time. */
interface Inks {
  /** The seven steps of the colour scale, --scale-seq-1 to 7. */
  steps: string[];
  noData: string;
  hatch: string;
  outline: string;
  accent: string;
  sea: string;
}

/** Fails loudly instead of drawing with a colour outside the ink set when a token is missing. */
function readInks(): Inks {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => {
    const value = style.getPropertyValue(name).trim();
    if (value === '') throw new Error(`Token ${name} is not defined`);
    return value;
  };
  return {
    steps: Array.from({ length: NO_DATA_STEP }, (_, i) => token(`--scale-seq-${String(i + 1)}`)),
    noData: token('--scale-no-data'),
    hatch: token('--scale-no-data-hatch'),
    outline: token('--color-line-strong'),
    accent: token('--color-accent'),
    sea: token('--color-sea'),
  };
}

interface Shape {
  row: number;
  path: Path2D;
}

async function fetchTopology(name: string): Promise<Topology> {
  const response = await fetch(`/dados/malhas/${name}.json`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return (await response.json()) as Topology;
}

/** d3-geo draws into anything with these four calls; a Path2D has them minus `beginPath`. */
function pathContext(target: Path2D): GeoContext {
  return {
    beginPath() {},
    moveTo: (x, y) => { target.moveTo(x, y); },
    lineTo: (x, y) => { target.lineTo(x, y); },
    arc: (x, y, r, a0, a1) => { target.arc(x, y, r, a0, a1); },
    closePath: () => { target.closePath(); },
  };
}

async function start(): Promise<void> {
  const status = must(document, '[data-brasil-status]', HTMLElement);
  const stage = must(document, '[data-brasil-stage]', HTMLElement);
  const canvas = must(stage, '[data-brasil-canvas]', HTMLCanvasElement);
  const select = must(stage, '[data-brasil-indicator]', HTMLSelectElement);
  const hover = must(stage, '[data-brasil-hover]', HTMLElement);
  const selectedBox = must(stage, '[data-brasil-selected]', HTMLElement);
  // The legend exists twice (beside the map on a wide screen, under it on a narrow one); both are kept in step.
  const legends = [...document.querySelectorAll<HTMLElement>('[data-brasil-legend]')];
  const legendTitles = [...document.querySelectorAll<HTMLElement>('[data-brasil-legend-title]')];
  const source = must(document, '[data-brasil-source]', HTMLElement);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  const ctx = context;

  status.textContent = 'Carregando as fronteiras e os dados…';
  const [atlas, outlineTopology, ...stateTopologies] = await Promise.all([
    loadAtlas(),
    fetchTopology('uf'),
    ...SLUGS.map((slug) => fetchTopology(slug)),
  ]);
  if (!atlas) throw new Error('No data');
  const { places, raw } = atlas;
  const rowByCode = new Map(places.codigo.map((code, row) => [code, row]));

  // One projection for everything, fitted to the 27 state outlines.
  const outlines = topologyFeatures(outlineTopology);
  const projection = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]);
  const collection: FeatureCollection = { type: 'FeatureCollection', features: outlines.map((item) => item.feature) };
  projection.fitExtent([[12, 12], [WORLD - 12, WORLD - 12]], collection);

  const outlinePath = new Path2D();
  const outlineDrawer = geoPath(projection, pathContext(outlinePath));
  for (const item of outlines) outlineDrawer(item.feature);

  const shapes: Shape[] = [];
  const centroids = new Map<number, [number, number]>();
  const measure = geoPath(projection);
  for (const topology of stateTopologies) {
    for (const item of topologyFeatures(topology)) {
      const row = rowByCode.get(item.codigo);
      if (row === undefined) continue;
      const path = new Path2D();
      geoPath(projection, pathContext(path))(item.feature);
      shapes.push({ row, path });
      centroids.set(row, measure.centroid(item.feature));
    }
  }

  // ---- State of the picture ----
  let view: View = IDENTITY;
  let columnIndex = 0;
  let model: ChoroplethModel | null = null;
  let stepOfRow = new Int8Array(places.nome.length).fill(-1);
  let groups: Path2D[] = [];
  let selected: number | null = null;
  let inks = readInks();
  let hatch: CanvasPattern | null = null;
  let pickDirty = true;
  let frame = 0;

  const pick = document.createElement('canvas');
  const pickCtx = pick.getContext('2d', { willReadFrequently: true });
  if (!pickCtx) throw new Error('Canvas is not available');

  const readColors = (): void => {
    inks = readInks();
    const tile = document.createElement('canvas');
    tile.width = 8;
    tile.height = 8;
    const t = tile.getContext('2d');
    if (t) {
      t.fillStyle = inks.noData;
      t.fillRect(0, 0, 8, 8);
      t.strokeStyle = inks.hatch;
      t.lineWidth = 1;
      t.beginPath();
      t.moveTo(-1, 9);
      t.lineTo(9, -1);
      t.stroke();
      hatch = ctx.createPattern(tile, 'repeat');
    }
  };

  const classify = (): void => {
    const indicator = INDICATORS[columnIndex];
    if (!indicator) return;
    model = classifyItems(
      places.nome.map((nome, row) => ({ codigo: places.codigo[row] ?? '', nome, value: raw.get(row, columnIndex) })),
      indicator.unidade,
    );
    stepOfRow = new Int8Array(places.nome.length).fill(-1);
    groups = Array.from({ length: NO_DATA_STEP + 1 }, () => new Path2D());
    for (const shape of shapes) {
      const item = model.items[shape.row];
      const step = item?.step ?? NO_DATA_STEP;
      stepOfRow[shape.row] = step;
      groups[step]?.addPath(shape.path);
    }
    for (const legend of legends) legend.innerHTML = legendHtml(model.legend, model.hasNoData);
    for (const title of legendTitles) title.textContent = indicator.rotulo;
    source.textContent = `Fonte: IBGE, ${indicator.fonte}. Ano de referência: ${indicator.ano}.`;
    pickDirty = true;
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.width * dpr));
    pick.width = canvas.width;
    pick.height = canvas.height;
    pickDirty = true;
    schedule();
  };

  /** Device pixels per world unit at zoom 1. */
  const base = (): number => canvas.width / WORLD;

  const draw = (): void => {
    frame = 0;
    const scale = base() * view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, view.x * base(), view.y * base());
    groups.forEach((group, step) => {
      if (step === NO_DATA_STEP) {
        hatch?.setTransform(new DOMMatrix().scale(1 / scale));
        ctx.fillStyle = hatch ?? inks.noData;
      } else {
        ctx.fillStyle = inks.steps[step] ?? inks.noData;
      }
      ctx.fill(group);
    });
    if (view.k >= BORDER_ZOOM) {
      ctx.lineWidth = 0.6 / scale;
      ctx.strokeStyle = inks.sea;
      for (const group of groups) ctx.stroke(group);
    }
    ctx.lineWidth = 1.2 / scale;
    ctx.strokeStyle = inks.outline;
    ctx.stroke(outlinePath);
    if (selected !== null) {
      const shape = shapes.find((item) => item.row === selected);
      if (shape) {
        ctx.lineWidth = 2.4 / scale;
        ctx.strokeStyle = inks.accent;
        ctx.stroke(shape.path);
      }
    }
  };

  function schedule(): void {
    if (frame === 0) frame = requestAnimationFrame(draw);
  }

  const renderPick = (): void => {
    const scale = base() * view.k;
    pickCtx.setTransform(1, 0, 0, 1, 0, 0);
    pickCtx.clearRect(0, 0, pick.width, pick.height);
    pickCtx.setTransform(scale, 0, 0, scale, view.x * base(), view.y * base());
    for (const shape of shapes) {
      const [r, g, b] = idToRgb(shape.row);
      pickCtx.fillStyle = `rgb(${String(r)},${String(g)},${String(b)})`;
      pickCtx.fill(shape.path);
    }
    pickDirty = false;
  };

  const worldOf = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [((event.clientX - rect.left) * WORLD) / rect.width, ((event.clientY - rect.top) * WORLD) / rect.height];
  };

  const rowAt = (event: { clientX: number; clientY: number }): number | null => {
    if (pickDirty) renderPick();
    const [sx, sy] = worldOf(event);
    const px = Math.round(sx * base());
    const py = Math.round(sy * base());
    if (px < 0 || py < 0 || px >= pick.width || py >= pick.height) return null;
    const [r = 0, g = 0, b = 0] = pickCtx.getImageData(px, py, 1, 1).data;
    return rgbToId(r, g, b, places.nome.length);
  };

  const describe = (row: number): string => {
    const indicator = INDICATORS[columnIndex];
    if (!indicator) return '';
    const value = raw.get(row, columnIndex);
    return `${places.nome[row] ?? ''} (${places.uf[row] ?? ''}): ${indicator.rotulo.toLowerCase()} ${formatIndicatorValue(value, indicator.unidade)}`;
  };

  const select_ = (row: number | null): void => {
    selected = row;
    if (row === null) {
      selectedBox.replaceChildren();
    } else {
      const indicator = INDICATORS[columnIndex];
      const rank = makeRanker(Array.from({ length: raw.rows }, (_, r) => raw.get(r, columnIndex)))(raw.get(row, columnIndex));
      selectedBox.innerHTML = `<p><strong>${escapeHtml(describe(row))}</strong>${indicator ? ` · ${escapeHtml(formatRank(rank))}` : ''}</p><p><a href="/municipio/${escapeHtml(places.slug[row] ?? '')}/">Abrir a página de ${escapeHtml(places.nome[row] ?? '')}</a></p>`;
    }
    reveal(selectedBox.children);
    schedule();
  };

  const apply = (next: View): void => {
    view = clampView(next, SIZE);
    pickDirty = true;
    schedule();
  };

  // ---- Pointer: drag to pan, wheel or pinch to zoom, click to choose ----
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = 0;
  let pinch = 0;

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      if (event.pointerType === 'mouse') {
        const row = rowAt(event);
        hover.textContent = row === null ? '' : describe(row);
      }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const toWorld = WORLD / rect.width;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) {
        const [cx, cy] = worldOf({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        apply(zoomAt(view, distance / pinch, cx, cy, SIZE));
      }
      pinch = distance;
      dragged += 10;
    } else {
      const dx = (event.clientX - previous.x) * toWorld;
      const dy = (event.clientY - previous.y) * toWorld;
      dragged += Math.abs(dx) + Math.abs(dy);
      apply(panBy(view, dx, dy, SIZE));
    }
  });
  const release = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinch = 0;
  };
  canvas.addEventListener('pointerup', (event) => {
    const wasTap = dragged < 6 && pointers.size === 1;
    release(event);
    if (wasTap) select_(rowAt(event));
  });
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') hover.textContent = '';
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const [wx, wy] = worldOf(event);
      apply(zoomAt(view, Math.exp(-event.deltaY * 0.0015), wx, wy, SIZE));
    },
    { passive: false },
  );

  // ---- Keyboard and buttons ----
  const STEP = 60;
  canvas.addEventListener('keydown', (event) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [STEP, 0], ArrowRight: [-STEP, 0], ArrowUp: [0, STEP], ArrowDown: [0, -STEP] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      apply(panBy(view, move[0], move[1], SIZE));
    } else if (event.key === '+' || event.key === '=') {
      apply(zoomAt(view, 1.5, WORLD / 2, WORLD / 2, SIZE));
    } else if (event.key === '-') {
      apply(zoomAt(view, 1 / 1.5, WORLD / 2, WORLD / 2, SIZE));
    } else if (event.key === 'Enter' && selected !== null) {
      window.location.href = `/municipio/${places.slug[selected] ?? ''}/`;
    }
  });
  for (const button of stage.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
    button.addEventListener('click', () => {
      const mode = button.dataset.zoom;
      if (mode === 'reset') apply(IDENTITY);
      else apply(zoomAt(view, mode === 'in' ? 1.6 : 1 / 1.6, WORLD / 2, WORLD / 2, SIZE));
    });
  }

  select.addEventListener('change', () => {
    columnIndex = Math.max(0, INDICATORS.findIndex((indicator) => indicator.id === select.value));
    classify();
    if (selected !== null) select_(selected);
    schedule();
  });

  // ---- Find a city ----
  createPicker({
    container: must(stage, '[data-picker="m"]', HTMLElement),
    input: must(stage, '#brasil-find', HTMLInputElement),
    list: must(stage, '[data-picker-results]', HTMLElement),
    status: must(stage, '[data-picker-status]', HTMLElement),
    places,
    onChoose(row) {
      const at = centroids.get(row);
      if (at) apply(centerOn(at[0], at[1], 14, SIZE));
      select_(row);
    },
  });

  // ---- Theme: the canvas does not follow CSS variables by itself ----
  const retheme = (): void => {
    readColors();
    schedule();
  };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  new ResizeObserver(resize).observe(canvas);

  stage.hidden = false;
  readColors();
  classify();
  resize();
  status.textContent = '';
}

const load = document.querySelector<HTMLElement>('[data-brasil-load]');
const startButton = document.querySelector<HTMLButtonElement>('[data-brasil-start]');
if (load && startButton) {
  load.hidden = false;
  startButton.addEventListener('click', () => {
    load.hidden = true;
    void start().catch(() => {
      load.hidden = false;
      const status = document.querySelector('[data-brasil-status]');
      if (status) status.textContent = 'Não foi possível carregar o mapa. Tente de novo.';
    });
  });
}
