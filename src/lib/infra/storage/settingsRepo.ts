// Settings persistence: tauri-plugin-store on desktop, localStorage in browser.
//
// Nothing sensitive lives here anymore — the app has no accounts or network
// sessions — so the settings file is a plain JSON document.

import { Store } from '@tauri-apps/plugin-store';
import { isTauri } from '$lib/app/services/platform';

export type EditorFont = 'sans' | 'serif' | 'mono';

export interface AppSettings {
  /** Appearance: follow the OS, or force light/dark. */
  theme: 'system' | 'light' | 'dark';
  /** Accent colour (hex). */
  accentColor: string;
  /** Tint the neutral surfaces with the accent (Material-You style). */
  tintedBackground: boolean;
  /** UI zoom level applied to the whole window (1 = 100%). */
  uiZoom: number;
  /** Show native window caption buttons. */
  windowControls: boolean;
  /** Font used inside the journal editor. */
  editorFont: EditorFont;
  /** Where the board's floating toolbar sits (or off). */
  boardToolbar: 'bottom' | 'top' | 'left' | 'right' | 'off';
  /** Reveal the Developer section's DevTools access (off by default). */
  devToolsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentColor: '#ff4d5e',
  tintedBackground: false,
  uiZoom: 1,
  windowControls: true,
  editorFont: 'sans',
  boardToolbar: 'bottom',
  devToolsEnabled: false,
};

const STORE_PATH = 'journal-settings.json';
const STORE_KEY = 'settings';
const LS_KEY = 'journal.settings.v1';

let store: Store | null = null;
let cached: AppSettings | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function getStore(): Promise<Store | null> {
  if (!isTauri()) return null;
  if (!store) store = await Store.load(STORE_PATH);
  return store;
}

export async function loadSettings(): Promise<AppSettings> {
  let loaded: AppSettings | null = null;
  try {
    const s = await getStore();
    if (s) {
      const raw = (await s.get<Partial<AppSettings>>(STORE_KEY)) ?? {};
      loaded = { ...DEFAULT_SETTINGS, ...raw };
    }
  } catch {
    /* fall through to localStorage */
  }
  if (!loaded) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) loaded = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      /* ignore */
    }
  }
  const result = loaded ?? { ...DEFAULT_SETTINGS };
  cached = result;
  return result;
}

export function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const task = writeChain.then(async () => {
    const current = cached ?? (await loadSettings());
    const next = { ...current, ...patch };
    cached = next;
    try {
      const s = await getStore();
      if (s) {
        await s.set(STORE_KEY, next);
        await s.save();
        return next;
      }
    } catch {
      /* fall through */
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  });
  writeChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

/** Test hook: forget the in-memory copy so the next call re-reads storage. */
export function resetSettingsCache(): void {
  cached = null;
  store = null;
}
