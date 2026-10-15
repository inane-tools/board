<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { fade, fly } from '$lib/ui/transitions';
  import { pageStore, startMouseNavigation } from '$lib/app/services/navigation';
  import { restoreSettings, settingsStore } from '$lib/app/services/settings';
  import { boardsStore, initLibrary, flushLibrary, librarySaveError } from '$lib/app/services/library';
  import { protectUnsavedChanges } from '$lib/app/services/lifecycle';
  import { openSearch } from '$lib/app/services/overlays';
  import { startAppearance } from '$lib/app/services/appearance';
  import { startZoom } from '$lib/app/services/zoom';
  import { startMemoryTrimming } from '$lib/app/services/memory';
  import { openDevTools } from '$lib/app/services/devtools';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';
  import Titlebar from '$lib/ui/chrome/Titlebar.svelte';
  import Sidebar from '$lib/ui/chrome/Sidebar.svelte';
  import ContextMenu from '$lib/ui/components/ContextMenu.svelte';
  import Tooltip from '$lib/ui/components/Tooltip.svelte';
  import PromptDialog from '$lib/ui/components/PromptDialog.svelte';
  import ConfirmDialog from '$lib/ui/components/ConfirmDialog.svelte';
  import SearchOverlay from '$lib/ui/components/SearchOverlay.svelte';
  import SettingsOverlay from '$lib/ui/components/SettingsOverlay.svelte';
  import BoardCanvas from '$lib/ui/views/BoardCanvas.svelte';
  import BoardDocument from '$lib/ui/views/BoardDocument.svelte';

  let ready = false;
  let startupError = '';
  let destroyed = false;
  let mainEl: HTMLElement | undefined;

  startAppearance();
  startZoom();

  // The board being shown: Home is the root board; anything else is by id.
  $: activeBoard =
    $pageStore.view === 'home'
      ? $boardsStore.find((board) => board.parentId === null)
      : $pageStore.view === 'board'
        ? $boardsStore.find((board) => board.id === $pageStore.id)
        : undefined;

  let notice = '';
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  function showNotice(message: string) {
    notice = message;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ''), 6000);
  }
  function onNotice(event: Event) {
    const detail = (event as CustomEvent<{ message?: string }>).detail;
    if (detail?.message) showNotice(detail.message);
  }

  onMount(() => {
    const stopMouse = startMouseNavigation();
    const unsubscribe = pageStore.subscribe(() => {
      if (mainEl) mainEl.scrollTop = 0;
    });
    window.addEventListener('journal:notice', onNotice);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (!get(settingsStore).devToolsEnabled) return;
      const f12 = event.key === 'F12';
      const inspect = event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'i';
      if (f12 || inspect) {
        event.preventDefault();
        void openDevTools();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    let disposed = false;
    let stopMemory = () => {};
    let stopClose = () => {};
    void startMemoryTrimming().then((stop) => { if (disposed) stop(); else stopMemory = stop; });
    void protectUnsavedChanges().then((stop) => { if (disposed) stop(); else stopClose = stop; }).catch(console.error);
    const onUnload = () => { void flushLibrary().catch(() => undefined); };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      stopMouse();
      unsubscribe();
      window.removeEventListener('journal:notice', onNotice);
      window.removeEventListener('keydown', onKeyDown);
      disposed = true;
      stopMemory();
      stopClose();
      window.removeEventListener('beforeunload', onUnload);
    };
  });

  onDestroy(() => {
    destroyed = true;
    void flushLibrary().catch(() => undefined);
  });

  function suppressNativeContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  onMount(async () => {
    try {
      await restoreSettings();
      await initLibrary();
      if (!destroyed) ready = true;
    } catch (error) {
      startupError = error instanceof Error ? error.message : String(error);
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions : only prevents the native menu -->
<div class="relative flex h-full flex-col bg-[var(--color-surface)] text-zinc-100" oncontextmenu={suppressNativeContextMenu}>
  <div class="flex min-h-0 flex-1">
    {#if ready}
      <Sidebar />
    {/if}
    <div class="relative flex min-w-0 flex-1 flex-col overflow-x-clip">
      <Titlebar />
      {#if ready && activeBoard && activeBoard.kind === 'canvas'}
        <!-- Canvas boards own the whole content area: an infinite canvas with
             their controls floating on top. -->
        {#key activeBoard.id}
          <BoardCanvas id={activeBoard.id} />
        {/key}
      {:else}
        <main
          bind:this={mainEl}
          use:overlayScrollbar={{ topInset: 48 }}
          class="journal-overlay-scroll journal-fade-top min-w-0 flex-1 px-6 pt-12 pb-16"
        >
          {#if startupError}
            <div role="alert" class="mx-auto max-w-md rounded-2xl bg-[var(--color-elevated)] p-6">
              <h1 class="text-xl font-bold">Board could not open your library</h1>
              <p class="mt-3 text-sm text-zinc-400">{startupError}</p>
              <p class="mt-2 text-sm text-zinc-400">Your saved files have not been overwritten. Check available disk space and file permissions before reopening Board.</p>
            </div>
          {:else if !ready}
            <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5" out:fade={{ duration: 180 }}>
              <div class="journal-eq flex h-4 items-center gap-[3px] text-[var(--color-accent2)]">
                <span></span><span></span><span></span>
              </div>
              <p class="text-[12px] tracking-[0.18em] text-zinc-600 uppercase">Opening</p>
            </div>
          {:else if activeBoard}
            {#key activeBoard.id}
              <div in:fade={{ duration: 180 }}>
                <BoardDocument id={activeBoard.id} />
              </div>
            {/key}
          {:else}
            <div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <i class="bx bx-layout text-4xl text-zinc-600"></i>
              <p class="text-[13px] text-zinc-500">This board no longer exists.</p>
            </div>
          {/if}
        </main>
      {/if}

      {#if $librarySaveError}
        <div role="alert" class="absolute inset-x-4 bottom-4 z-[100] flex items-center justify-between gap-3 rounded-xl bg-[var(--color-elevated)] p-4 shadow-xl">
          <p class="text-sm">{$librarySaveError}</p>
          <button class="rounded-full bg-white/10 px-4 py-2 text-sm" onclick={() => void flushLibrary().catch(() => undefined)}>Retry save</button>
        </div>
      {/if}
      {#if notice}
        <div
          class="pointer-events-none absolute inset-x-0 top-14 z-50 flex justify-center px-4"
          role="status"
          aria-live="polite"
          in:fly={{ y: -12, duration: 220 }}
          out:fly={{ y: -12, duration: 160 }}
        >
          <div
            class="flex max-w-lg items-center gap-2 rounded-lg border border-white/10 bg-[var(--color-elevated)]/95 px-4 py-2 text-[12px] text-zinc-200 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            <i class="bx bx-info-circle text-base text-[var(--color-accent2)]"></i>
            <span>{notice}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <ContextMenu />
  <Tooltip />
  <PromptDialog />
  <ConfirmDialog />
  <SearchOverlay />
  <SettingsOverlay />
</div>
