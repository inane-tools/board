import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { boardsStore, libraryReady, deleteBoard, moveMoodItems, flushLibrary, createBoard, tagDefinitions, editTag, deleteTag } from './library';
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

it('renames shared tags everywhere, persists their colors, and removes assignments on delete', async () => {
  const home = makeBoard('canvas', null); home.tags = ['idea']; home.items = [makeMoodItem('note', { tags: ['idea'] })];
  boardsStore.set([home]); tagDefinitions.set([]); editTag('idea', 'project', '#123456');
  expect(get(boardsStore)[0].tags).toEqual(['project']); expect(get(boardsStore)[0].items[0].tags).toEqual(['project']);
  await flushLibrary(); expect(JSON.parse(localStorage.getItem('journal.library.v3')!).tagDefinitions).toEqual([{ name: 'project', color: '#123456' }]);
  deleteTag('project'); expect(get(boardsStore)[0].items[0].tags).toEqual([]); expect(get(tagDefinitions)).toEqual([]);
});

it('keeps a selected destination board in place while moving other items into it', () => {
  const home = makeBoard('canvas', null), target = makeBoard('canvas', home.id);
  const node = makeMoodItem('board', { boardId: target.id }), note = makeMoodItem('note'), image = makeMoodItem('image');
  home.items = [node, note, image]; boardsStore.set([home, target]);
  const notice = vi.fn(); window.addEventListener('journal:notice', notice);
  try {
    moveMoodItems(home.id, [node.id, note.id, image.id], target.id);
    expect(get(boardsStore).find(board => board.id === home.id)?.items.map(item => item.id)).toEqual([node.id]);
    const moved = get(boardsStore).find(board => board.id === target.id)!.items;
    expect(moved.map(item => [item.x, item.y])).toEqual([[40,40], [66,66]]);
    expect(notice).toHaveBeenCalledOnce();
  } finally { window.removeEventListener('journal:notice', notice); }
});
it('creates a child node at the requested center and above existing items', () => {
  const home = makeBoard('canvas', null); home.items = [makeMoodItem('note', { z: 999999 })]; boardsStore.set([home]);
  const child = createBoard('canvas', home.id, undefined, undefined, { x: 300, y: 200 });
  const node = get(boardsStore)[0].items.find(item => item.boardId === child.id)!;
  expect([node.x + node.width / 2, node.y + node.height / 2]).toEqual([300,200]);
  expect(node.z).toBeGreaterThan(999999); expect(child.title).toBe('Untitled board');
});
