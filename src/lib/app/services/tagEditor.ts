import { writable } from 'svelte/store';
export const tagEditor = writable<{ boardId: string; itemId?: string; itemIds?: string[] } | null>(null);
export function openTagEditor(boardId: string, itemId?: string | string[]): void { tagEditor.set(Array.isArray(itemId) ? { boardId, itemIds: itemId } : { boardId, itemId }); }
export function closeTagEditor(): void { tagEditor.set(null); }
