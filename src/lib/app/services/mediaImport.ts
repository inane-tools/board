import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from './platform';
import { mediaUrl } from '$lib/core/mediaUrl';
import { storeFile } from './assets';
export async function importMediaUrl(url: string): Promise<{ url: string; path?: string; mime: string; size: number }> {
  const media = mediaUrl(url); if (!media) throw new Error('Not a direct media URL');
  if (isTauri()) {
    const result = await invoke<{ path: string; mime: string; size: number }>('import_media_url', { url });
    return { ...result, url: convertFileSrc(result.path) };
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/')) throw new Error('Not a media response');
  if (blob.size > 250 * 1024 * 1024) throw new Error('Media download exceeds 250 MB');
  const file = new File([blob], media.name, { type: blob.type });
  return { ...await storeFile(file), mime: blob.type, size: blob.size };
}
