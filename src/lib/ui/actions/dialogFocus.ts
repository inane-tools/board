/** Trap keyboard focus inside the active dialog and restore it on dismissal. */
export function dialogFocus(node: HTMLElement, close: () => void) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const topmost = () => [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].sort((a, b) => {
    const layer = (el: HTMLElement) => { let z = 0; for (let current: HTMLElement | null = el; current; current = current.parentElement) z = Math.max(z, Number.parseInt(getComputedStyle(current).zIndex) || 0); return z; };
    return layer(a) - layer(b);
  }).at(-1) === node;
  const focusables = () => [...node.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
  queueMicrotask(() => { if (node.isConnected) (focusables()[0] ?? node).focus(); });
  function key(event: KeyboardEvent) {
    if (!topmost()) return;
    if (event.key === 'Escape' && document.querySelector('[role="listbox"]')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    // Portalled dropdowns manage their own keyboard focus.
    if (document.activeElement?.closest('[role="listbox"], [role="menu"]')) return;
    const elements = focusables(); const index = elements.indexOf(document.activeElement as HTMLElement);
    if (!elements.length) { event.preventDefault(); node.focus(); }
    else if (event.shiftKey && index <= 0) { event.preventDefault(); elements.at(-1)!.focus(); }
    else if (!event.shiftKey && (index === elements.length - 1 || index < 0)) { event.preventDefault(); elements[0].focus(); }
  }
  window.addEventListener('keydown', key, true);
  return { destroy() { window.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); } };
}
