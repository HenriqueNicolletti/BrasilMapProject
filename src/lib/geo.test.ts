import { describe, expect, it } from 'vitest';
import { featureCentroid, projectFeatures, projectWithin, topologyFeatures } from './geo.ts';

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

describe('featureCentroid', () => {
  it('returns [longitude, latitude], in that order', () => {
    const [first] = topologyFeatures(topology());
    if (!first) throw new Error('fixture has no features');
    const [lon, lat] = featureCentroid(first.feature);
    expect(lon).toBeCloseTo(-49.5, 1);
    expect(lat).toBeCloseTo(-14.5, 1);
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
