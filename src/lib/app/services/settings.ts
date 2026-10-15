import { writable } from 'svelte/store';
import type { AppSettings } from '$lib/infra/storage/settingsRepo';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '$lib/infra/storage/settingsRepo';

export const settingsStore = writable<AppSettings>({ ...DEFAULT_SETTINGS });

export async function restoreSettings(): Promise<AppSettings> {
  const s = await loadSettings();
  settingsStore.set(s);
  return s;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const next = await saveSettings(patch);
  settingsStore.set(next);
}
