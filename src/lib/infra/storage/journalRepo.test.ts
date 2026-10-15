import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLibrary, saveLibrary } from './journalRepo';
import { makeBoard } from '$lib/core/board';
describe('library persistence', () => {
  beforeEach(() => localStorage.clear());
  it('keeps corrupt data intact and refuses to open it as an empty library', async () => {
    localStorage.setItem('journal.library.v3', '{broken');
    await expect(loadLibrary()).rejects.toThrow();
    expect(localStorage.getItem('journal.library.v3')).toBe('{broken');
  });
  it('reports quota errors instead of pretending a save succeeded', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(saveLibrary({ boards: [] })).rejects.toThrow('quota');
  });
  it('round trips a library using its existing storage key', async () => {
    const library = { boards: [makeBoard('canvas', null, 'Home')] };
    await saveLibrary(library); expect(await loadLibrary()).toEqual(library);
  });
  it('refuses cyclic trees without replacing the saved file', async () => {
    const a = makeBoard('canvas', 'b'); a.id = 'a';
    const b = makeBoard('canvas', 'a'); b.id = 'b';
    const raw = JSON.stringify({ boards: [a, b] });
    localStorage.setItem('journal.library.v3', raw);
    await expect(loadLibrary()).rejects.toThrow('tree');
    expect(localStorage.getItem('journal.library.v3')).toBe(raw);
  });
});
