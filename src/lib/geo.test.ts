import type { Feature } from 'geojson';
import { describe, expect, it } from 'vitest';
import { featureCentroid, insetLayout, mainPart, projectFeatures, projectInto, projectWithin, splitOutlying, topologyFeatures } from './geo.ts';

// Two 1°x1° squares around lon -50..-49 and -48..-47, lat -15..-14, in quantised TopoJSON form, wound clockwise as d3-geo expects.
function topology() {
  return {
    type: 'Topology' as const,
    objects: {
      X: {
        type: 'GeometryCollection' as const,
        geometries: [
          { type: 'Polygon' as const, properties: { codarea: '1100015' }, arcs: [[0]] },
          { type: 'Polygon' as const, properties: { codarea: '1100023' }, arcs: [[1]] },
        ],
      },
    },
    arcs: [
      [[0, 0], [0, 10], [10, 0], [0, -10], [-10, 0]],
      [[20, 0], [0, 10], [10, 0], [0, -10], [-10, 0]],
    ],
    transform: { scale: [0.1, 0.1] as [number, number], translate: [-50, -15] as [number, number] },
  };
}
describe('topologyFeatures', () => {
  it('turns a TopoJSON topology into features that keep their code', () => {
    const features = topologyFeatures(topology());
    expect(features.map((f) => f.codigo)).toEqual(['1100015', '1100023']);
    expect(features[0]?.feature.geometry.type).toBe('Polygon');
  });
});

// A 1°x1° mainland square and an island a tenth of its size 20° east, like Vitória (ES) and the
// Trindade islands: enough to drag an area-weighted centre far out to sea.
const withFarIsland: Feature = {
  type: 'Feature',
  properties: { codarea: '3205309' },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [[[-50, -15], [-50, -14], [-49, -14], [-49, -15], [-50, -15]]],
      [[[-30, -15], [-30, -14.7], [-29.7, -14.7], [-29.7, -15], [-30, -15]]],
    ],
  },
};

describe('featureCentroid', () => {
  it('returns [longitude, latitude], in that order', () => {
    const [first] = topologyFeatures(topology());
    if (!first) throw new Error('fixture has no features');
    const [lon, lat] = featureCentroid(first.feature);
    expect(lon).toBeCloseTo(-49.5, 1);
    expect(lat).toBeCloseTo(-14.5, 1);
  });

  it('places a multi-part shape on its largest part, not between the parts', () => {
    const [lon, lat] = featureCentroid(withFarIsland);
    expect(lon).toBeCloseTo(-49.5, 1);
    expect(lat).toBeCloseTo(-14.5, 1);
  });
});

describe('splitOutlying', () => {
  const square = (lon: number, lat: number, size = 1): number[][][] => [
    [[lon, lat], [lon, lat + size], [lon + size, lat + size], [lon + size, lat], [lon, lat]],
  ];
  const coded = (codigo: string, ...polygons: number[][][][]): { codigo: string; feature: Feature } => ({
    codigo,
    feature: {
      type: 'Feature',
      properties: { codarea: codigo },
      geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] ?? [] } : { type: 'MultiPolygon', coordinates: polygons },
    },
  });

  it('keeps neighbours and near islands with the landmass, and sets a far island apart', () => {
    const a = coded('2600001', square(-40, -9));
    const b = coded('2600002', square(-39, -9));
    const coastal = coded('2600003', square(-37.6, -9, 0.1)); // about 40 km off the coast
    const noronha = coded('2605459', square(-32.5, -3.9, 0.1)); // about 600 km away
    const { main, outlying } = splitOutlying([a, b, coastal, noronha]);
    expect(main.map((item) => item.codigo)).toEqual(['2600001', '2600002', '2600003']);
    expect(outlying.map((item) => item.codigo)).toEqual(['2605459']);
    expect(main[0]).toBe(a); // untouched features come back as they are
  });

  it('splits a municipality with a far island into its mainland and its island, under the same code', () => {
    const vitoria = coded('3205309', square(-40.4, -20.4, 0.2), square(-29.4, -20.6, 0.1));
    const neighbour = coded('3205002', square(-40.6, -20.4, 0.2));
    const { main, outlying } = splitOutlying([vitoria, neighbour]);
    expect(main.map((item) => item.codigo)).toEqual(['3205309', '3205002']);
    expect(outlying.map((item) => item.codigo)).toEqual(['3205309']);
    expect(main[0]?.feature.geometry.type).toBe('Polygon');
    expect(JSON.stringify(main[0]?.feature.geometry)).not.toContain('-29.4');
    expect(JSON.stringify(outlying[0]?.feature.geometry)).toContain('-29.4');
  });

  it('returns everything as main when nothing is far', () => {
    const { main, outlying } = splitOutlying([coded('3550308', square(-46.7, -23.6, 0.3))]);
    expect(main).toHaveLength(1);
    expect(outlying).toEqual([]);
  });
});

describe('insetLayout', () => {
  const at = (codigo: string, lon: number, lat: number) => ({
    codigo,
    feature: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } } as Feature,
  });

  it('puts the frame above a wide map, at the end toward the islands, and grows the viewBox upward', () => {
    const layout = insetLayout([at('1', -37, -8.4)], [at('2', -32.4, -3.9)], '0 0 800 300', { width: 200, height: 120 }, 16);
    expect(layout.frame).toEqual({ x: 598, y: -136, width: 200, height: 120 });
    expect(layout.viewBox).toBe('0 -138 800 438');
  });

  it('puts the frame beside a tall map, toward the islands, and grows the viewBox sideways', () => {
    const layout = insetLayout([at('1', -40.6, -19.6)], [at('2', -29.3, -20.5)], '0 0 400 800', { width: 200, height: 120 }, 16);
    expect(layout.frame).toEqual({ x: 416, y: 678, width: 200, height: 120 });
    expect(layout.viewBox).toBe('0 0 618 800');
  });
});

describe('projectInto', () => {
  it('keeps every coordinate inside the box, below the top padding', () => {
    const [first] = topologyFeatures(topology());
    if (!first) throw new Error('fixture has no features');
    const [item] = projectInto([first], { x: 500, y: -200, width: 200, height: 120 }, { top: 40, side: 8 });
    const numbers = (item?.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(508 - 0.1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(692 + 0.1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-160 - 0.1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(-88 + 0.1);
  });
});

describe('projectWithin with a far-off island in the context', () => {
  const mainland = [[[-41, -10], [-41, -7], [-35, -7], [-35, -10], [-41, -10]]];
  const island = [[[-32.5, -3.9], [-32.5, -3.8], [-32.4, -3.8], [-32.4, -3.9], [-32.5, -3.9]]];
  const state = { codigo: '26', feature: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [mainland, island] } } as Feature };
  const town = { codigo: '2611606', feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-35.2, -8.2], [-35.2, -8], [-35, -8], [-35, -8.2], [-35.2, -8.2]]] } } as Feature };
  const onIsland = { codigo: '2605459', feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: island } } as Feature };

  it('fits the mainland, so the state fills the frame', () => {
    const [, , w = 0, h = 0] = projectWithin(state, [town], { width: 600, padding: 0, kind: 'estado' }).viewBox.split(' ').map(Number);
    expect(w / h).toBeCloseTo(2, 0); // 6° by 3°, not stretched to the island 2.5° further east
  });

  it('still shows the island when the place itself is there', () => {
    const [, , w = 0, h = 0] = projectWithin(state, [onIsland], { width: 600, padding: 0, kind: 'estado' }).viewBox.split(' ').map(Number);
    expect(w / h).toBeGreaterThan(1.3);
    expect(w / h).not.toBeCloseTo(2, 0);
  });
});

describe('mainPart', () => {
  it('keeps the largest polygon of a multi-part shape', () => {
    const main = mainPart(withFarIsland);
    expect(main.geometry.type).toBe('Polygon');
    expect(JSON.stringify(main.geometry)).toContain('[-50,-15]');
    expect(JSON.stringify(main.geometry)).not.toContain('-29.7');
  });

  it('returns a single polygon as it is', () => {
    const [first] = topologyFeatures(topology());
    if (!first) throw new Error('fixture has no features');
    expect(mainPart(first.feature)).toBe(first.feature);
  });
});

describe('projectFeatures', () => {
  const features = topologyFeatures(topology());

  it('gives one SVG path per feature and a viewBox of the requested size', () => {
    const projected = projectFeatures(features, { width: 400, height: 300, padding: 10, kind: 'estado' });
    expect(projected.viewBox).toBe('0 0 400 300');
    expect(projected.items.map((item) => item.codigo)).toEqual(['1100015', '1100023']);
    expect(projected.items.every((item) => item.d.startsWith('M'))).toBe(true);
  });

  it('keeps every coordinate inside the frame', () => {
    const projected = projectFeatures(features, { width: 400, height: 300, padding: 10, kind: 'brasil' });
    const numbers = projected.items.flatMap((item) => (item.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number));
    expect(numbers.length).toBeGreaterThan(0);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(400);
  });

  it('rounds coordinates to one decimal to keep the page light', () => {
    const projected = projectFeatures(features, { width: 400, height: 300, padding: 10, kind: 'estado' });
    const decimals = projected.items.flatMap((item) => item.d.match(/\.\d+/g) ?? []);
    expect(decimals.every((fraction) => fraction.length <= 2)).toBe(true);
  });

  it('places a label point inside the frame for each feature', () => {
    const projected = projectFeatures(features, { width: 400, height: 300, padding: 10, kind: 'estado' });
    for (const item of projected.items) {
      expect(item.cx).toBeGreaterThan(0);
      expect(item.cx).toBeLessThan(400);
      expect(item.cy).toBeGreaterThan(0);
      expect(item.cy).toBeLessThan(300);
    }
  });
});

describe('projectFeatures with fit: "content"', () => {
  // A wide shape: 3° of longitude by 1° of latitude, so the frame cannot be 4:3.
  const wide = topologyFeatures({
    type: 'Topology',
    objects: { X: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: { codarea: '1100015' }, arcs: [[0]] }] } },
    arcs: [[[0, 0], [0, 10], [30, 0], [0, -10], [-30, 0]]],
    transform: { scale: [0.1, 0.1], translate: [-50, -15] },
  });

  it('hugs the shape: the viewBox takes the shape proportions plus the padding', () => {
    const projected = projectFeatures(wide, { width: 600, height: 600, padding: 10, kind: 'estado', fit: 'content' });
    const [, , w, h] = projected.viewBox.split(' ').map(Number) as [number, number, number, number];
    expect(w).toBeGreaterThan(h * 2.5); // roughly 3:1 once Mercator stretches latitude
    expect(w).toBeLessThanOrEqual(600 + 1);
  });

  it('keeps the shape inside the viewBox, `padding` away from every edge', () => {
    const projected = projectFeatures(wide, { width: 600, height: 600, padding: 10, kind: 'estado', fit: 'content' });
    const [, , w, h] = projected.viewBox.split(' ').map(Number) as [number, number, number, number];
    const numbers = (projected.items[0]?.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(9.5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(9.5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(w - 9.5);
    expect(Math.max(...ys)).toBeLessThanOrEqual(h - 9.5);
  });
});

describe('projectWithin', () => {
  const [first, second] = topologyFeatures(topology());

  it('draws the context and the features in one projection, so they line up', () => {
    if (!first || !second) throw new Error('fixture has no features');
    const result = projectWithin(first, [second], { width: 400, padding: 10, kind: 'estado' });
    expect(result.context.d.startsWith('M')).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.codigo).toBe('1100023');
  });

  it('sizes the viewBox to the context, not to the features', () => {
    if (!first || !second) throw new Error('fixture has no features');
    const alone = projectWithin(first, [first], { width: 400, padding: 10, kind: 'estado' });
    const other = projectWithin(first, [second], { width: 400, padding: 10, kind: 'estado' });
    expect(alone.viewBox).toBe(other.viewBox);
  });

  it('gives the centre of each feature as a label point inside the viewBox', () => {
    if (!first) throw new Error('fixture has no features');
    const result = projectWithin(first, [first], { width: 400, padding: 10, kind: 'estado' });
    const [, , w, h] = result.viewBox.split(' ').map(Number) as [number, number, number, number];
    const item = result.items[0];
    expect(item?.cx).toBeGreaterThan(0);
    expect(item?.cx).toBeLessThan(w);
    expect(item?.cy).toBeGreaterThan(0);
    expect(item?.cy).toBeLessThan(h);
  });
});

describe('ProjectedItem.area', () => {
  it('gives a bigger area to a bigger shape', () => {
    const [small, big] = projectFeatures(
      topologyFeatures({
        type: 'Topology',
        objects: {
          X: {
            type: 'GeometryCollection',
            geometries: [
              { type: 'Polygon', properties: { codarea: '1100015' }, arcs: [[0]] },
              { type: 'Polygon', properties: { codarea: '1100023' }, arcs: [[1]] },
            ],
          },
        },
        arcs: [
          [[0, 0], [0, 5], [5, 0], [0, -5], [-5, 0]],
          [[20, 0], [0, 20], [20, 0], [0, -20], [-20, 0]],
        ],
        transform: { scale: [0.1, 0.1], translate: [-50, -15] },
      }),
      { width: 400, height: 300, padding: 10, kind: 'estado' },
    ).items;
    expect(big?.area).toBeGreaterThan((small?.area ?? 0) * 4);
  });
});
