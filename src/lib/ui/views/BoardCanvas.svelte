<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Board, MoodItem, MoodItemType } from '$lib/core/board';
  import { boardPreview, domainOf, embedUrl, ITEM_TYPE_LABEL, itemLabel, itemSnippet, makeMoodItem, normalizeUrl } from '$lib/core/board';
  import {
    addMoodItem,
    boardsStore,
    bringMoodItemToFront,
    bringMoodItemsToFront,
    createBoard,
    deleteBoard,
    moveMoodItems,
    removeMoodItem,
    removeMoodItems,
    updateMoodItem,
    updateMoodItems,
  } from '$lib/app/services/library';
  import { goHome, openBoard } from '$lib/app/services/navigation';
  import { boardMenu } from '$lib/app/services/menus';
  import { notify, openContextMenu, openContextMenuAt } from '$lib/app/services/contextMenu';
  import { showPrompt } from '$lib/app/services/dialogs';
  import { pickFiles, formatSize, openStoredFile, storeFile } from '$lib/app/services/assets';
  import { pickImageFile } from '$lib/app/services/images';
  import { openExternal } from '$lib/app/services/openExternal';
  import { fetchLinkMeta } from '$lib/app/services/linkMeta';
  import { resetMoodboardView } from '$lib/app/services/moodboardView';
  import { boardItemsOpen, closeBoardItems } from '$lib/app/services/boardPanel';
  import { settingsStore } from '$lib/app/services/settings';
  import { hideTip, showTip } from '$lib/app/services/tooltip';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';

  export let id: string;

  const NOTE_COLORS = ['#26262b', '#3a2b3f', '#2b3a45', '#3f2b2b', '#2b3f2f', '#3f3a2b'];

  const TYPE_ICON: Record<MoodItemType, string> = {
    note: 'bx-note',
    todo: 'bx-check-square',
    image: 'bx-image',
    video: 'bx-video',
    audio: 'bx-music',
    file: 'bx-file',
    text: 'bx-file-blank',
    link: 'bx-link',
    color: 'bx-palette',
    board: 'bx-layout',
  };

  $: board = $boardsStore.find((b) => b.id === id) as Board | undefined;
  $: items = board?.items ?? [];
  // Stable render order + a rank-based z-index (1..n) so raising an item only
  // changes its stacking, never the DOM order (which would drop text focus).
  $: zRank = (() => {
    const map = new Map<string, number>();
    [...items]
      .sort((a, b) => a.z - b.z)
      .forEach((it, i) => map.set(it.id, i + 1));
    return map;
  })();

  // ── Floating toolbar placement ───────────────────────────────────
  $: toolbarPos = $settingsStore.boardToolbar;
  $: toolbarVertical = toolbarPos === 'left' || toolbarPos === 'right';
  $: toolbarWrapper =
    toolbarPos === 'top'
      ? 'absolute inset-x-0 top-16 z-40 flex justify-center px-4'
      : toolbarPos === 'left'
        ? 'absolute left-4 top-1/2 z-40 -translate-y-1/2'
        : toolbarPos === 'right'
          ? 'absolute right-4 top-1/2 z-40 -translate-y-1/2'
          : 'absolute inset-x-0 bottom-4 z-40 flex justify-center px-4';
  $: toolbarPill = `flex items-center justify-center gap-1 rounded-full bg-[var(--color-elevated)] shadow-[0_12px_34px_rgba(0,0,0,0.5)] ${
    toolbarVertical ? 'flex-col px-1 py-1.5' : 'max-w-full flex-wrap p-1.5'
  }`;
  $: toolbarSep = toolbarVertical ? 'my-0.5 h-px w-6 bg-white/10' : 'h-6 w-px bg-white/10';

  let viewportEl: HTMLDivElement | undefined;
  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let pointer: { x: number; y: number } | null = null;

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;

  function clampZoom(value: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }

  // ── Selection ────────────────────────────────────────────────────
  let selected: Set<string> = new Set();
  let marquee: { x0: number; y0: number; x1: number; y1: number } | null = null;
  $: marqueeRect = marquee
    ? {
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : null;

  $: if (selected.size) {
    const alive = new Set(items.map((it) => it.id));
    const kept = [...selected].filter((sid) => alive.has(sid));
    if (kept.length !== selected.size) selected = new Set(kept);
  }

  let clipboard: MoodItem[] = [];

  // Iframe embeds swallow wheel/pointer events, so an inactive embed sits under
  // a scrim (panning/dragging still work); double-click activates it.
  let activeEmbeds: Set<string> = new Set();
  function activateEmbed(itemId: string): void {
    activeEmbeds = new Set([...activeEmbeds, itemId]);
  }

  function isModifier(event: MouseEvent | PointerEvent | KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey;
  }

  function toggleSelect(itemId: string): void {
    const next = new Set(selected);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    selected = next;
  }

  function selectOnly(itemId: string): void {
    selected = new Set([itemId]);
  }

  function clearSelection(): void {
    if (selected.size) selected = new Set();
  }

  function onItemPointerDown(event: PointerEvent, item: MoodItem): void {
    event.stopPropagation();
    if (isModifier(event)) {
      event.preventDefault();
      toggleSelect(item.id);
      return;
    }
    if (!selected.has(item.id)) selectOnly(item.id);
    if (board) {
      if (selected.size > 1) bringMoodItemsToFront(board.id, [...selected]);
      else bringMoodItemToFront(board.id, item.id);
    }
    // With several items selected, dragging anywhere on one moves the whole set.
    if (selected.size > 1) startDrag(event, item, 'move');
  }

  $: if (board) {
    resetMoodboardView.set(() => {
      pan = { x: 0, y: 0 };
      zoom = 1;
    });
  }
  onDestroy(() => {
    resetMoodboardView.set(() => {});
    closeBoardItems();
  });

  function toWorld(clientX: number, clientY: number): { x: number; y: number } {
    if (!viewportEl) return { x: clientX, y: clientY };
    const rect = viewportEl.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }

  function pointerWorld(): { x: number; y: number } | null {
    if (!viewportEl || !pointer) return null;
    const rect = viewportEl.getBoundingClientRect();
    if (pointer.x < rect.left || pointer.x > rect.right || pointer.y < rect.top || pointer.y > rect.bottom) {
      return null;
    }
    return toWorld(pointer.x, pointer.y);
  }

  function centerWorld(): { x: number; y: number } {
    const rect = viewportEl?.getBoundingClientRect();
    if (!rect) return { x: 120, y: 120 };
    return toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = { x: event.clientX, y: event.clientY };
  }
  function onPointerOut(event: MouseEvent): void {
    if (!event.relatedTarget) pointer = null;
  }

  function setZoom(value: number, cx: number, cy: number): void {
    const next = clampZoom(value);
    const world = { x: (cx - pan.x) / zoom, y: (cy - pan.y) / zoom };
    zoom = next;
    pan = { x: cx - world.x * next, y: cy - world.y * next };
  }
  function zoomBy(factor: number): void {
    const rect = viewportEl?.getBoundingClientRect();
    setZoom(zoom * factor, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  }
  function zoomReset(): void {
    zoom = 1;
    pan = { x: 0, y: 0 };
  }

  // ── Panning / marquee ────────────────────────────────────────────
  let panning: { startX: number; startY: number; panX: number; panY: number } | null = null;

  function onViewportPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !viewportEl) return;
    if (isModifier(event)) {
      const world = toWorld(event.clientX, event.clientY);
      marquee = { x0: world.x, y0: world.y, x1: world.x, y1: world.y };
      window.addEventListener('pointermove', onMarqueeMove);
      window.addEventListener('pointerup', endMarquee);
      return;
    }
    clearSelection();
    activeEmbeds = new Set();
    closeBoardItems();
    panning = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    window.addEventListener('pointermove', onPanMove);
    window.addEventListener('pointerup', endPan);
  }
  function onPanMove(event: PointerEvent): void {
    if (!panning) return;
    pan = { x: panning.panX + (event.clientX - panning.startX), y: panning.panY + (event.clientY - panning.startY) };
  }
  function endPan(): void {
    panning = null;
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', endPan);
  }

  function onMarqueeMove(event: PointerEvent): void {
    if (!marquee) return;
    const world = toWorld(event.clientX, event.clientY);
    marquee = { ...marquee, x1: world.x, y1: world.y };
  }
  function endMarquee(): void {
    window.removeEventListener('pointermove', onMarqueeMove);
    window.removeEventListener('pointerup', endMarquee);
    const rect = marqueeRect;
    marquee = null;
    if (!rect || rect.width < 3 || rect.height < 3) return;
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const hits = items.filter(
      (item) => item.x < right && item.x + item.width > rect.left && item.y < bottom && item.y + item.height > rect.top,
    );
    selected = new Set(hits.map((item) => item.id));
  }

  function onWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (!viewportEl) return;
      const rect = viewportEl.getBoundingClientRect();
      setZoom(zoom * Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) return;
    pan = { x: pan.x - event.deltaX, y: pan.y - event.deltaY };
  }

  function isTyping(): boolean {
    const el = document.activeElement;
    return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || (el as HTMLElement).isContentEditable);
  }

  function deleteSelected(): void {
    if (!board || selected.size === 0) return;
    const boardIds: string[] = [];
    const itemIds: string[] = [];
    for (const sid of selected) {
      const it = items.find((i) => i.id === sid);
      if (it?.type === 'board' && it.boardId) boardIds.push(it.boardId);
      else itemIds.push(sid);
    }
    for (const bid of boardIds) deleteBoard(bid);
    if (itemIds.length) removeMoodItems(board.id, itemIds);
    selected = new Set();
  }

  function copySelection(): void {
    if (selected.size === 0) return;
    clipboard = items.filter((it) => selected.has(it.id)).map((it) => ({ ...it }));
    void navigator.clipboard.writeText('board-items:' + JSON.stringify(clipboard)).catch(() => notify('Clipboard access was denied. Use Paste from the board menu.'));
  }

  function pasteItems(source: MoodItem[], at?: { x: number; y: number }): void {
    if (!board || source.length === 0) return;
    const ids: string[] = [];
    source.forEach((clip, i) => {
      const rest: Partial<MoodItem> = { ...clip };
      delete rest.id;
      delete rest.type;
      // With a cursor anchor, centre the item on it; otherwise offset from the
      // original (duplicate).
      const x = at ? at.x - clip.width / 2 + i * 24 : clip.x + 24 + i * 24;
      const y = at ? at.y - clip.height / 2 + i * 24 : clip.y + 24 + i * 24;
      const copy = makeMoodItem(clip.type, {
        ...rest,
        x: Math.round(x),
        y: Math.round(y),
      });
      addMoodItem(board.id, copy);
      ids.push(copy.id);
    });
    selected = new Set(ids);
  }

  function onWindowKey(event: KeyboardEvent): void {
    if (document.querySelector('[aria-modal="true"]')) return;
    const mod = isModifier(event);
    if (mod && !isTyping()) {
      const key = event.key.toLowerCase();
      if (key === 'c' && selected.size) {
        event.preventDefault();
        copySelection();
        return;
      }
      if (key === 'x' && selected.size) {
        event.preventDefault();
        copySelection();
        deleteSelected();
        return;
      }
      if (key === 'd' && selected.size) {
        event.preventDefault();
        pasteItems(items.filter((it) => selected.has(it.id)));
        return;
      }
    }
    if (isTyping()) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size > 0) {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === 'Escape') {
      clearSelection();
      closeBoardItems();
    }
  }

  // ── Item dragging / resizing ─────────────────────────────────────
  type Drag = {
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: MoodItem;
    origins: { id: string; x: number; y: number }[];
  };
  let drag: Drag | null = null;

  function onDragMove(event: PointerEvent): void {
    pointer = { x: event.clientX, y: event.clientY };
    if (!drag || !board) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.mode === 'move') {
      const patches: Record<string, Partial<MoodItem>> = {};
      for (const origin of drag.origins) {
        patches[origin.id] = { x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) };
      }
      updateMoodItems(board.id, patches);
    } else {
      updateMoodItem(board.id, drag.origin.id, {
        width: Math.max(120, Math.round(drag.origin.width + dx)),
        height: Math.max(72, Math.round(drag.origin.height + dy)),
      });
    }
  }

  function endDrag(): void {
    drag = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
  }

  function startDrag(event: PointerEvent, item: MoodItem, mode: 'move' | 'resize'): void {
    if (event.button !== 0 || !board) return;
    event.preventDefault();
    event.stopPropagation();
    let origins = [{ id: item.id, x: item.x, y: item.y }];
    if (mode === 'move') {
      origins = items.filter((it) => selected.has(it.id)).map((it) => ({ id: it.id, x: it.x, y: it.y }));
      if (origins.length === 0) origins = [{ id: item.id, x: item.x, y: item.y }];
    }
    drag = { mode, startX: event.clientX, startY: event.clientY, origin: item, origins };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
  }

  function beginDrag(event: PointerEvent, item: MoodItem, mode: 'move' | 'resize'): void {
    if (event.button !== 0 || !board) return;
    if (isModifier(event)) return;
    if (mode === 'move') {
      if (!selected.has(item.id)) selectOnly(item.id);
      if (selected.size > 1) bringMoodItemsToFront(board.id, [...selected]);
      else bringMoodItemToFront(board.id, item.id);
    }
    startDrag(event, item, mode);
  }

  // ── Add items ────────────────────────────────────────────────────
  // `at` is the world position for the item's top-left corner. Omitted for the
  // bottom bar, which drops the item in the centre on top of everything else.
  function spawn(type: MoodItemType, patch: Partial<MoodItem> = {}, at?: { x: number; y: number }): void {
    if (!board) return;
    const world = at ?? centerWorld();
    addMoodItem(board.id, makeMoodItem(type, { x: Math.round(world.x), y: Math.round(world.y), ...patch }));
  }

  function addNote(at?: { x: number; y: number }): void {
    spawn('note', { text: '' }, at);
  }
  function addTodo(at?: { x: number; y: number }): void {
    spawn('todo', { text: '' }, at);
  }
  function addLink(at?: { x: number; y: number }): void {
    showPrompt({ title: 'Add link', label: 'URL', placeholder: 'https://…' }, (raw) => {
      const world = at ?? centerWorld();
      addLinkItem(raw, world.x, world.y);
    });
  }
  function addColor(at?: { x: number; y: number }): void {
    spawn('color', { color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] }, at);
  }
  /** Natural size of an image, scaled to fit a maximum side. */
  function fitImage(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 280;
        const nw = img.naturalWidth || max;
        const nh = img.naturalHeight || max;
        const scale = Math.min(1, max / Math.max(nw, nh));
        resolve({ width: Math.max(80, Math.round(nw * scale)), height: Math.max(60, Math.round(nh * scale)) });
      };
      img.onerror = () => resolve({ width: 220, height: 220 });
      img.src = url;
    });
  }

  async function addImage(at?: { x: number; y: number }): Promise<void> {
    const url = await pickImageFile();
    if (!url) return;
    const size = await fitImage(url);
    spawn('image', { url, ...size }, at);
  }
  async function addFiles(at?: { x: number; y: number }): Promise<void> {
    const files = await pickFiles();
    if (files.length) await handleFiles(files, at ?? centerWorld());
  }
  function addChild(kind: 'canvas' | 'document'): void {
    if (board) createBoard(kind, board.id);
  }

  function addLinkItem(rawUrl: string, x: number, y: number): void {
    if (!board) return;
    const url = normalizeUrl(rawUrl);
    if (!url) {
      notify('That does not look like a valid link.');
      return;
    }
    const boardId = board.id;
    const item = makeMoodItem('link', { url, text: url, x: Math.round(x), y: Math.round(y) });
    addMoodItem(boardId, item);
    void enrichLink(boardId, item.id, url);
  }

  async function enrichLink(boardId: string, itemId: string, url: string): Promise<void> {
    if (embedUrl(url)) return;
    const meta = await fetchLinkMeta(url);
    if (!meta) return;
    updateMoodItem(boardId, itemId, {
      ogTitle: meta.title,
      ogDescription: meta.description,
      ogImage: meta.image,
      ogSite: meta.site,
    });
  }

  function isTextFile(file: File): boolean {
    const type = file.type || '';
    if (type.startsWith('text/')) return true;
    if (/(json|javascript|ecmascript|xml|csv|markdown|x-yaml|toml|sql|svg)/.test(type)) return true;
    return /\.(txt|md|markdown|json|csv|tsv|log|ya?ml|toml|ini|cfg|conf|xml|html?|css|js|mjs|ts|jsx|tsx|rs|py|go|java|c|cpp|h|hpp|sh|ps1|rb|php|swift|kt)$/i.test(file.name);
  }

  async function addFileItem(file: File, x: number, y: number, boardId: string): Promise<void> {
    const type = file.type || '';
    const name = file.name || 'file';
    if (type.startsWith('image/')) {
      const stored = await storeFile(file);
      const size = await fitImage(stored.url);
      addMoodItem(boardId, makeMoodItem('image', { url: stored.url, path: stored.path, name, x, y, ...size }));
    } else if (type.startsWith('video/')) {
      const stored = await storeFile(file);
      addMoodItem(boardId, makeMoodItem('video', { url: stored.url, path: stored.path, name, mime: type, size: file.size, x, y }));
    } else if (type.startsWith('audio/')) {
      const stored = await storeFile(file);
      addMoodItem(boardId, makeMoodItem('audio', { url: stored.url, path: stored.path, name, mime: type, size: file.size, x, y }));
    } else if (isTextFile(file)) {
      const stored = await storeFile(file);
      let text = '';
      try {
        text = (await file.text()).slice(0, 40000);
      } catch {
        /* ignore */
      }
      addMoodItem(boardId, makeMoodItem('text', { text, name, url: stored.url, path: stored.path, mime: type, size: file.size, x, y }));
    } else {
      const stored = await storeFile(file);
      addMoodItem(boardId, makeMoodItem('file', { url: stored.url, path: stored.path, name, mime: type, size: file.size, x, y }));
    }
  }

  async function handleFiles(files: File[], at: { x: number; y: number } | null): Promise<void> {
    if (!board) return;
    const boardId = board.id;
    const base = at ?? centerWorld();
    let i = 0;
    for (const file of files) {
      try { await addFileItem(file, Math.round(base.x + i * 26), Math.round(base.y + i * 26), boardId); }
      catch { notify(`Could not import ${file.name}. Check available disk space and file permissions.`); }
      i += 1;
    }
  }

  function addTextAt(text: string, at: { x: number; y: number } | null): void {
    if (!board) return;
    const world = at ?? centerWorld();
    const looksLikeUrl = /^https?:\/\/\S+$/i.test(text) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text);
    if (looksLikeUrl) addLinkItem(text, world.x, world.y);
    else addMoodItem(board.id, makeMoodItem('note', { text, x: Math.round(world.x), y: Math.round(world.y) }));
  }

  async function onCanvasDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    if (!board) return;
    const world = toWorld(event.clientX, event.clientY);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) {
      await handleFiles(files, world);
      return;
    }
    const text = event.dataTransfer?.getData('text/plain')?.trim();
    if (text) addTextAt(text, world);
  }

  async function onWindowPaste(event: ClipboardEvent): Promise<void> {
    if (!board || isTyping() || document.querySelector('[aria-modal="true"]')) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) return;
    const anchor = pointerWorld();
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length) {
      event.preventDefault();
      await handleFiles(files, anchor);
      return;
    }
    const text = event.clipboardData?.getData('text/plain')?.trim();
    if (text) {
      event.preventDefault();
      if (text.startsWith('board-items:')) {
        try {
          const copied: unknown = JSON.parse(text.slice('board-items:'.length));
          if (Array.isArray(copied) && copied.every(item => item && typeof item.id === 'string' && typeof item.type === 'string' && ['note','todo','image','video','audio','file','text','link','color','board'].includes(item.type) && [item.x,item.y,item.width,item.height,item.z].every(Number.isFinite))) {
            pasteItems(copied, anchor ?? undefined); return;
          }
        } catch { /* Plain text from another app. */ }
      }
      addTextAt(text, anchor);
    }
  }

  // ── Menus ────────────────────────────────────────────────────────
  function boardContextMenu(event: MouseEvent): void {
    const at = toWorld(event.clientX, event.clientY);
    openContextMenu(event, [
      ...(selected.size ? [{ label: 'Copy', icon: 'bx bx-copy', action: copySelection }] : []),
      ...(clipboard.length ? [{ label: 'Paste', icon: 'bx bx-paste', action: () => pasteItems(clipboard, at) }] : []),
      { label: 'New note', icon: 'bx bx-note', separatorBefore: selected.size > 0 || clipboard.length > 0, action: () => addNote(at) },
      { label: 'New to-do', icon: 'bx bx-check-square', action: () => addTodo(at) },
      { label: 'New image', icon: 'bx bx-image-add', action: () => void addImage(at) },
      { label: 'New file', icon: 'bx bx-file', action: () => void addFiles(at) },
      { label: 'New link', icon: 'bx bx-link', action: () => addLink(at) },
      { label: 'New colour', icon: 'bx bx-palette', action: () => addColor(at) },
      { label: 'New board', icon: 'bx bx-layout', separatorBefore: true, action: () => addChild('canvas') },
      { label: 'New journal', icon: 'bx bx-note', action: () => addChild('document') },
    ]);
  }

  function openLink(item: MoodItem): void {
    const url = normalizeUrl(item.url ?? '');
    if (url) void openExternal(url);
  }

  function focusItem(item: MoodItem): void {
    const rect = viewportEl?.getBoundingClientRect();
    if (rect) {
      pan = {
        x: rect.width / 2 - (item.x + item.width / 2) * zoom,
        y: rect.height / 2 - (item.y + item.height / 2) * zoom,
      };
    }
    selectOnly(item.id);
    closeBoardItems();
  }

  function addTagToItem(item: MoodItem): void {
    if (!board) return;
    showPrompt({ title: 'Add tag', label: 'Tag (searched with @tag)', placeholder: 'idea' }, (raw) => {
      const tag = raw.replace(/^@/, '').trim();
      if (!tag || !board) return;
      updateMoodItem(board.id, item.id, { tags: [...new Set([...(item.tags ?? []), tag])] });
    });
  }

  function moveSelectionToBoard(itemIds: string[], targetId: string | null): void {
    if (!board || itemIds.length === 0) return;
    const fromId = board.id;
    let target = targetId;
    if (!target) target = createBoard('canvas', fromId, 'New board').id;
    moveMoodItems(fromId, itemIds, target);
    selected = new Set();
    if (!targetId) openBoard(target);
  }

  function openMoveMenu(x: number, y: number, itemIds: string[]): void {
    const currentId = board?.id;
    const targets = $boardsStore.filter((b) => b.kind === 'canvas' && b.id !== currentId);
    openContextMenuAt(x, y, [
      { label: 'New board', icon: 'bx bx-plus', action: () => moveSelectionToBoard(itemIds, null) },
      ...targets.map((b) => ({
        label: b.title || 'Untitled board',
        icon: 'bx bx-layout',
        action: () => moveSelectionToBoard(itemIds, b.id),
      })),
    ]);
  }

  function itemMenu(event: MouseEvent, item: MoodItem): void {
    if (item.type === 'board') {
      const child = item.boardId ? $boardsStore.find((b) => b.id === item.boardId) : undefined;
      if (child) {
        boardMenu(event, child);
        return;
      }
    }
    openContextMenu(event, [
      { label: 'Duplicate', icon: 'bx bx-copy', action: () => pasteItems([{ ...item }]) },
      { label: 'Bring to front', icon: 'bx bx-layer', action: () => board && bringMoodItemToFront(board.id, item.id) },
      ...(item.type === 'note' || item.type === 'todo' || item.type === 'color'
        ? [
            {
              label: 'Next colour',
              icon: 'bx bx-palette',
              action: () => {
                if (!board) return;
                const idx = NOTE_COLORS.indexOf(item.color ?? NOTE_COLORS[0]);
                updateMoodItem(board.id, item.id, { color: NOTE_COLORS[(idx + 1) % NOTE_COLORS.length] });
              },
            },
          ]
        : []),
      ...(item.type === 'file' || item.type === 'video' || item.type === 'audio'
        ? [{ label: 'Open file', icon: 'bx bx-export', action: () => openStoredFile(item) }]
        : []),
      { label: 'Add tag…', icon: 'bx bx-purchase-tag', separatorBefore: true, action: () => addTagToItem(item) },
      { label: 'Move to board…', icon: 'bx bx-move', action: () => openMoveMenu(event.clientX, event.clientY, [item.id]) },
      {
        label: 'Delete',
        icon: 'bx bx-trash',
        destructive: true,
        separatorBefore: true,
        action: () => board && removeMoodItem(board.id, item.id),
      },
    ]);
  }

  function backgroundFor(item: MoodItem): string {
    if (item.type === 'image') return 'transparent';
    if (item.type === 'color') return item.color ?? '#ff4d5e';
    if (item.type === 'video') return '#000';
    if (item.type === 'link' && (embedUrl(item.url ?? '') || item.ogImage)) return '#000';
    return item.color ?? '#26262b';
  }
</script>

<svelte:window onkeydown={onWindowKey} onpaste={onWindowPaste} onpointermove={onPointerMove} onmouseout={onPointerOut} />

{#if !board}
  <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
    <i class="bx bx-layout text-4xl text-zinc-600"></i>
    <p class="text-[13px] text-zinc-500">This board no longer exists.</p>
    <button class="text-[12px] text-[var(--color-accent2)] underline" onclick={goHome}>Back to home</button>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={viewportEl}
    class="relative min-h-0 flex-1 select-none overflow-hidden"
    style="background-color: color-mix(in srgb, var(--color-accent) 14%, {board.color}); background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px); background-size: {22 * zoom}px {22 * zoom}px; background-position: {pan.x}px {pan.y}px;"
    onpointerdown={onViewportPointerDown}
    onwheel={onWheel}
    ondrop={onCanvasDrop}
    ondragover={(e) => e.preventDefault()}
    oncontextmenu={boardContextMenu}
    ondblclick={(e) => {
      if (e.target === viewportEl) {
        const world = toWorld(e.clientX, e.clientY);
        spawn('note', { x: Math.round(world.x), y: Math.round(world.y), text: '' });
      }
    }}
  >
    <div class="absolute inset-0" style="transform: translate({pan.x}px, {pan.y}px) scale({zoom}); transform-origin: 0 0;">
      {#each items as item (item.id)}
        {@const isSel = selected.has(item.id)}
        {@const embed = item.type === 'link' ? embedUrl(item.url ?? '') : null}
        {#if item.type === 'board'}
          {@const child = item.boardId ? $boardsStore.find((b) => b.id === item.boardId) : undefined}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <div
            class="group absolute flex flex-col overflow-hidden rounded-xl bg-[var(--color-elevated)] shadow-[0_10px_30px_rgba(0,0,0,0.4)] {isSel ? 'ring-2 ring-[var(--color-accent)]' : ''}"
            style="left: {item.x}px; top: {item.y}px; width: {item.width}px; height: {item.height}px; z-index: {zRank.get(item.id) ?? 1};"
            role="group"
            tabindex="0"
            onpointerdown={(e) => onItemPointerDown(e, item)}
            oncontextmenu={(e) => itemMenu(e, item)}
          >
            <div class="flex h-7 shrink-0 cursor-move items-center gap-1 bg-black/15 px-2" onpointerdown={(e) => beginDrag(e, item, 'move')}>
              <i class="bx {child?.kind === 'document' ? 'bx-note' : 'bx-layout'} text-[13px] text-white/70"></i>
              <span class="h-3 flex-1"></span>
            </div>
            {#if child}
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div class="flex min-h-0 flex-1 cursor-pointer flex-col px-2.5 pb-2 pt-1.5" onclick={() => openBoard(child.id)} role="link" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') openBoard(child.id); }}>
                <div class="flex items-center gap-1.5">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-sm"><span>{child.icon || (child.kind === 'document' ? '📓' : '🗂️')}</span></span>
                  <span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{child.title || 'Untitled'}</span>
                  <i class="bx bx-chevron-right text-base text-zinc-500"></i>
                </div>
                <div class="mt-1.5 min-h-0 flex-1 overflow-hidden">
                  {#if child.kind === 'document'}
                    <p class="line-clamp-3 text-[10px] leading-snug text-zinc-500">{boardPreview(child)}</p>
                  {:else if child.items.length === 0}
                    <p class="text-[10px] text-zinc-600">Empty board</p>
                  {:else}
                    <div class="grid grid-cols-4 gap-0.5">
                      {#each child.items.slice(0, 8) as mini (mini.id)}
                        <span class="aspect-square overflow-hidden rounded-[3px] bg-white/10">
                          {#if mini.type === 'image' && mini.url}
                            <img src={mini.url} alt="" class="h-full w-full object-cover" />
                          {:else if mini.color}
                            <span class="block h-full w-full" style="background: {mini.color}"></span>
                          {:else}
                            <i class="bx {TYPE_ICON[mini.type]} flex h-full items-center justify-center text-[9px] text-zinc-400"></i>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="flex flex-1 items-center justify-center text-[11px] text-zinc-500">Missing board</div>
            {/if}
            <div class="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize" onpointerdown={(e) => beginDrag(e, item, 'resize')}>
              <span class="pointer-events-none absolute bottom-1 right-1 block h-3 w-3 rounded-br-[10px] border-b-2 border-r-2 border-white/50"></span>
            </div>
          </div>
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <div
            class="group absolute flex flex-col overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] {isSel ? 'ring-2 ring-[var(--color-accent)]' : ''}"
            style="left: {item.x}px; top: {item.y}px; width: {item.width}px; height: {item.height}px; z-index: {zRank.get(item.id) ?? 1}; background: {backgroundFor(item)};"
            role="group"
            tabindex="0"
            onpointerdown={(e) => onItemPointerDown(e, item)}
            oncontextmenu={(e) => itemMenu(e, item)}
          >
            <div
              class="flex h-7 shrink-0 cursor-move items-center gap-1 px-2 {item.type === 'image' || embed || item.ogImage
                ? 'absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100'
                : 'bg-black/15'}"
              onpointerdown={(e) => beginDrag(e, item, 'move')}
            >
              <i class="bx {TYPE_ICON[item.type]} text-[13px] text-white/70"></i>
              {#if item.name}<span class="min-w-0 flex-1 truncate text-[10px] text-white/50">{item.name}</span>{:else}<span class="h-3 flex-1"></span>{/if}
              {#if item.type === 'note' || item.type === 'todo' || item.type === 'color'}
                <input
                  type="color"
                  value={item.color ?? '#26262b'}
                  aria-label="Colour"
                  title="Colour"
                  class="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                  onpointerdown={(e) => e.stopPropagation()}
                  oninput={(e) => board && updateMoodItem(board.id, item.id, { color: (e.currentTarget as HTMLInputElement).value })}
                />
              {/if}
              <button class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/40 text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-black/70 hover:text-white" aria-label="Delete item" onpointerdown={(e) => e.stopPropagation()} onclick={() => board && removeMoodItem(board.id, item.id)}>
                <i class="bx bx-x text-[14px]"></i>
              </button>
            </div>

            <div class="relative min-h-0 flex-1">
              {#if item.type === 'image'}
                {#if item.url}<img src={item.url} alt="" class="h-full w-full object-cover" draggable="false" />{/if}
              {:else if item.type === 'video'}
                {#if item.url}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video src={item.url} controls preload="metadata" class="h-full w-full bg-black object-contain"></video>
                {/if}
              {:else if item.type === 'audio'}
                <div class="flex h-full flex-col items-center justify-center gap-1.5 px-3">
                  <i class="bx bx-music text-2xl text-[var(--color-accent2)]"></i>
                  <span class="w-full truncate text-center text-[11px] text-zinc-300">{item.name || 'Audio'}</span>
                  <audio src={item.url} controls class="w-full"></audio>
                </div>
              {:else if item.type === 'text'}
                <pre class="h-full w-full overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-snug text-zinc-200">{item.text || 'Empty file'}</pre>
              {:else if item.type === 'file'}
                <div class="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
                  <i class="bx bx-file text-2xl text-zinc-400"></i>
                  <span class="line-clamp-2 break-all text-[11px] text-zinc-200">{item.name || 'File'}</span>
                  {#if item.size}<span class="text-[10px] text-zinc-500">{formatSize(item.size)}</span>{/if}
                  <button class="mt-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white transition-colors hover:bg-white/20" onclick={() => openStoredFile(item)}>Open</button>
                </div>
              {:else if item.type === 'link'}
                {#if embed}
                  <iframe src={embed} class="h-full w-full border-0" title={item.text || item.url} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
                  {#if !activeEmbeds.has(item.id)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="absolute inset-0 z-[5] flex items-center justify-center" title="Double-click to interact" ondblclick={() => activateEmbed(item.id)}>
                      <span class="pointer-events-none rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">Double-click to interact</span>
                    </div>
                  {/if}
                {:else}
                  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                  <div class="flex h-full flex-col" onclick={() => openLink(item)} role="link" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') openLink(item); }}>
                    {#if item.ogImage}
                      <img src={item.ogImage} alt="" class="h-1/2 w-full object-cover" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
                    {/if}
                    <div class="flex min-h-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
                      <div class="flex items-center gap-1.5">
                        <img src="https://icons.duckduckgo.com/ip3/{domainOf(item.url ?? '')}.ico" alt="" class="h-3.5 w-3.5 rounded" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
                        <span class="truncate text-[10px] text-zinc-400">{item.ogSite || domainOf(item.url ?? '')}</span>
                        <i class="bx bx-link-external ml-auto text-sm text-[var(--color-accent2)]"></i>
                      </div>
                      <p class="line-clamp-2 text-[12px] font-medium text-zinc-100">{item.ogTitle || item.text || item.url}</p>
                      {#if item.ogDescription}<p class="line-clamp-2 text-[10px] leading-snug text-zinc-500">{item.ogDescription}</p>{/if}
                    </div>
                  </div>
                {/if}
              {:else if item.type === 'todo'}
                <div class="flex h-full items-start gap-2 px-3 py-2">
                  <button class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border {item.checked ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'border-white/30 text-transparent'}" onclick={() => board && updateMoodItem(board.id, item.id, { checked: !item.checked })} aria-label="Toggle done">
                    <i class="bx bx-check text-[12px]"></i>
                  </button>
                  <textarea class="h-full w-full resize-none bg-transparent text-[13px] leading-snug text-zinc-100 outline-none placeholder:text-zinc-500 {item.checked ? 'line-through opacity-60' : ''}" placeholder="To-do…" value={item.text} oninput={(e) => board && updateMoodItem(board.id, item.id, { text: (e.currentTarget as HTMLTextAreaElement).value })}></textarea>
                </div>
              {:else if item.type === 'color'}
                <div class="flex h-full items-end justify-center pb-2">
                  <span class="rounded bg-black/25 px-1.5 py-0.5 text-[10px] text-white/80">{item.color}</span>
                </div>
              {:else}
                <textarea class="h-full w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-snug text-zinc-100 outline-none placeholder:text-zinc-500" placeholder="Write a note…" value={item.text} oninput={(e) => board && updateMoodItem(board.id, item.id, { text: (e.currentTarget as HTMLTextAreaElement).value })}></textarea>
              {/if}
            </div>

            <div class="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize" onpointerdown={(e) => beginDrag(e, item, 'resize')}>
              <span class="pointer-events-none absolute bottom-1 right-1 block h-3 w-3 rounded-br-[10px] border-b-2 border-r-2 border-white/50"></span>
            </div>
          </div>
        {/if}
      {/each}

      {#if marqueeRect}
        <div class="pointer-events-none absolute rounded-sm bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]" style="left: {marqueeRect.left}px; top: {marqueeRect.top}px; width: {marqueeRect.width}px; height: {marqueeRect.height}px; z-index: 999999;"></div>
      {/if}
    </div>

    {#if selected.size >= 2}
      <div class="absolute left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[var(--color-elevated)] p-1.5 pl-3 shadow-[0_12px_34px_rgba(0,0,0,0.5)]" onpointerdown={(e) => e.stopPropagation()}>
        <span class="text-[12px] text-zinc-300">{selected.size} selected</span>
        <button class="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11px] text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200" onclick={deleteSelected}>
          <i class="bx bx-trash text-base"></i> Delete
        </button>
        <button class="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white" onclick={(e) => openMoveMenu(e.clientX, e.clientY, [...selected])}>
          <i class="bx bx-move text-base"></i> Move
        </button>
        <button class="flex h-8 items-center rounded-xl px-2.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white" onclick={clearSelection}>Clear</button>
      </div>
    {/if}

    {#if $boardItemsOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="absolute inset-0 z-[60] flex items-center justify-center bg-scrim/40 p-4" onpointerdown={(e) => { e.stopPropagation(); closeBoardItems(); }}>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex max-h-[85%] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_24px_60px_rgba(0,0,0,0.7)]" role="dialog" aria-modal="true" aria-label="All items" tabindex="-1" onpointerdown={(e) => e.stopPropagation()}>
          <header class="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
            <i class="bx bx-collection text-xl text-[var(--color-accent2)]"></i>
            <h2 class="flex-1 text-[20px] font-extrabold tracking-tight text-white">All items</h2>
            <span class="text-[11px] text-zinc-500">{items.length}</span>
            <button class="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white" aria-label="Close" onclick={closeBoardItems}><i class="bx bx-x text-xl"></i></button>
          </header>
          <div use:overlayScrollbar={{ topInset: 0 }} class="journal-overlay-scroll min-h-0 flex-1 space-y-1 px-3 pb-4">
            {#if items.length === 0}
              <p class="px-3 py-8 text-center text-[12px] text-zinc-600">This board is empty.</p>
            {:else}
              {#each items as item (item.id)}
                <button class="flex w-full items-center gap-3 rounded-xl bg-[var(--color-card)] px-3 py-2 text-left transition-colors hover:bg-white/5" onclick={() => focusItem(item)}>
                  {#if item.type === 'image' && item.url}
                    <img src={item.url} alt="" class="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  {:else if item.type === 'link' && item.ogImage}
                    <img src={item.ogImage} alt="" class="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  {:else}
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--color-accent2)]"><i class="bx {TYPE_ICON[item.type]} text-lg"></i></span>
                  {/if}
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] text-zinc-100">{itemLabel(item, $boardsStore)}</span>
                    {#if itemSnippet(item, $boardsStore)}<span class="block truncate text-[11px] text-zinc-500">{itemSnippet(item, $boardsStore)}</span>{/if}
                    {#if item.tags?.length}
                      <span class="mt-0.5 flex flex-wrap gap-1">
                        {#each item.tags as tag (tag)}<span class="rounded bg-white/[0.06] px-1.5 text-[9px] text-[var(--color-accent2)]">@{tag}</span>{/each}
                      </span>
                    {/if}
                  </span>
                  <span class="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">{ITEM_TYPE_LABEL[item.type]}</span>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if toolbarPos !== 'off'}
      <div class={toolbarWrapper}>
        <div class={toolbarPill} onpointerdown={(e) => e.stopPropagation()}>
          <button class="toolbar-icon" aria-label="New board" onclick={() => addChild('canvas')} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'New board', '', 'top')} onmouseleave={hideTip}><i class="bx bx-layout text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New journal" onclick={() => addChild('document')} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'New journal', '', 'top')} onmouseleave={hideTip}><i class="bx bx-note text-lg"></i></button>
          <span class={toolbarSep}></span>
          <button class="toolbar-icon" aria-label="New note" onclick={addNote} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Note', '', 'top')} onmouseleave={hideTip}><i class="bx bx-note text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New to-do" onclick={addTodo} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'To-do', '', 'top')} onmouseleave={hideTip}><i class="bx bx-check-square text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New image" onclick={addImage} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Image', '', 'top')} onmouseleave={hideTip}><i class="bx bx-image-add text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New file" onclick={addFiles} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'File', '', 'top')} onmouseleave={hideTip}><i class="bx bx-file text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New link" onclick={addLink} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Link', '', 'top')} onmouseleave={hideTip}><i class="bx bx-link text-lg"></i></button>
          <button class="toolbar-icon" aria-label="New colour" onclick={addColor} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Colour', '', 'top')} onmouseleave={hideTip}><i class="bx bx-palette text-lg"></i></button>
          <span class={toolbarSep}></span>
          <button class="toolbar-icon" aria-label="Zoom out" onclick={() => zoomBy(1 / 1.25)} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Zoom out', '', 'top')} onmouseleave={hideTip}><i class="bx bx-minus text-lg"></i></button>
          <button class="flex h-8 items-center rounded-full px-2 text-[11px] tabular-nums text-zinc-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Reset zoom" onclick={zoomReset} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Reset zoom', '', 'top')} onmouseleave={hideTip}>{Math.round(zoom * 100)}%</button>
          <button class="toolbar-icon" aria-label="Zoom in" onclick={() => zoomBy(1.25)} onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, 'Zoom in', '', 'top')} onmouseleave={hideTip}><i class="bx bx-plus text-lg"></i></button>
        </div>
      </div>
    {/if}

    {#if items.length === 0}
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-zinc-300">
        <i class="bx bx-paste text-3xl"></i>
        <p class="text-[13px]">Drag any files here, or paste images, text or links</p>
        <p class="text-[11px] text-zinc-400">Right-click the board to add items. Double-click for a note.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .toolbar-icon {
    display: flex;
    height: 2rem;
    width: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: #a1a1aa;
    transition: background-color 0.15s, color 0.15s;
  }
  .toolbar-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
</style>
