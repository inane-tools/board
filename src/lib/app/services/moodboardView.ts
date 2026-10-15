// Lets the app title bar trigger a "reset view" on the moodboard canvas
// without owning its pan state. The canvas publishes a callback while mounted.

import { writable } from 'svelte/store';

export const resetMoodboardView = writable<() => void>(() => {});
