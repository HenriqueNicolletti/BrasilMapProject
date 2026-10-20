import { geoCentroid, geoConicEqualArea, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';
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

/** `[longitude, latitude]`, the GeoJSON order. */
export function featureCentroid(item: Feature): [number, number] {
  const [lon, lat] = geoCentroid(item);
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
    const [cx, cy] = path.centroid(feature);
    return { codigo, d: path(feature) ?? '', cx: round1(cx), cy: round1(cy), area: Math.round(path.area(feature)) };
  });
  return { viewBox, items };
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
 * municipality sits exactly where it belongs inside its state's outline.
 */
export function projectWithin(context: CodedFeature, features: readonly CodedFeature[], options: WithinOptions): WithinMap {
  const { width, padding, kind } = options;
  const projection: GeoProjection =
    kind === 'brasil' ? geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]) : geoMercator();
  projection.fitWidth(width - 2 * padding, context.feature);

  const [x, y] = projection.translate();
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(context.feature);
  projection.translate([x + padding - x0, y + padding - y0]);

  const path = geoPath(projection).digits(1);
  const items = features.map(({ codigo, feature }) => {
    const [cx, cy] = path.centroid(feature);
    return { codigo, d: path(feature) ?? '', cx: round1(cx), cy: round1(cy), area: Math.round(path.area(feature)) };
  });
  const w = Math.ceil(x1 - x0 + 2 * padding);
  const h = Math.ceil(y1 - y0 + 2 * padding);
  return { viewBox: `0 0 ${String(w)} ${String(h)}`, context: { d: path(context.feature) ?? '' }, items };
}
