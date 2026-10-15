<script lang="ts">
  import { flip } from 'svelte/animate';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';
  import type { Board } from '$lib/core/board';
  import { boardsStore } from '$lib/app/services/library';
  import { back, canGoBack, goHome, openBoard, pageStore } from '$lib/app/services/navigation';
  import { openSearch } from '$lib/app/services/overlays';
  import { boardMenu, newBoard } from '$lib/app/services/menus';
  import { openContextMenu } from '$lib/app/services/contextMenu';
  import { hideTip, showTip } from '$lib/app/services/tooltip';

  /** The drawer has the whole screen width; kept for API compatibility. */
  export let forceFull = false;

  $: root = $boardsStore.find((board) => board.parentId === null);
  $: currentBoard =
    $pageStore.view === 'board'
      ? $boardsStore.find((board) => board.id === $pageStore.id)
      : $pageStore.view === 'home'
        ? root
        : undefined;
  $: createParentId = currentBoard && currentBoard.kind === 'canvas' ? currentBoard.id : (root?.id ?? null);

  function isActive(board: Board): boolean {
    if ($pageStore.view === 'home') return board.parentId === null;
    return $pageStore.view === 'board' && $pageStore.id === board.id;
  }

  function openNewMenu(event: MouseEvent): void {
    openContextMenu(event, [
      { label: 'New board', icon: 'bx bx-layout', action: () => void newBoard('canvas', createParentId) },
      { label: 'New journal', icon: 'bx bx-note', action: () => void newBoard('document', createParentId) },
    ]);
  }
</script>

{#snippet railButton(icon: string, label: string, active: boolean, disabled: boolean, onclick: (event: MouseEvent) => void, subtitle = '')}
  <button
    class="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors {active
      ? 'bg-[var(--color-accent)]/20 text-white'
      : 'bg-white/5 text-zinc-300'} hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/5"
    aria-label={label}
    {disabled}
    {onclick}
    onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, label, subtitle)}
    onmouseleave={hideTip}
  >
    <i class={icon}></i>
  </button>
{/snippet}

{#snippet boardButton(board: Board)}
  {@const isRoot = board.parentId === null}
  {@const child = board.kind === 'document' ? 'Journal' : `${board.items.length} items`}
  <div class="flex justify-center">
    <button
      class="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors {isActive(board)
        ? 'bg-[var(--color-accent)]/20 text-white'
        : 'bg-white/5 text-zinc-300'} hover:bg-white/10 hover:text-white"
      aria-label={board.title || 'Untitled'}
      onclick={() => (isRoot ? goHome() : openBoard(board.id))}
      oncontextmenu={(e) => boardMenu(e, board, isRoot)}
      onmouseenter={(e) => showTip(e.currentTarget as HTMLElement, board.title || 'Untitled', child)}
      onmouseleave={hideTip}
    >
      <span>{board.icon || (board.kind === 'document' ? '📓' : '🗂️')}</span>
    </button>
  </div>
{/snippet}

<aside class="journal-sidebar relative flex h-full w-14 shrink-0 flex-col {forceFull ? 'pt-12' : 'pt-2'}">
  <div class="relative z-20 flex shrink-0 flex-col items-center gap-2 px-2">
    {@render railButton('bx bx-chevron-left text-2xl', 'Back', false, !$canGoBack, back)}
    {@render railButton('bx bx-search text-xl', 'Search', false, false, openSearch)}
    {@render railButton('bx bx-plus text-2xl', 'New board or journal', false, false, openNewMenu)}
  </div>

  <div class="relative mt-2 flex min-h-0 flex-1 flex-col">
    <div use:overlayScrollbar={{ enabled: true }} class="journal-overlay-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-4">
      {#each $boardsStore as board (board.id)}
        <div animate:flip={{ duration: 160 }}>{@render boardButton(board)}</div>
      {/each}
    </div>
  </div>
</aside>
