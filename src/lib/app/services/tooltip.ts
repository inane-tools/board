// A single floating tooltip, driven by hover on sidebar/toolbar controls.

import { writable } from 'svelte/store';

export interface TipState {
  show: boolean;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  placement: 'right' | 'top';
}

const CLOSED: TipState = { show: false, x: 0, y: 0, title: '', subtitle: '', placement: 'right' };

export const tipStore = writable<TipState>(CLOSED);

export function showTip(
  anchor: HTMLElement,
  title: string,
  subtitle = '',
  placement: 'right' | 'top' = 'right',
): void {
  const rect = anchor.getBoundingClientRect();
  const x = placement === 'top' ? rect.left + rect.width / 2 : rect.right + 8;
  const y = placement === 'top' ? rect.top - 8 : rect.top + rect.height / 2;
  tipStore.set({ show: true, x, y, title, subtitle, placement });
}

export function hideTip(): void {
  tipStore.update((tip) => (tip.show ? { ...tip, show: false } : tip));
}
