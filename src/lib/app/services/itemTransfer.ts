import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';
import type { Board, MoodItem } from '$lib/core/board';
import { descendantIds } from '$lib/core/board';
import { itemText, exportName } from '$lib/core/itemTransfer';
import logoUrl from '$lib/assets/logo.png';
function toBase64(bytes: Uint8Array): string {
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function exportData(item: MoodItem, boards: Board[]): Promise<string> {
  if (['image','video','audio','file'].includes(item.type) && item.url) {
    const response = await fetch(item.url); if (!response.ok) throw new Error('The original media could not be read.');
    return toBase64(new Uint8Array(await response.arrayBuffer()));
  }
  let text = itemText(item, boards);
  if (item.type === 'link') text = '[InternetShortcut]\r\nURL=' + text + '\r\n';
  if (item.type === 'board' && item.boardId) {
    const ids = new Set([item.boardId, ...descendantIds(boards, item.boardId)]);
    text = JSON.stringify({ boards: boards.filter(board => ids.has(board.id)) }, null, 2);
  }
  return toBase64(new TextEncoder().encode(text));
}
export async function exportFiles(items: MoodItem[], boards: Board[]): Promise<string[]> {
  if (!isTauri()) throw new Error('File export requires the desktop app.');
  return Promise.all(items.map(async item => invoke<string>('prepare_export', {
    name: exportName(item), path: item.path ?? null, data: item.path ? null : await exportData(item, boards),
  })));
}
export async function copyItems(items: MoodItem[], boards: Board[]): Promise<void> {
  if (!items.length) return;
  if (isTauri()) {
    if (items.some(item => !!item.path || ['image','video','audio','file'].includes(item.type))) {
      await invoke('copy_export_files', { paths: await exportFiles(items, boards) }); return;
    }
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(items.map(item => itemText(item, boards)).join('\n\n')); return;
  }
  await navigator.clipboard.writeText(items.map(item => itemText(item, boards)).join('\n\n'));
}
export async function copyImage(item: MoodItem): Promise<void> {
  if (!item.url) return;
  const response = await fetch(item.url); if (!response.ok) throw new Error('Image could not be read.');
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
  if (isTauri()) {
    const { Image } = await import('@tauri-apps/api/image');
    const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
    const image = await Image.new(new Uint8Array(canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data), canvas.width, canvas.height);
    try { await writeImage(image); } finally { await image.close(); }
  } else {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }
}
let iconPath: Promise<string> | undefined;
export async function dragItems(items: MoodItem[], boards: Board[]): Promise<void> {
  const paths = await exportFiles(items, boards);
  iconPath ??= (async () => {
    const bytes = new Uint8Array(await (await fetch(logoUrl)).arrayBuffer());
    return invoke<string>('prepare_export', { name: 'Board.png', path: null, data: toBase64(bytes) });
  })().catch(error => { iconPath = undefined; throw error; });
  const { startDrag } = await import('@crabnebula/tauri-plugin-drag');
  await startDrag({ item: paths, icon: await iconPath, mode: 'copy' });
}
