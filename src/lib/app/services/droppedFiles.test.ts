import { expect, it } from 'vitest';
import { readDroppedFiles } from './droppedFiles';
const fileEntry = (name: string, fail = false) => ({ name, fullPath: '/' + name, isFile: true, isDirectory: false, file: (ok: (file: File) => void, bad: () => void) => fail ? bad() : ok(new File(['content'], name)) }) as unknown as FileSystemEntry;
const directory = (name: string, batches: FileSystemEntry[][]) => ({ name, fullPath: '/' + name, isFile: false, isDirectory: true, createReader: () => { let index = 0; return { readEntries: (ok: (entries: FileSystemEntry[]) => void) => ok(batches[index++] ?? []) }; } }) as unknown as FileSystemEntry;
const drop = (entries: FileSystemEntry[]) => ({ items: entries.map(entry => ({ kind: 'file', webkitGetAsEntry: () => entry })), files: [] }) as unknown as DataTransfer;
it('imports nested folders and all batches rather than stopping at the first batch', async () => {
  const root = directory('folder', [[fileEntry('one.png')], [directory('nested', [[fileEntry('two.gif')]]), fileEntry('three.mp4')], []]);
  const result = await readDroppedFiles(drop([root]));
  expect(result.files.map(file => file.name)).toEqual(['one.png', 'two.gif', 'three.mp4']); expect(result.errors).toEqual([]);
});
it('continues when individual files cannot be read', async () => {
  const result = await readDroppedFiles(drop([directory('folder', [[fileEntry('bad', true), fileEntry('good.txt')]])]));
  expect(result.files.map(file => file.name)).toEqual(['good.txt']); expect(result.errors).toEqual(['/bad']);
});
it('handles empty directories and non-directory file fallback', async () => {
  expect((await readDroppedFiles(drop([directory('empty', [])]))).files).toEqual([]);
  const file = new File(['hello'], 'note.txt');
  const result = await readDroppedFiles({ items: [], files: [file] } as unknown as DataTransfer);
  expect(result.files).toEqual([file]);
});
