// Open a URL in the user's default browser.
//
// On desktop this goes through the Tauri opener plugin; in a plain browser it
// falls back to a new tab.

import { isTauri } from './platform';

export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, '_blank', 'noopener');
}
