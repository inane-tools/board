// Appearance: theme (system/light/dark) and accent, applied from settings.
//
// The whole UI is styled with Tailwind colour utilities that resolve to
// `var(--color-*)`, so switching theme is just a class on <html> plus overrides
// of those tokens — see the `html.light` block in `app.css`. This module is the
// single place that reads the appearance settings and pushes them to the DOM.

import { get } from 'svelte/store';
import type { AppSettings } from '$lib/infra/storage/settingsRepo';
import { settingsStore } from './settings';
import { applyCustomAccent, setLightMode, setTinted } from './theme';

const media =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function effectiveTheme(settings: AppSettings): 'light' | 'dark' {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return media?.matches ? 'dark' : 'light';
}

function applyThemeClass(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Only touch the DOM when something actually changed: the settings store also
// emits for zoom and the sidebar width.
let lastTheme: 'light' | 'dark' | null = null;
let lastColour: string | null = null;
let lastTinted: boolean | null = null;

function apply(settings: AppSettings): void {
  if (typeof document === 'undefined') return;

  const theme = effectiveTheme(settings);
  if (theme !== lastTheme) {
    applyThemeClass(theme);
    // Accents are lightened in light mode (theme.ts), so it needs to know.
    setLightMode(theme === 'light');
    lastTheme = theme;
  }

  if (settings.tintedBackground !== lastTinted) {
    setTinted(settings.tintedBackground);
    lastTinted = settings.tintedBackground;
  }

  if (settings.accentColor !== lastColour) {
    applyCustomAccent(settings.accentColor);
    lastColour = settings.accentColor;
  }
}

let started = false;
/** Begin applying appearance settings. Safe to call once at startup. */
export function startAppearance(): void {
  if (started) return;
  started = true;
  settingsStore.subscribe(apply);
  media?.addEventListener('change', () => apply(get(settingsStore)));
}
