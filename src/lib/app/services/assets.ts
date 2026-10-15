// Store dropped/pasted files.
//
// On the desktop the bytes are written to the app data `assets/` directory
// (Rust `save_asset`) and referenced through the asset protocol, so large
// media never lands in the library JSON. In a plain browser there is no disk
// access, so we fall back to a data URL.

import { isTauri } from './platform';

export interface StoredFile {
  url: string;
  path?: string;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function base64Of(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : '';
}

export async function storeFile(file: File): Promise<StoredFile> {
  const dataUrl = await fileToDataUrl(file);
  if (isTauri()) {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('save_asset', { name: file.name || 'file', data: base64Of(dataUrl) });
    return { url: convertFileSrc(path), path };
  }
  return { url: dataUrl };
}

/** Open a stored file with the OS default app (desktop) or a new tab. */
export async function openStoredFile(item: { path?: string; url?: string }): Promise<void> {
  if (item.path && isTauri()) {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(item.path);
      return;
    } catch (error) {
      console.warn('[journal] could not open file:', error);
    }
  }
  if (item.url) window.open(item.url, '_blank', 'noopener');
}

/** A readable file size. */
export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Open the OS picker for any number of files. */
export function pickFiles(accept = ''): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files ? Array.from(input.files) : []);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Delete every stored asset that is no longer referenced by a board item.
 * Files copied in but then removed from a board (or whose board was deleted)
 * would otherwise linger in `assets/` forever.
 */
export async function pruneUnusedAssets(usedPaths: Iterable<string>): Promise<number> {
  if (!isTauri()) return 0;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const files = await invoke<string[]>('list_assets');
    const used = new Set(usedPaths);
    let removed = 0;
    for (const file of files) {
      if (used.has(file)) continue;
      try {
        await invoke('delete_asset', { path: file });
        removed += 1;
      } catch {
        /* locked or already gone */
      }
    }
    return removed;
  } catch (error) {
    console.warn('[journal] could not prune assets:', error);
    return 0;
  }
}
