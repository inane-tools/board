// The library service: the single source of truth for the board tree.
//
// Components read the store and call these mutators; every mutator updates the
// in-memory store immediately and schedules a debounced write. That keeps
// typing responsive while still persisting continuously.

import { get, writable } from 'svelte/store';
import {
  descendantIds,
  makeBlock,
  makeBoard,
  makeMoodItem,
  rootBoard,
  type Block,
  type BlockType,
  type Board,
  type BoardKind,
  type Library,
  type MoodItem,
} from '$lib/core/board';
import { loadLibrary, saveLibrary } from '$lib/infra/storage/journalRepo';


export const boardsStore = writable<Board[]>([]);
export const libraryReady = writable(false);

const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const librarySaveError = writable<string | null>(null);
async function persist(): Promise<void> {
  try { await saveLibrary(snapshot()); librarySaveError.set(null); }
  catch (error) {
    librarySaveError.set('Your changes could not be saved. Keep Board open and retry.');
    throw error;
  }
}

function snapshot(): Library {
  return { boards: get(boardsStore) };
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persist().catch(() => undefined);
  }, SAVE_DEBOUNCE_MS);
}

/** Persist immediately (used before destructive actions and on exit). */
export async function flushLibrary(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (get(libraryReady)) await persist();
}

export async function initLibrary(): Promise<void> {
  const library = await loadLibrary();
  let boards = library.boards;
  if (!rootBoard(boards)) {
    // A library always has a root board.
    boards = [makeBoard('canvas', null, 'Home', '🏠'), ...boards];
    boardsStore.set(boards);
    await saveLibrary({ boards });
  } else {
    boardsStore.set(boards);
  }
  libraryReady.set(true);
  // Never sweep assets while imports or unsaved edits may still reference them.
  // Unreferenced files are retained until the user explicitly resets app data.
}

/** The root (Home) board. */
export function getRootBoard(): Board | undefined {
  return rootBoard(get(boardsStore));
}

function touch(board: Board, patch: Partial<Board>): Board {
  return { ...board, ...patch, updatedAt: Date.now() };
}

/** Apply a change to one board in place and persist. */
function mutateBoard(id: string, fn: (board: Board) => Board): void {
  boardsStore.update((list) => list.map((board) => (board.id === id ? fn(board) : board)));
  scheduleSave();
}

// ── Boards ───────────────────────────────────────────────────────
/** Create a child board. Canvas parents also get a node pointing at it. */
export function createBoard(
  kind: BoardKind,
  parentId: string | null,
  title?: string,
  icon?: string,
): Board {
  const board = makeBoard(kind, parentId, title, icon);
  boardsStore.update((list) => {
    let next = [...list, board];
    if (parentId) {
      next = next.map((parent) => {
        if (parent.id !== parentId || parent.kind !== 'canvas') return parent;
        const count = parent.items.length;
        const node = makeMoodItem('board', {
          boardId: board.id,
          x: 60 + (count % 4) * 260,
          y: 60 + Math.floor(count / 4) * 160,
        });
        return { ...parent, items: [...parent.items, node], updatedAt: Date.now() };
      });
    }
    return next;
  });
  scheduleSave();
  return board;
}

export function updateBoard(id: string, patch: Partial<Board>): void {
  mutateBoard(id, (board) => touch(board, patch));
}

export function toggleFavorite(id: string): void {
  mutateBoard(id, (board) => touch(board, { favorite: !board.favorite }));
}

/** Delete a board, its descendants, and any nodes that referenced them. */
export function deleteBoard(id: string): void {
  if (get(boardsStore).find((board) => board.id === id)?.parentId === null) return;
  boardsStore.update((list) => {
    const doomed = new Set([id, ...descendantIds(list, id)]);
    return list
      .filter((board) => !doomed.has(board.id))
      .map((board) => {
        const items = board.items.filter((item) => !(item.type === 'board' && item.boardId && doomed.has(item.boardId)));
        return items.length === board.items.length ? board : { ...board, items };
      });
  });
  scheduleSave();
}

// ── Document blocks ──────────────────────────────────────────────
export function addBlock(id: string, afterBlockId: string | null, type: BlockType = 'paragraph'): string {
  const block = makeBlock(type);
  mutateBoard(id, (board) => {
    const blocks = [...board.blocks];
    const index = afterBlockId ? blocks.findIndex((b) => b.id === afterBlockId) : -1;
    blocks.splice(index + 1, 0, block);
    return touch(board, { blocks });
  });
  return block.id;
}

export function updateBlock(id: string, blockId: string, patch: Partial<Block>): void {
  mutateBoard(id, (board) => ({
    ...board,
    updatedAt: Date.now(),
    blocks: board.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
  }));
}

export function removeBlock(id: string, blockId: string): void {
  mutateBoard(id, (board) => {
    const blocks = board.blocks.filter((block) => block.id !== blockId);
    return touch(board, { blocks: blocks.length ? blocks : [makeBlock('paragraph')] });
  });
}

export function moveBlock(id: string, blockId: string, direction: -1 | 1): void {
  mutateBoard(id, (board) => {
    const blocks = [...board.blocks];
    const index = blocks.findIndex((block) => block.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return board;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    return touch(board, { blocks });
  });
}

export function reorderBlock(id: string, blockId: string, toIndex: number): void {
  mutateBoard(id, (board) => {
    const blocks = [...board.blocks];
    const from = blocks.findIndex((block) => block.id === blockId);
    if (from < 0) return board;
    const [moved] = blocks.splice(from, 1);
    blocks.splice(Math.max(0, Math.min(toIndex, blocks.length)), 0, moved);
    return touch(board, { blocks });
  });
}

// ── Canvas items ─────────────────────────────────────────────────
export function addMoodItem(id: string, item: MoodItem): void {
  mutateBoard(id, (board) => {
    const maxZ = board.items.reduce((max, it) => Math.max(max, it.z), 0);
    return { ...board, updatedAt: Date.now(), items: [...board.items, { ...item, z: maxZ + 1 }] };
  });
}

export function updateMoodItem(id: string, itemId: string, patch: Partial<MoodItem>): void {
  mutateBoard(id, (board) => ({
    ...board,
    updatedAt: Date.now(),
    items: board.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  }));
}

export function removeMoodItem(id: string, itemId: string): void {
  mutateBoard(id, (board) => ({
    ...board,
    updatedAt: Date.now(),
    items: board.items.filter((item) => item.id !== itemId),
  }));
}

/** Apply patches to several items at once (marquee move). */
export function updateMoodItems(id: string, patches: Record<string, Partial<MoodItem>>): void {
  mutateBoard(id, (board) => ({
    ...board,
    updatedAt: Date.now(),
    items: board.items.map((item) => (patches[item.id] ? { ...item, ...patches[item.id] } : item)),
  }));
}

/** Remove several items at once (multi-select delete). */
export function removeMoodItems(id: string, itemIds: string[]): void {
  const doomed = new Set(itemIds);
  mutateBoard(id, (board) => ({
    ...board,
    updatedAt: Date.now(),
    items: board.items.filter((item) => !doomed.has(item.id)),
  }));
}

export function bringMoodItemToFront(id: string, itemId: string): void {
  mutateBoard(id, (board) => {
    const maxZ = board.items.reduce((max, it) => Math.max(max, it.z), 0);
    return {
      ...board,
      updatedAt: Date.now(),
      items: board.items.map((item) => (item.id === itemId ? { ...item, z: maxZ + 1 } : item)),
    };
  });
}

/** Raise several items above the rest, preserving their relative order. */
export function bringMoodItemsToFront(id: string, itemIds: string[]): void {
  const wanted = new Set(itemIds);
  mutateBoard(id, (board) => {
    const moving = board.items.filter((it) => wanted.has(it.id)).sort((a, b) => a.z - b.z);
    if (moving.length === 0) return board;
    let z = board.items.reduce((max, it) => Math.max(max, it.z), 0);
    const zById = new Map<string, number>();
    for (const it of moving) {
      z += 1;
      zById.set(it.id, z);
    }
    return {
      ...board,
      updatedAt: Date.now(),
      items: board.items.map((item) => (zById.has(item.id) ? { ...item, z: zById.get(item.id)! } : item)),
    };
  });
}

/** Move items from one board to another (used to send them to a new/existing board). */
export function moveMoodItems(fromId: string, itemIds: string[], toId: string): void {
  if (fromId === toId) return;
  const wanted = new Set(itemIds);
  boardsStore.update((list) => {
    const from = list.find((board) => board.id === fromId);
    const to = list.find((board) => board.id === toId);
    if (!from || !to || to.kind !== 'canvas') return list;
    const moving = from.items.filter((item) => wanted.has(item.id));
    if (moving.length === 0) return list;
    for (const item of moving) {
      if (item.type !== 'board' || !item.boardId) continue;
      const child = list.find((board) => board.id === item.boardId);
      if (!child || child.parentId === null || child.id === toId || descendantIds(list, child.id).includes(toId)) return list;
    }

    let z = to.items.reduce((max, it) => Math.max(max, it.z), 0);
    const placed = moving.map((item, i) => ({
      ...item,
      x: 60 + (i % 4) * 240,
      y: 60 + Math.floor(i / 4) * 170,
      z: ++z,
    }));
    // A moved board node re-parents its child board to the destination.
    const reparent = new Set(
      moving.filter((item) => item.type === 'board' && item.boardId).map((item) => item.boardId as string),
    );

    return list.map((board) => {
      if (board.id === fromId) {
        return { ...board, updatedAt: Date.now(), items: board.items.filter((item) => !wanted.has(item.id)) };
      }
      if (board.id === toId) {
        return { ...board, updatedAt: Date.now(), items: [...board.items, ...placed] };
      }
      if (reparent.has(board.id)) return { ...board, parentId: toId };
      return board;
    });
  });
  scheduleSave();
}

export { makeMoodItem };
