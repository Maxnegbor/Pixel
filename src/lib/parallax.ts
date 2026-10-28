export const SCENE_WIDTH = 1280;
export const SCENE_HEIGHT = 720;
// Shared overscan leaves 25.6 horizontal / 14.4 vertical pixels, beyond max travel.
export const SCENE_SCALE = 1.04;
export type PointerPosition = { x: number; y: number };
export function pointerPosition(x: number, y: number, width: number, height: number): PointerPosition {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  return { x: clamp(x / Math.max(1, width) * 2 - 1), y: clamp(y / Math.max(1, height) * 2 - 1) };
}
export function layerOffset(pointer: PointerPosition, layer: 'background' | 'room' | 'desk', reduced = false) {
  const strength = reduced || layer === 'background' ? 0 : layer === 'desk' ? 12 : 4;
  if (!strength) return { x: 0, y: 0 };
  return { x: -pointer.x * strength, y: -pointer.y * strength * .55 };
}
export function easePointer(current: PointerPosition, target: PointerPosition, dt: number) {
  const factor = 1 - Math.exp(-Math.min(.1, Math.max(0, dt)) * 7);
  return { x: current.x + (target.x - current.x) * factor, y: current.y + (target.y - current.y) * factor };
}
export const WINDOW_PANES = [
  { x: 464, y: 96, w: 388, h: 301 },
  { x: 365, y: 96, w: 55, h: 68 },
  { x: 365, y: 173, w: 55, h: 62 },
  { x: 365, y: 244, w: 55, h: 57 },
  { x: 365, y: 311, w: 55, h: 78 },
  { x: 900, y: 96, w: 54, h: 68 },
  { x: 900, y: 173, w: 54, h: 62 },
  { x: 900, y: 244, w: 54, h: 57 },
  { x: 900, y: 311, w: 54, h: 78 },
];
export function windowSilhouette() {
  const path = new Path2D();
  WINDOW_PANES.forEach(g=>path.rect(g.x,g.y,g.w,g.h));
  return path;
}
