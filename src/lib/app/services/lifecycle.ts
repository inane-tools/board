import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './platform';
import { flushLibrary } from './library';
/** Native close, Alt+F4 and custom close all wait for the last edit to reach disk. */
export async function protectUnsavedChanges(): Promise<() => void> {
  if (!isTauri()) return () => {};
  const win = getCurrentWindow();
  let closing = false;
  return win.onCloseRequested(async (event) => {
    event.preventDefault();
    if (closing) return;
    closing = true;
    try { await flushLibrary(); await win.destroy(); }
    catch { closing = false; }
  });
}
