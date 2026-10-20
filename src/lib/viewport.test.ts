import { describe, expect, it } from 'vitest';
import { centerOn, clampView, IDENTITY, idToRgb, MAX_ZOOM, MIN_ZOOM, panBy, rgbToId, screenToWorld, zoomAt } from './viewport.ts';

const size = { width: 800, height: 600 };

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const view = zoomAt(IDENTITY, 4, 300, 200, size);
    const [wx, wy] = screenToWorld(view, 300, 200);
    expect(wx).toBeCloseTo(300);
    expect(wy).toBeCloseTo(200);
    expect(view.k).toBe(4);
  });

  it('stays inside the zoom limits', () => {
    expect(zoomAt(IDENTITY, 0.1, 0, 0, size).k).toBe(MIN_ZOOM);
    expect(zoomAt({ k: 50, x: 0, y: 0 }, 10, 0, 0, size).k).toBe(MAX_ZOOM);
  });

  it('zooming in then out by the same factor returns to the start', () => {
    const back = zoomAt(zoomAt(IDENTITY, 3, 400, 300, size), 1 / 3, 400, 300, size);
    expect(back.k).toBeCloseTo(1);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
  });
});

describe('clampView and panBy', () => {
  it('never lets the map leave the screen entirely', () => {
    const far = panBy({ k: 2, x: 0, y: 0 }, 99999, -99999, size);
    expect(far.x).toBeLessThan(size.width);
    expect(far.y + size.height * far.k).toBeGreaterThan(0);
  });

  it('moves freely inside the limits', () => {
    expect(panBy({ k: 2, x: -100, y: -100 }, 30, 20, size)).toEqual({ k: 2, x: -70, y: -80 });
  });

  it('clamps a zoom that is out of range', () => {
    expect(clampView({ k: 500, x: 0, y: 0 }, size).k).toBe(MAX_ZOOM);
  });
});

describe('centerOn', () => {
  it('puts the chosen world point in the middle of the screen', () => {
    const view = centerOn(500, 400, 8, size);
    const [wx, wy] = screenToWorld(view, size.width / 2, size.height / 2);
    expect(wx).toBeCloseTo(500);
    expect(wy).toBeCloseTo(400);
  });
});

describe('picking colours', () => {
  it('round-trips every index of a national map', () => {
    for (const index of [0, 1, 255, 256, 5569, 5570]) {
      const [r, g, b] = idToRgb(index);
      expect(rgbToId(r, g, b, 5571)).toBe(index);
    }
  });

  it('reads the background (0,0,0) and out-of-range blends as nothing', () => {
    expect(rgbToId(0, 0, 0, 5571)).toBeNull();
    expect(rgbToId(255, 255, 255, 5571)).toBeNull();
  });

  it('gives each index a distinct colour', () => {
    const seen = new Set(Array.from({ length: 5571 }, (_, i) => idToRgb(i).join(',')));
    expect(seen.size).toBe(5571);
  });
});
