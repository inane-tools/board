<script lang="ts">
  import TagChips from './TagChips.svelte';
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { tick } from 'svelte';
  import { fade, fly } from '$lib/ui/transitions';
  import type { Board, MoodItem } from '$lib/core/board';
  import { allTags, ITEM_TYPE_LABEL, itemLabel, itemSnippet } from '$lib/core/board';
  import { boardsStore } from '$lib/app/services/library';
  import { openBoard } from '$lib/app/services/navigation';
  import { closeSearch, searchOpen } from '$lib/app/services/overlays';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';

  interface Result {
    board: Board;
    item?: MoodItem;
    label: string;
    snippet: string;
    typeLabel: string;
    rank: number;
    thumb?: string;
  }

  let query = '';
  let selected = 0;
  let inputEl: HTMLInputElement | undefined;

  function excerpt(text: string, needle: string): string {
    const index = text.toLowerCase().indexOf(needle);
    if (index < 0) return text.slice(0, 80);
    const start = Math.max(0, index - 30);
    return (start > 0 ? '…' : '') + text.slice(start, start + 90).trim();
  }

  function ancestors(board: Board): string {
    const names: string[] = [];
    let current = board;
    let guard = 0;
    while (current.parentId && guard++ < 32) {
      const parent = $boardsStore.find((b) => b.id === current.parentId);
      if (!parent) break;
      names.unshift(parent.title || 'Untitled');
      current = parent;
    }
    return names.join(' / ');
  }

  function boardResult(board: Board, snippet: string): Result {
    return {
      board,
      label: board.title || 'Untitled',
      snippet,
      typeLabel: board.kind === 'document' ? 'Journal' : 'Board',
      rank: 0,
    };
  }

  function itemResult(board: Board, item: MoodItem, boards: Board[], snippet: string): Result {
    return {
      board,
      item,
      label: itemLabel(item, boards),
      snippet,
      typeLabel: ITEM_TYPE_LABEL[item.type],
      rank: 1,
      thumb: item.type === 'image' ? item.url : item.ogImage,
    };
  }

  function search(boards: Board[], raw: string): Result[] {
    const tags = [...raw.matchAll(/@([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase());
    const text = raw.replace(/@[\p{L}\p{N}_-]+/gu, ' ').trim().toLowerCase();
    if (!tags.length && !text) return [];

    const out: Result[] = [];
    const seenBoards = new Set<string>();
    for (const board of boards) {
      const boardTags = (board.tags ?? []).map((t) => t.toLowerCase());
      const boardTagOk = tags.length > 0 && tags.every((t) => boardTags.includes(t));
      const titleOk = text ? (board.title || '').toLowerCase().includes(text) : false;
      const blockText = text ? board.blocks.find((b) => b.text.toLowerCase().includes(text))?.text : undefined;
      const itemText = text
        ? board.items.find((it) => [it.text, it.name, it.url, it.ogTitle].some((v) => v?.toLowerCase().includes(text)))
        : undefined;
      const itemTextBlob = itemText ? itemText.text || itemText.name || itemText.url || itemText.ogTitle || '' : '';

      if (boardTagOk && (!text || titleOk || blockText || itemText)) {
        out.push(boardResult(board, 'Board'));
        seenBoards.add(board.id);
      } else if (!tags.length && text && (titleOk || blockText || itemText) && !seenBoards.has(board.id)) {
        out.push(boardResult(board, blockText ? excerpt(blockText, text) : titleOk ? 'Board' : excerpt(itemTextBlob, text)));
        seenBoards.add(board.id);
      }

      for (const item of board.items) {
        const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
        const itemTagOk = tags.length > 0 && tags.every((t) => itemTags.includes(t));
        const hay = [item.text, item.name, item.url, item.ogTitle].filter(Boolean).join(' ').toLowerCase();
        const itemTextOk = text ? hay.includes(text) : false;
        if (itemTagOk && (!text || itemTextOk)) {
          out.push(itemResult(board, item, boards, itemSnippet(item, boards)));
        } else if (!tags.length && text && itemTextOk) {
          out.push(itemResult(board, item, boards, excerpt(hay, text)));
        }
      }
    }
    return out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, 60);
  }

  $: tags = allTags($boardsStore);
  $: results = search($boardsStore, query);
  $: if (selected >= results.length) selected = 0;
  $: plainQuery = query.replace(/@[\p{L}\p{N}_-]+/gu, '').trim().toLowerCase();
  $: tagSuggestions = plainQuery ? tags.filter((t) => t.toLowerCase().includes(plainQuery)).slice(0, 8) : [];

  let wasOpen = false;
  $: if ($searchOpen && !wasOpen) {
    wasOpen = true;
    query = '';
    selected = 0;
    void tick().then(() => inputEl?.focus());
  } else if (!$searchOpen) {
    wasOpen = false;
  }

  function open(board: Board): void {
    closeSearch();
    openBoard(board.id);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = Math.max(0, Math.min(results.length - 1, selected + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(0, selected - 1);
    } else if (event.key === 'Enter' && results[selected]) {
      event.preventDefault();
      open(results[selected].board);
    }
  }
</script>

{#if $searchOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="absolute inset-0 z-[60] flex justify-center bg-scrim/50 px-4 pt-20"
    role="presentation"
    onclick={closeSearch}
    in:fade={{ duration: 140 }}
    out:fade={{ duration: 110 }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="flex w-full max-w-xl flex-col gap-2"
      use:dialogFocus={closeSearch}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: -12, duration: 180 }}
      out:fade={{ duration: 110 }}
    >
      <!-- Search bar -->
      <div class="flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--color-popover)] px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
        <i class="bx bx-search text-xl text-zinc-500"></i>
        <input
          bind:this={inputEl}
          bind:value={query}
          placeholder="Search boards, items, or @tag…"
          aria-label="Search"
          class="w-full bg-transparent text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
          onkeydown={onKey}
        />
        <button class="shrink-0 text-zinc-500 transition-colors hover:text-white" aria-label="Close search" onclick={closeSearch}>
          <i class="bx bx-x text-xl"></i>
        </button>
      </div>

      <!-- Results / tag suggestions -->
      {#if !query.trim()}
        {#if tags.length}
          <div class="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-popover)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
            {#each tags as tag (tag)}
              <button class="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" onclick={() => (query = `@${tag}`)}><TagChips tags={[tag]} /></button>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {#if tagSuggestions.length}
            <div class="flex shrink-0 flex-wrap gap-1.5 border-b border-white/[0.06] px-3 py-2">
              {#each tagSuggestions as tag (tag)}
                <button class="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" onclick={() => (query = `@${tag}`)}>@{tag}</button>
              {/each}
            </div>
          {/if}
          <div use:overlayScrollbar={{ topInset: 0 }} class="journal-overlay-scroll max-h-[55vh] overflow-y-auto p-2">
            {#if results.length === 0}
              <p class="px-3 py-8 text-center text-[12px] text-zinc-600">No matches for “{query.trim()}”.</p>
            {:else}
              {#each results as result, i (result.item ? `${result.board.id}:${result.item.id}` : result.board.id)}
                <button
                  class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {i === selected ? 'bg-[var(--color-accent)]/15' : 'hover:bg-white/5'}"
                  onmouseenter={() => (selected = i)}
                  onclick={() => open(result.board)}
                >
                  {#if result.thumb}
                    <img src={result.thumb} alt="" class="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  {:else if result.item}
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--color-accent2)]">
                      <i class="bx {result.item.type === 'board' ? 'bx-layout' : result.item.type === 'link' ? 'bx-link' : result.item.type === 'file' ? 'bx-file' : result.item.type === 'todo' ? 'bx-check-square' : result.item.type === 'color' ? 'bx-palette' : 'bx-note'} text-lg"></i>
                    </span>
                  {:else}
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg">
                      <span>{result.board.icon || (result.board.kind === 'document' ? '📓' : '🗂️')}</span>
                    </span>
                  {/if}
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      <span class="truncate text-[13px] font-semibold text-white">{result.label}</span>
                      <span class="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">{result.typeLabel}</span>
                    </span>
                    {#if result.snippet}
                      <span class="mt-0.5 block truncate text-[11px] text-zinc-500">{result.snippet}</span>
                    {/if}
                    {#if (result.item?.tags ?? result.board.tags)?.length}
                      <span class="mt-1 block"><TagChips tags={result.item?.tags ?? result.board.tags ?? []} /></span>
                    {/if}
                  </span>
                  {#if !result.item && result.board.parentId}
                    <span class="hidden shrink-0 truncate text-[10px] text-zinc-600 sm:block sm:max-w-[30%]">{ancestors(result.board)}</span>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
