import type { Board } from '$lib/core/board';
/** Shared by the canvas and header fade so custom colors and tint stay in sync. */
export function canvasBackground(board: Board, tinted: boolean): string {
  const base = board.color === '#1c1c1c' ? 'var(--board-canvas)' : board.color;
  return tinted ? `color-mix(in srgb, var(--color-accent) 14%, ${base})` : base;
}
