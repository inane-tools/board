<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { listen } from '@tauri-apps/api/event';
  import { isTauri, invokeSafe } from '$lib/app/services/platform';
  import { settingsStore } from '$lib/app/services/settings';
  import { renderedZoom } from '$lib/app/services/zoom';
  import { goHome, pageStore } from '$lib/app/services/navigation';
  import { boardsStore, deleteBoard, updateBoard } from '$lib/app/services/library';
  import { resetMoodboardView } from '$lib/app/services/moodboardView';
  import { toggleBoardItems } from '$lib/app/services/boardPanel';
  import { openSettings, settingsOpen } from '$lib/app/services/overlays';
  import { showConfirm } from '$lib/app/services/dialogs';

  // A board's title + controls live in the bar while a canvas board is open.
  $: activeBoard =
    $pageStore.view === 'home'
      ? $boardsStore.find((board) => board.parentId === null)
      : $pageStore.view === 'board'
        ? $boardsStore.find((board) => board.id === $pageStore.id)
        : undefined;
  $: canvasBoard = activeBoard && activeBoard.kind === 'canvas' ? activeBoard : undefined;
  $: isRoot = canvasBoard?.parentId === null;

  function resetBoardView(): void {
    get(resetMoodboardView)();
  }
  function clearBoard(): void {
    const board = canvasBoard;
    if (!board) return;
    showConfirm(
      { title: 'Clear board?', message: 'Every item on this board will be removed.', confirmLabel: 'Clear', destructive: true },
      () => updateBoard(board.id, { items: [] }),
    );
  }
  function removeBoard(): void {
    const board = canvasBoard;
    if (!board) return;
    showConfirm(
      {
        title: 'Delete board?',
        message: `“${board.title}” and everything inside it will be permanently removed.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => {
        deleteBoard(board.id);
        goHome();
      },
    );
  }

  let maximized = false;
  let platform = '';
  let linuxInsets = { left: 0, right: 0 };

  onMount(() => {
    if (!isTauri()) return;
    let disposed = false;
    let stopSettings: (() => void) | undefined;
    let stopResize: (() => void) | undefined;
    let stopInsets: (() => void) | undefined;
    let themeObserver: MutationObserver | undefined;
    let stopZoom: (() => void) | undefined;
    void (async () => {
      platform = (await invokeSafe<string>('desktop_platform')) ?? '';
      if (disposed) return;
      const win = getCurrentWindow();
      if (platform === 'linux') {
        document.documentElement.classList.add('journal-linux-window');
        const unlisten = await listen<typeof linuxInsets>('linux-controls-insets', ({ payload }) => {
          linuxInsets = payload;
        });
        if (disposed) {
          unlisten();
          return;
        }
        stopInsets = unlisten;
      }
      if (platform === 'linux' || platform === 'macos') {
        let frameUpdate = Promise.resolve();
        let lastVisible: string | undefined;
        const updateControls = () => {
          const { windowControls } = get(settingsStore);
          const zoom = get(renderedZoom);
          const light = document.documentElement.classList.contains('light');
          const key = `${windowControls}:${zoom}:${light}`;
          if (lastVisible === key) return;
          lastVisible = key;
          frameUpdate = frameUpdate
            .then(async () => {
              if (disposed) return;
              if (platform === 'linux') {
                const insets = await invokeSafe<typeof linuxInsets>('set_linux_window_controls', {
                  visible: windowControls,
                  zoom,
                  light,
                });
                if (!disposed && insets) linuxInsets = insets;
              } else {
                await win.setDecorations(windowControls);
              }
            })
            .catch(console.error);
        };
        stopSettings = settingsStore.subscribe(updateControls);
        if (platform === 'linux') {
          stopZoom = renderedZoom.subscribe(updateControls);
          themeObserver = new MutationObserver(updateControls);
          themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
      }
      const updateWindowShape = async () => {
        maximized = await win.isMaximized().catch(() => maximized);
        const fullscreen = await win.isFullscreen().catch(() => false);
        if (!disposed && platform === 'linux') {
          document.documentElement.classList.toggle('journal-window-expanded', maximized || fullscreen);
        }
      };
      await updateWindowShape();
      const unlisten = await win.onResized(updateWindowShape);
      if (disposed) unlisten();
      else stopResize = unlisten;
    })().catch(console.error);
    return () => {
      disposed = true;
      themeObserver?.disconnect();
      stopZoom?.();
      stopSettings?.();
      stopResize?.();
      stopInsets?.();
    };
  });

  if (isTauri()) {
    void getCurrentWindow()
      .isMaximized()
      .then((value) => (maximized = value))
      .catch(() => undefined);
  }

  async function minimize() {
    if (isTauri()) await getCurrentWindow().minimize();
  }
  async function toggleMaximize() {
    if (!isTauri()) return;
    await getCurrentWindow().toggleMaximize();
    maximized = await getCurrentWindow().isMaximized().catch(() => maximized);
  }
  async function close() {
    if (isTauri()) await getCurrentWindow().close();
  }

  async function onBarMouseDown(e: MouseEvent) {
    if (e.button !== 0 || !isTauri()) return;
    const t = e.target;
    if (t instanceof Element && t.closest('button, input, form, a')) return;
    e.preventDefault();
    if (e.detail === 2) {
      await toggleMaximize();
      return;
    }
    await getCurrentWindow().startDragging().catch(() => undefined);
  }
</script>

<!-- The header is the OS window drag handle: dragging moves the window and a
     double-click maximizes/restores it. `z-40` keeps it above the sign-in gate. -->
<!-- svelte-ignore a11y_no_static_element_interactions : header starts a native window drag -->
<header
  onmousedown={onBarMouseDown}
  class="absolute inset-x-0 top-0 z-40 flex h-12 items-center gap-2 pl-2"
  style:padding-left={platform === 'linux' ? `${Math.max(8, linuxInsets.left / $renderedZoom)}px` : undefined}
  style:padding-right={platform === 'linux' ? `${linuxInsets.right / $renderedZoom || 12}px` : undefined}
>
  {#if canvasBoard}
    <div class="flex min-w-0 items-center gap-1.5 pl-1">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base">
        <span>{canvasBoard.icon || '🗂️'}</span>
      </span>
      <input
        aria-label="Board title"
        class="min-w-0 rounded-md bg-transparent px-1 py-0.5 text-[13px] font-semibold text-white outline-none transition-colors placeholder:text-zinc-600 hover:bg-white/5 focus:bg-white/5"
        style="width: {Math.min(30, Math.max(7, (canvasBoard.title || '').length + 1))}ch"
        value={canvasBoard.title}
        placeholder="Untitled board"
        oninput={(e) => canvasBoard && updateBoard(canvasBoard.id, { title: (e.currentTarget as HTMLInputElement).value })}
      />
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        title="Reset view"
        aria-label="Reset view"
        onclick={resetBoardView}
      >
        <i class="bx bx-target-lock text-base"></i>
      </button>
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        title="Clear board"
        aria-label="Clear board"
        onclick={clearBoard}
      >
        <i class="bx bx-eraser text-base"></i>
      </button>
      {#if !isRoot}
        <button
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
          title="Delete board"
          aria-label="Delete board"
          onclick={removeBoard}
        >
          <i class="bx bx-trash text-base"></i>
        </button>
      {/if}
    </div>
  {/if}

  <div class="ml-auto flex h-full shrink-0 items-center justify-end gap-2 {isTauri() && platform === 'windows' && $settingsStore.windowControls ? 'pr-[138px]' : $settingsStore.windowControls ? '' : 'pr-3'}">
    {#if canvasBoard}
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
        title="All items"
        aria-label="Browse items"
        onclick={toggleBoardItems}
      >
        <i class="bx bx-collection text-base"></i>
      </button>
    {/if}
    <button
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
      title="Settings"
      aria-label="Open settings"
      onclick={openSettings}
    >
      <i class="bx bx-cog text-base"></i>
    </button>
  </div>
</header>

<!-- Top layer: above any overlay, so the window can still be dragged and the
     window controls still work while Settings is open. The drag strip only
     takes pointer events when an overlay is open; otherwise the header behind
     handles dragging and its buttons stay clickable. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pointer-events-none absolute inset-x-0 top-0 z-[70] flex h-12 items-stretch">
  <div class="flex-1 {$settingsOpen ? 'pointer-events-auto' : 'pointer-events-none'}" onmousedown={onBarMouseDown}></div>
  {#if isTauri() && platform === 'windows' && $settingsStore.windowControls}
    <div class="pointer-events-auto flex h-full items-stretch" data-tauri-drag-region>
      <button
        class="flex w-[46px] items-center justify-center text-white hover:bg-white/10"
        title="Minimize"
        aria-label="Minimize"
        onclick={minimize}
      >
        <span class="win-glyph">&#xE921;</span>
      </button>
      <button
        class="flex w-[46px] items-center justify-center text-white hover:bg-white/10"
        title={maximized ? 'Restore' : 'Maximize'}
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onclick={toggleMaximize}
      >
        <span class="win-glyph">{maximized ? '\uE923' : '\uE922'}</span>
      </button>
      <button
        class="flex w-[46px] items-center justify-center text-white hover:bg-[#c42b1c]"
        title="Close"
        aria-label="Close"
        onclick={close}
      >
        <span class="win-glyph text-[11px]">&#xE8BB;</span>
      </button>
    </div>
  {/if}
</div>
