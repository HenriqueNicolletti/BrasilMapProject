import { geoArea, geoCentroid, geoConicEqualArea, geoContains, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export interface CodedFeature {
  /** IBGE code from the mesh (`codarea`): 2 digits for a state, 7 for a municipality. */
  codigo: string;
  feature: Feature;
}

/** Reads the first (and only) object of an IBGE mesh topology as features. */
export function topologyFeatures(topology: Topology): CodedFeature[] {
  const object = Object.values(topology.objects)[0] as GeometryCollection | undefined;
  if (!object) throw new Error('The topology has no objects');
  const collection = topoFeature(topology, object) as FeatureCollection;
  return collection.features.map((item) => {
    const codarea = (item.properties as { codarea?: unknown } | null)?.codarea;
    if (typeof codarea !== 'string') throw new Error('A mesh geometry has no codarea');
    return { codigo: codarea, feature: item };
  });
}

/**
 * The largest polygon of a multi-part shape. Its centre is where the place is: Vitória (ES) includes the
 * Trindade islands, over 1,000 km offshore, and the centre of all its parts falls in the open sea.
 */
export function mainPart(item: Feature): Feature {
  const { geometry } = item;
  if (geometry.type !== 'MultiPolygon') return item;
  let largest: Polygon | null = null;
  let largestArea = -1;
  for (const coordinates of geometry.coordinates) {
    const polygon: Polygon = { type: 'Polygon', coordinates };
    const area = geoArea(polygon);
    if (area > largestArea) {
      largest = polygon;
      largestArea = area;
    }
  }
  return largest === null ? item : { ...item, geometry: largest };
}

/** `[longitude, latitude]`, the GeoJSON order, of the shape's largest part. */
export function featureCentroid(item: Feature): [number, number] {
  const [lon, lat] = geoCentroid(mainPart(item));
  return [lon, lat];
}

export interface ProjectOptions {
  width: number;
  height: number;
  padding: number;
  /** `brasil` uses a conic equal-area projection centred on the country; `estado` is plain Mercator. */
  kind: 'brasil' | 'estado';
  /**
   * `frame` (default) fits the shapes inside width x height. `content` fits them inside that box too,
   * then shrinks the viewBox to the shapes plus `padding`, so a wide or tall state is not letterboxed.
   */
  fit?: 'frame' | 'content';
}

export interface ProjectedItem {
  codigo: string;
  d: string;
  /** Label point in SVG coordinates. */
  cx: number;
  cy: number;
  /** Area of the shape in SVG units squared, to tell shapes big enough to carry a label. */
  area: number;
}

export interface ProjectedMap {
  viewBox: string;
  items: ProjectedItem[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function projectFeatures(features: readonly CodedFeature[], options: ProjectOptions): ProjectedMap {
  const { width, height, padding, kind, fit = 'frame' } = options;
  const collection: FeatureCollection = { type: 'FeatureCollection', features: features.map((f) => f.feature) };

  const projection: GeoProjection =
    kind === 'brasil' ? geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]) : geoMercator();
  projection.fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    collection,
  );

  let viewBox = `0 0 ${String(width)} ${String(height)}`;
  if (fit === 'content') {
    const [x, y] = projection.translate();
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(collection);
    projection.translate([x + padding - x0, y + padding - y0]);
    viewBox = `0 0 ${String(Math.ceil(x1 - x0 + 2 * padding))} ${String(Math.ceil(y1 - y0 + 2 * padding))}`;
  }

  const path = geoPath(projection).digits(1);
  const items = features.map(({ codigo, feature }) => {
    const [cx, cy] = path.centroid(mainPart(feature));
    return { codigo, d: path(feature) ?? '', cx: round1(cx), cy: round1(cy), area: Math.round(path.area(feature)) };
  });
  return { viewBox, items };
}

export interface SplitMap {
  /** The landmass, with the islands near its coast. */
  main: CodedFeature[];
  /** Parts far offshore, e.g. Fernando de Noronha (PE) or Trindade and Martim Vaz (part of Vitória, ES). */
  outlying: CodedFeature[];
}

type Box = [minLon: number, minLat: number, maxLon: number, maxLat: number];

function ringBox(ring: readonly number[][]): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon = 0, lat = 0] of ring) {
    box[0] = Math.min(box[0], lon);
    box[1] = Math.min(box[1], lat);
    box[2] = Math.max(box[2], lon);
    box[3] = Math.max(box[3], lat);
  }
  return box;
}

/** Gap between two boxes in km, 0 when they touch or overlap (plate carrée; fine at state scale). */
function boxGapKm(a: Box, b: Box): number {
  const dLon = Math.max(0, a[0] - b[2], b[0] - a[2]);
  const dLat = Math.max(0, a[1] - b[3], b[1] - a[3]);
  const midLat = ((a[1] + a[3] + b[1] + b[3]) / 4) * (Math.PI / 180);
  return Math.hypot(dLon * 111.32 * Math.cos(midLat), dLat * 110.57);
}

/**
 * Separates the parts of a map that lie more than `gapKm` from its landmass. Starting from the largest
 * polygon, every polygon within `gapKm` of the growing cluster joins it; what never joins is outlying.
 * A municipality with parts on both sides (Vitória) comes back twice, once in each list, with the same code.
 */
export function splitOutlying(features: readonly CodedFeature[], gapKm = 150): SplitMap {
  const parts = features.flatMap(({ feature }, index) => {
    const { geometry } = feature;
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : [];
    return polygons.map((coordinates) => ({
      index,
      coordinates,
      box: ringBox(coordinates[0] ?? []),
      area: geoArea({ type: 'Polygon', coordinates }),
    }));
  });
  const seed = parts.reduce<(typeof parts)[number] | null>((best, part) => (best === null || part.area > best.area ? part : best), null);
  if (seed === null) return { main: [...features], outlying: [] };

  const inMain = new Set([seed]);
  const cluster: Box = [...seed.box];
  for (let grew = true; grew; ) {
    grew = false;
    for (const part of parts) {
      if (inMain.has(part) || boxGapKm(part.box, cluster) > gapKm) continue;
      inMain.add(part);
      cluster[0] = Math.min(cluster[0], part.box[0]);
      cluster[1] = Math.min(cluster[1], part.box[1]);
      cluster[2] = Math.max(cluster[2], part.box[2]);
      cluster[3] = Math.max(cluster[3], part.box[3]);
      grew = true;
    }
  }

  const withPolygons = (item: CodedFeature, polygons: Polygon['coordinates'][]): CodedFeature => ({
    codigo: item.codigo,
    feature: {
      ...item.feature,
      geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] ?? [] } : { type: 'MultiPolygon', coordinates: polygons },
    },
  });
  const main: CodedFeature[] = [];
  const outlying: CodedFeature[] = [];
  features.forEach((item, index) => {
    const own = parts.filter((part) => part.index === index);
    const near = own.filter((part) => inMain.has(part));
    const far = own.filter((part) => !inMain.has(part));
    if (far.length === 0) main.push(item);
    else if (near.length === 0) outlying.push(item);
    else {
      main.push(withPolygons(item, near.map((part) => part.coordinates)));
      outlying.push(withPolygons(item, far.map((part) => part.coordinates)));
    }
  });
  return { main, outlying };
}

export interface Box2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InsetLayout {
  /** The plate's viewBox, grown to hold the inset beside the main map. */
  viewBox: string;
  /** Where the inset's frame goes, in plate units. */
  frame: Box2D;
}

/**
 * Places an inset frame beside a map fitted with `fit: 'content'` (viewBox `0 0 W H`). The frame goes on
 * the side that keeps the plate closest to square (above or below a wide map, beside a tall one), toward
 * the outlying parts, so the main map is never covered.
 */
export function insetLayout(main: readonly CodedFeature[], outlying: readonly CodedFeature[], mainViewBox: string, size: { width: number; height: number }, gap: number): InsetLayout {
  const [, , W = 0, H = 0] = mainViewBox.split(/\s+/).map(Number);
  const centre = (items: readonly CodedFeature[]) => geoCentroid({ type: 'FeatureCollection', features: items.map((item) => mainPart(item.feature)) });
  const [mainLon, mainLat] = centre(main);
  const [farLon, farLat] = centre(outlying);
  const east = farLon >= mainLon;
  const north = farLat >= mainLat;
  const { width: w, height: h } = size;
  const edge = 2; // keeps the frame's rule off the viewBox edge, where half of it would be cut

  if (W >= H) {
    const y = north ? -(gap + h) : H + gap;
    const top = north ? y - edge : 0;
    return {
      viewBox: `0 ${String(top)} ${String(W)} ${String(H + gap + h + edge)}`,
      frame: { x: east ? W - w - edge : edge, y, width: w, height: h },
    };
  }
  const x = east ? W + gap : -(gap + w);
  return {
    viewBox: `${String(east ? 0 : x - edge)} 0 ${String(W + gap + w + edge)} ${String(H)}`,
    frame: { x, y: north ? edge : H - h - edge, width: w, height: h },
  };
}

/** Projects `features` to fill `box` (less `padding`), in the plate's own coordinates. */
export function projectInto(features: readonly CodedFeature[], box: Box2D, padding: { top: number; side: number }): ProjectedItem[] {
  const collection: FeatureCollection = { type: 'FeatureCollection', features: features.map((f) => f.feature) };
  const projection = geoMercator().fitExtent(
    [
      [box.x + padding.side, box.y + padding.top],
      [box.x + box.width - padding.side, box.y + box.height - padding.side],
    ],
    collection,
  );
  const path = geoPath(projection).digits(1);
  return features.map(({ codigo, feature }) => {
    const [cx, cy] = path.centroid(mainPart(feature));
    return { codigo, d: path(feature) ?? '', cx: round1(cx), cy: round1(cy), area: Math.round(path.area(feature)) };
  });
}

export interface WithinOptions {
  /** Width of the viewBox; the height follows the context's proportions. */
  width: number;
  padding: number;
  kind: 'brasil' | 'estado';
}

export interface WithinMap {
  viewBox: string;
  /** The context shape (e.g. the state outline). */
  context: { d: string };
  items: ProjectedItem[];
}

/**
 * Projects `features` inside a `context` shape with ONE projection fitted to the context, so a
 * municipality sits exactly where it belongs inside its state's outline. The fit leaves out the
 * context's far-off islands (Fernando de Noronha in Pernambuco), unless a feature lies there.
 */
export function projectWithin(context: CodedFeature, features: readonly CodedFeature[], options: WithinOptions): WithinMap {
  const { width, padding, kind } = options;
  const projection: GeoProjection =
    kind === 'brasil' ? geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]) : geoMercator();
  const { main } = splitOutlying([context]);
  const mainland = main[0]?.feature ?? context.feature;
  const onIsland = features.some((item) => !geoContains(mainland, geoCentroid(mainPart(item.feature))));
  const frame = onIsland ? context.feature : mainland;
  projection.fitWidth(width - 2 * padding, frame);

  const [x, y] = projection.translate();
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(frame);
  projection.translate([x + padding - x0, y + padding - y0]);

  const path = geoPath(projection).digits(1);
  const items = features.map(({ codigo, feature }) => {
    const [cx, cy] = path.centroid(mainPart(feature));
    return { codigo, d: path(feature) ?? '', cx: round1(cx), cy: round1(cy), area: Math.round(path.area(feature)) };
  });
  const w = Math.ceil(x1 - x0 + 2 * padding);
  const h = Math.ceil(y1 - y0 + 2 * padding);
  return { viewBox: `0 0 ${String(w)} ${String(h)}`, context: { d: path(context.feature) ?? '' }, items };
}
