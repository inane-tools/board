import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { boardsStore, libraryReady, deleteBoard, moveMoodItems, flushLibrary } from './library';
import { descendantIds, makeBoard, makeMoodItem } from '$lib/core/board';
beforeEach(() => { vi.useFakeTimers(); libraryReady.set(true); localStorage.clear(); });
afterEach(async () => { await flushLibrary(); vi.useRealTimers(); });
it('keeps Home even when a caller requests its deletion', () => {
  const home = makeBoard('canvas', null); boardsStore.set([home]); deleteBoard(home.id);
  expect(get(boardsStore)).toEqual([home]);
});
it('rejects moving a board into its descendant or a document', () => {
  const home = makeBoard('canvas', null);
  const child = makeBoard('canvas', home.id);
  const nested = makeBoard('canvas', child.id);
  const doc = makeBoard('document', home.id);
  const node = makeMoodItem('board', { boardId: child.id }); home.items = [node];
  const boards = [home, child, nested, doc]; boardsStore.set(boards);
  moveMoodItems(home.id, [node.id], nested.id); expect(get(boardsStore)).toBe(boards);
  moveMoodItems(home.id, [node.id], doc.id); expect(get(boardsStore)).toBe(boards);
});
it('moves child boards to a valid canvas and updates their parent', () => {
  const home = makeBoard('canvas', null), target = makeBoard('canvas', home.id), child = makeBoard('canvas', home.id);
  const node = makeMoodItem('board', { boardId: child.id }); home.items = [node]; boardsStore.set([home, target, child]);
  moveMoodItems(home.id, [node.id], target.id);
  expect(get(boardsStore).find(b => b.id === child.id)?.parentId).toBe(target.id);
  expect(get(boardsStore).find(b => b.id === target.id)?.items[0].id).toBe(node.id);
});
it('terminates descendant traversal even for a damaged cyclic tree', () => {
  const a = makeBoard('canvas', 'b'); a.id = 'a'; const b = makeBoard('canvas', 'a'); b.id = 'b';
  expect(descendantIds([a, b], 'a')).toEqual(['b']);
});
