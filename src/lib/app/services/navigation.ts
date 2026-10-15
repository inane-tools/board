import { get, writable } from 'svelte/store';

/**
 * A navigable page. `home` is the root board; `board` is any board (canvas or
 * document) by id, so Back restores exactly what the user was looking at.
 */
export type Page = { view: 'home' } | { view: 'board'; id: string };

export const pageStore = writable<Page>({ view: 'home' });
export const canGoBack = writable(false);
export const canGoForward = writable(false);

const MAX_HISTORY = 64;
let history: Page[] = [];
let future: Page[] = [];

function syncHistoryFlags(): void {
  canGoBack.set(history.length > 0);
  canGoForward.set(future.length > 0);
}

function pageKey(page: Page): string {
  return page.view === 'board' ? `board:${page.id}` : 'home';
}

export function openPage(page: Page): void {
  const current = get(pageStore);
  if (pageKey(page) === pageKey(current)) {
    pageStore.set(page);
    future = [];
    syncHistoryFlags();
    return;
  }
  history = [...history, current].slice(-MAX_HISTORY);
  future = [];
  pageStore.set(page);
  syncHistoryFlags();
}

export function goHome(): void {
  openPage({ view: 'home' });
}

export function openBoard(id: string): void {
  openPage({ view: 'board', id });
}

export function back(): void {
  const previous = history.pop();
  if (!previous) return;
  future = [get(pageStore), ...future].slice(0, MAX_HISTORY);
  pageStore.set(previous);
  syncHistoryFlags();
}

export function forward(): void {
  const next = future.shift();
  if (!next) return;
  history = [...history, get(pageStore)].slice(-MAX_HISTORY);
  pageStore.set(next);
  syncHistoryFlags();
}

/** A deleted board must not reappear through Back/Forward. */
export function forgetBoard(id: string): void {
  const keep = (page: Page) => !(page.view === 'board' && page.id === id);
  history = history.filter(keep);
  future = future.filter(keep);
  if (!keep(get(pageStore))) pageStore.set({ view: 'home' });
  syncHistoryFlags();
}

/**
 * Wire the mouse's Back/Forward (X1/X2) buttons to app navigation.
 * Returns a cleanup function.
 */
export function startMouseNavigation(): () => void {
  const onPress = (event: MouseEvent) => {
    if (event.button === 3) {
      event.preventDefault();
      back();
    } else if (event.button === 4) {
      event.preventDefault();
      forward();
    }
  };
  window.addEventListener('mouseup', onPress);
  return () => window.removeEventListener('mouseup', onPress);
}
