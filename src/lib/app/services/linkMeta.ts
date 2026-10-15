// Link previews (OpenGraph / oEmbed metadata).
//
// Pages cannot be fetched from the webview (CORS), so the desktop build asks
// Rust to fetch and parse the HTML. The browser build returns null.

import { isTauri } from './platform';

export interface LinkMeta {
  title?: string;
  description?: string;
  image?: string;
  site?: string;
}

export async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  if (!isTauri() || !url) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const meta = await invoke<LinkMeta>('fetch_link_meta', { url });
    return meta && (meta.title || meta.image || meta.description) ? meta : null;
  } catch (error) {
    console.warn('[journal] could not fetch link preview:', error);
    return null;
  }
}
