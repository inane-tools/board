// The board item list ("@" browser), toggled from the title bar and rendered by
// the canvas. Kept in a store so the button can live outside the canvas.

import { writable } from 'svelte/store';

export const boardItemsOpen = writable(false);

export function toggleBoardItems(): void {
  boardItemsOpen.update((open) => !open);
}

export function closeBoardItems(): void {
  boardItemsOpen.set(false);
}
