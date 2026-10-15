// Keep the original storage keys so existing Board libraries remain available.
import { Store } from '@tauri-apps/plugin-store';
import { isTauri } from '$lib/app/services/platform';
import type { Library } from '$lib/core/board';
const STORE_PATH = 'journal-library-v3.json';
const STORE_KEY = 'library';
const LS_KEY = 'journal.library.v3';
let store: Promise<Store> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
function getStore(): Promise<Store> {
  return store ??= Store.load(STORE_PATH, { autoSave: false }).catch((error) => { store = null; throw error; });
}
/** Reject damaged documents instead of replacing them with an empty library. */
function decode(raw: unknown): Library {
  if (raw == null) return { boards: [] };
  if (typeof raw !== 'object' || !Array.isArray((raw as Library).boards)) throw new Error('The saved library is damaged. Its original file has been preserved.');
  const library = raw as Library;
  if (library.tagDefinitions !== undefined && (!Array.isArray(library.tagDefinitions) || library.tagDefinitions.some(tag => !tag || typeof tag.name !== 'string' || typeof tag.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(tag.color)))) throw new Error('The saved tag definitions are damaged. The original file has been preserved.');
  const ids = new Set<string>();
  for (const board of library.boards) {
    if (!board || typeof board.id !== 'string' || !board.id || ids.has(board.id) ||
      (board.parentId !== null && typeof board.parentId !== 'string') ||
      !['canvas', 'document'].includes(board.kind) || typeof board.title !== 'string' ||
      !Array.isArray(board.items) || !Array.isArray(board.blocks) ||
      board.blocks.some((block) => !block || typeof block.id !== 'string' || typeof block.text !== 'string') ||
      board.items.some((item) => !item || typeof item.id !== 'string' || typeof item.type !== 'string')) {
      throw new Error('The saved library is damaged. Its original file has been preserved.');
    }
    ids.add(board.id);
  }
  const byId = new Map(library.boards.map((board) => [board.id, board]));
  for (const board of library.boards) {
    const seen = new Set<string>([board.id]);
    let parent = board.parentId;
    while (parent !== null) {
      if (seen.has(parent) || !byId.has(parent)) throw new Error('The saved board tree is damaged. Its original file has been preserved.');
      seen.add(parent); parent = byId.get(parent)!.parentId;
    }
  }
  if (library.boards.length && library.boards.filter((board) => board.parentId === null).length !== 1) throw new Error('The saved library must have one Home board. Its original file has been preserved.');
  return library;
}
export async function loadLibrary(): Promise<Library> {
  if (isTauri()) return decode(await (await getStore()).get(STORE_KEY));
  const raw = localStorage.getItem(LS_KEY);
  return decode(raw === null ? null : JSON.parse(raw));
}
export async function saveLibrary(library: Library): Promise<void> {
  const serialized = JSON.stringify(library);
  // Browser writes are synchronous, including during beforeunload.
  if (!isTauri()) { localStorage.setItem(LS_KEY, serialized); return; }
  const task = writeChain.then(async () => {
    const s = await getStore();
    await s.set(STORE_KEY, JSON.parse(serialized));
    await s.save();
  });
  writeChain = task.catch(() => undefined);
  return task;
}
export function resetLibraryStore(): void { store = null; writeChain = Promise.resolve(); }
