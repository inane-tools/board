export const CANVAS_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
export function stepCanvasZoom(current: number, direction: -1 | 1): number {
  return direction === 1
    ? CANVAS_ZOOM_STEPS.find(value => value > current + 0.0001) ?? 3
    : [...CANVAS_ZOOM_STEPS].reverse().find(value => value < current - 0.0001) ?? 0.25;
}
