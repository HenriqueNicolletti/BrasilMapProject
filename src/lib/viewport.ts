/** Pan and zoom of a map drawn at (0,0)-(width,height): screen = world × k + (x, y). */
export interface View {
  k: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 60;

export const IDENTITY: View = { k: 1, x: 0, y: 0 };

/** Keeps at least a margin of the map on screen, so it can never be dragged out of sight. */
export function clampView(view: View, size: Size, keep = 0.2): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k));
  const mapW = size.width * k;
  const mapH = size.height * k;
  const minX = size.width * keep - mapW;
  const maxX = size.width * (1 - keep);
  const minY = size.height * keep - mapH;
  const maxY = size.height * (1 - keep);
  return { k, x: Math.min(maxX, Math.max(minX, view.x)), y: Math.min(maxY, Math.max(minY, view.y)) };
}

/** Zooms by `factor` keeping the world point under the screen point (px, py) where it is. */
export function zoomAt(view: View, factor: number, px: number, py: number, size: Size): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  const ratio = k / view.k;
  return clampView({ k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, size);
}

export function panBy(view: View, dx: number, dy: number, size: Size): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

/** A view at zoom `k` with the world point (wx, wy) in the middle of the screen. */
export function centerOn(wx: number, wy: number, k: number, size: Size): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
  return clampView({ k: zoom, x: size.width / 2 - wx * zoom, y: size.height / 2 - wy * zoom }, size);
}

export function screenToWorld(view: View, sx: number, sy: number): [number, number] {
  return [(sx - view.x) / view.k, (sy - view.y) / view.k];
}

/** Shape `index` as the colour it gets on the hidden picking canvas; 0 is kept for "nothing here". */
export function idToRgb(index: number): [number, number, number] {
  const id = index + 1;
  return [(id >> 16) & 255, (id >> 8) & 255, id & 255];
}

/** Inverse of `idToRgb`; null for the background or a value outside `count` (an antialiased edge). */
export function rgbToId(r: number, g: number, b: number, count: number): number | null {
  const id = (r << 16) | (g << 8) | b;
  return id >= 1 && id <= count ? id - 1 : null;
}
