<script lang="ts">
  import { tick } from 'svelte';
  import type { Block, BlockType, Board } from '$lib/core/board';
  import { BLOCK_LABELS, BLOCK_TYPES } from '$lib/core/board';
  import {
    addBlock,
    boardsStore,
    moveBlock,
    removeBlock,
    reorderBlock,
    updateBlock,
    updateBoard,
  } from '$lib/app/services/library';
  import { goHome } from '$lib/app/services/navigation';
  import { openContextMenu, openContextMenuAt, type ContextMenuItem } from '$lib/app/services/contextMenu';
  import { showPrompt } from '$lib/app/services/dialogs';
  import { imageFromClipboard, pickImageFile, readImageFile } from '$lib/app/services/images';
  import { toggleFavorite } from '$lib/app/services/library';
  import { settingsStore } from '$lib/app/services/settings';

  export let id: string;

  const FONT_FAMILIES: Record<string, string> = {
    sans: 'var(--font-sans)',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  };
  $: fontFamily = FONT_FAMILIES[$settingsStore.editorFont] ?? FONT_FAMILIES.sans;

  const EMOJIS = ['📓', '📔', '🌙', '☀️', '🌿', '💡', '🎯', '❤️', '🔥', '🧠', '✨', '🎨', '📝', '🗓️', '⭐', '🌊'];

  $: board = $boardsStore.find((j) => j.id === id) as Board | undefined;
  $: blocks = board?.blocks ?? [];

  let iconOpen = false;
  let dragId: string | null = null;
  let dragOverIndex: number | null = null;

  // Remember which block the caret is in so pasted images land in the right place.
  let activeBlockId: string | null = null;

  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    };
    resize();
    node.addEventListener('input', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return {
      update: resize,
      destroy() {
        node.removeEventListener('input', resize);
        observer.disconnect();
      },
    };
  }

  async function focusBlock(blockId: string, caret: 'start' | 'end' = 'end'): Promise<void> {
    await tick();
    const el = document.getElementById(`block-${blockId}`) as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    const pos = caret === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  }

  function onTitleInput(event: Event): void {
    updateBoard(id, { title: (event.currentTarget as HTMLTextAreaElement).value });
  }

  function onBlockInput(block: Block, event: Event): void {
    updateBlock(id, block.id, { text: (event.currentTarget as HTMLTextAreaElement).value });
  }

  async function addAfter(blockId: string | null, type: BlockType = 'paragraph'): Promise<void> {
    const newId = addBlock(id, blockId, type);
    await focusBlock(newId, 'end');
  }

  function setType(block: Block, type: BlockType): void {
    updateBlock(id, block.id, { type, ...(type === 'todo' ? { checked: block.checked ?? false } : {}) });
    void focusBlock(block.id, 'end');
  }

  function deleteBlock(block: Block): void {
    removeBlock(id, block.id);
  }

  function duplicateBlock(block: Block): void {
    const newId = addBlock(id, block.id, block.type);
    updateBlock(id, newId, { text: block.text, checked: block.checked, url: block.url, color: block.color });
  }

  function onKeyDown(block: Block, index: number, event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
      event.preventDefault();
      void addAfter(block.id, block.type === 'todo' || block.type === 'bulleted' || block.type === 'numbered' ? block.type : 'paragraph');
      return;
    }
    if (event.key === 'Backspace' && block.text.length === 0) {
      if (blocks.length > 1 && index > 0) {
        event.preventDefault();
        const previous = blocks[index - 1];
        removeBlock(id, block.id);
        void focusBlock(previous.id, 'end');
      }
      return;
    }
    if (event.key === '/' && block.text.length === 0) {
      event.preventDefault();
      openTypeMenuAt(block, event.currentTarget as HTMLElement);
    }
  }

  function typeMenuItems(block: Block): ContextMenuItem[] {
    return BLOCK_TYPES.map((type) => ({
      label: BLOCK_LABELS[type].label,
      icon: BLOCK_LABELS[type].icon,
      action: () => setType(block, type),
    }));
  }

  function openTypeMenuAt(block: Block, node: HTMLElement): void {
    const rect = node.getBoundingClientRect();
    openContextMenuAt(rect.left, rect.bottom + 4, typeMenuItems(block));
  }

  function openBlockMenu(block: Block, index: number, event: MouseEvent): void {
    openContextMenu(event, [
      { label: 'Duplicate', icon: 'bx bx-copy', action: () => duplicateBlock(block) },
      { label: 'Move up', icon: 'bx bx-up-arrow-alt', disabled: index === 0, action: () => moveBlock(id, block.id, -1) },
      {
        label: 'Move down',
        icon: 'bx bx-down-arrow-alt',
        disabled: index === blocks.length - 1,
        action: () => moveBlock(id, block.id, 1),
      },
      {
        label: 'Delete',
        icon: 'bx bx-trash',
        destructive: true,
        separatorBefore: true,
        action: () => deleteBlock(block),
      },
      ...typeMenuItems(block).map((item) => ({ ...item, separatorBefore: false })),
    ]);
  }

  // ── Images ───────────────────────────────────────────────────────
  async function setBlockImage(block: Block, file: File): Promise<void> {
    const url = await readImageFile(file);
    updateBlock(id, block.id, { url });
  }

  async function chooseImageFor(block: Block): Promise<void> {
    const url = await pickImageFile();
    if (url) updateBlock(id, block.id, { url });
  }

  async function onPaste(event: ClipboardEvent): Promise<void> {
    const file = imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    const url = await readImageFile(file);
    const afterId = activeBlockId ?? blocks.at(-1)?.id ?? null;
    const newId = addBlock(id, afterId, 'image');
    updateBlock(id, newId, { url });
  }

  // ── Cover ────────────────────────────────────────────────────────
  async function chooseCover(): Promise<void> {
    const url = await pickImageFile();
    if (url) updateBoard(id, { cover: url });
  }

  function setCoverFromUrl(): void {
    showPrompt({ title: 'Cover image', label: 'Image URL', placeholder: 'https://…' }, (value) =>
      updateBoard(id, { cover: value }),
    );
  }

  function removeCover(): void {
    if (board) updateBoard(id, { cover: undefined });
  }

  function setIcon(emoji: string): void {
    updateBoard(id, { icon: emoji });
    iconOpen = false;
  }

  function setIconFromInput(): void {
    showPrompt({ title: 'Board icon', label: 'Emoji or symbol', value: board?.icon ?? '📓' }, (value) =>
      updateBoard(id, { icon: [...value][0] ?? '📓' }),
    );
    iconOpen = false;
  }

  // ── Drag to reorder ──────────────────────────────────────────────
  function onDragStart(block: Block, event: DragEvent): void {
    dragId = block.id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', block.id);
    }
  }
  function onDragOver(index: number, event: DragEvent): void {
    if (!dragId) return;
    event.preventDefault();
    dragOverIndex = index;
  }
  function onDrop(index: number, event: DragEvent): void {
    event.preventDefault();
    if (dragId) reorderBlock(id, dragId, index);
    dragId = null;
    dragOverIndex = null;
  }
  function onDragEnd(): void {
    dragId = null;
    dragOverIndex = null;
  }

  function numberFor(index: number): number {
    let n = 1;
    for (let i = index - 1; i >= 0; i--) {
      if (blocks[i].type === 'numbered') n++;
      else break;
    }
    return n;
  }
</script>

{#if !board}
  <div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <i class="bx bx-book text-4xl text-zinc-600"></i>
    <p class="text-[13px] text-zinc-500">This board no longer exists.</p>
    <button class="text-[12px] text-[var(--color-accent2)] underline" onclick={goHome}>Back to home</button>
  </div>
{:else}
  <div class="mx-auto max-w-3xl" style="font-family: {fontFamily}" onpaste={onPaste}>
    <!-- Breadcrumb row -->
    <div class="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
      <button class="hover:text-white" onclick={goHome}>Home</button>
      <i class="bx bx-chevron-right"></i>
      <span class="truncate text-zinc-400">{board.title || 'Untitled'}</span>
      <div class="ml-auto flex items-center gap-1">
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-lg transition-colors hover:bg-white/10 {board.favorite
            ? 'text-[var(--color-accent2)]'
            : 'text-zinc-400'}"
          title={board.favorite ? 'Remove from favorites' : 'Add to favorites'}
          onclick={() => toggleFavorite(id)}
        >
          <i class="bx {board.favorite ? 'bxs-star' : 'bx-star'}"></i>
        </button>
      </div>
    </div>

    <!-- Cover -->
    {#if board.cover}
      <div class="group relative mb-3 h-44 w-full overflow-hidden rounded-xl">
        <img src={board.cover} alt="" class="h-full w-full object-cover" />
        <div class="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            class="rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/70"
            onclick={chooseCover}
          >
            Change
          </button>
          <button
            class="rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/70"
            onclick={removeCover}
          >
            Remove
          </button>
        </div>
      </div>
    {:else}
      <div class="mb-3 flex gap-2 opacity-0 transition-opacity hover:opacity-100">
        <button
          class="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.1] hover:text-white"
          onclick={chooseCover}
        >
          <i class="bx bx-image-add"></i> Add cover
        </button>
        <button
          class="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.1] hover:text-white"
          onclick={setCoverFromUrl}
        >
          <i class="bx bx-link"></i> From URL
        </button>
      </div>
    {/if}

    <!-- Icon + title -->
    <div class="relative mb-4 flex items-start gap-3">
      <div class="relative">
        <button
          class="flex h-14 w-14 items-center justify-center rounded-xl text-4xl transition-colors hover:bg-white/5"
          title="Change icon"
          onclick={() => (iconOpen = !iconOpen)}
        >
          <span>{board.icon || '📓'}</span>
        </button>
        {#if iconOpen}
          <div class="absolute left-0 top-16 z-40 w-64 rounded-xl border border-white/10 bg-[var(--color-elevated)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            <div class="grid grid-cols-6 gap-1">
              {#each EMOJIS as emoji (emoji)}
                <button
                  class="flex h-9 items-center justify-center rounded-lg text-xl hover:bg-white/10"
                  onclick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              {/each}
            </div>
            <button
              class="mt-1 w-full rounded-lg bg-white/[0.05] py-1.5 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white"
              onclick={setIconFromInput}
            >
              Custom…
            </button>
          </div>
        {/if}
      </div>
      <textarea
        aria-label="Board title"
        class="mt-1 w-full resize-none overflow-hidden bg-transparent text-[34px] font-extrabold leading-tight tracking-tight text-white outline-none placeholder:text-zinc-600"
        rows="1"
        placeholder="Untitled"
        value={board.title}
        use:autosize
        oninput={onTitleInput}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const first = blocks[0];
            if (first) void focusBlock(first.id, 'start');
          }
        }}
      ></textarea>
    </div>

    <!-- Blocks -->
    <div class="pb-40" role="list">
      {#each blocks as block, index (block.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          role="listitem"
          class="group relative flex items-start gap-1 rounded-lg {dragOverIndex === index ? 'before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-[var(--color-accent)]' : ''} {dragId === block.id ? 'opacity-40' : ''}"
          ondragover={(e) => onDragOver(index, e)}
          ondrop={(e) => onDrop(index, e)}
        >
          <!-- Hover gutter: add + handle -->
          <div class="flex w-8 shrink-0 items-center justify-center gap-0.5 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="flex h-6 w-6 items-center justify-center rounded-md text-base text-zinc-500 hover:bg-white/10 hover:text-white"
              title="Add block below"
              onclick={() => addAfter(block.id)}
            >
              <i class="bx bx-plus"></i>
            </button>
            <button
              class="flex h-6 w-4 cursor-grab items-center justify-center text-base text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
              title="Drag to move · click for options"
              draggable="true"
              ondragstart={(e) => onDragStart(block, e)}
              ondragend={onDragEnd}
              onclick={(e) => openBlockMenu(block, index, e)}
            >
              <i class="bx bx-dots-vertical-rounded"></i>
            </button>
          </div>

          <!-- Block body -->
          <div class="min-w-0 flex-1 py-0.5">
            {#if block.type === 'divider'}
              <div class="py-3"><hr class="border-white/10" /></div>
            {:else if block.type === 'image'}
              {#if block.url}
                <div class="group/img relative my-1 overflow-hidden rounded-lg border border-white/10">
                  <img src={block.url} alt="" class="max-h-[28rem] w-full object-contain" />
                  <div class="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover/img:opacity-100">
                    <button
                      class="rounded-md bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/70"
                      onclick={() => chooseImageFor(block)}
                    >
                      Replace
                    </button>
                    <button
                      class="rounded-md bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/70"
                      onclick={() => updateBlock(id, block.id, { url: undefined })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                <div
                  class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-10 text-zinc-500 transition hover:border-[var(--color-accent)]/40 hover:text-white"
                  role="button"
                  tabindex="0"
                  onclick={() => chooseImageFor(block)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') chooseImageFor(block);
                  }}
                  ondrop={(e) => {
                    const file = e.dataTransfer?.files?.[0];
                    if (file) setBlockImage(block, file);
                  }}
                  ondragover={(e) => e.preventDefault()}
                >
                  <i class="bx bx-image-add text-2xl"></i>
                  <span class="text-[12px]">Click to add an image (or paste one)</span>
                </div>
              {/if}
            {:else if block.type === 'todo'}
              <div class="flex items-start gap-2">
                <button
                  class="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border {block.checked
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                    : 'border-white/25 text-transparent hover:border-white/50'}"
                  aria-label={block.checked ? 'Mark as not done' : 'Mark as done'}
                  onclick={() => updateBlock(id, block.id, { checked: !block.checked })}
                >
                  <i class="bx bx-check text-[12px]"></i>
                </button>
                <textarea
                  id={`block-${block.id}`}
                  class="w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-zinc-600 {block.checked
                    ? 'text-zinc-500 line-through'
                    : 'text-zinc-100'}"
                  rows="1"
                  placeholder="To-do"
                  value={block.text}
                  use:autosize
                  onfocus={() => (activeBlockId = block.id)}
                  oninput={(e) => onBlockInput(block, e)}
                  onkeydown={(e) => onKeyDown(block, index, e)}
                ></textarea>
              </div>
            {:else if block.type === 'bulleted'}
              <div class="flex items-start gap-2">
                <span class="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"></span>
                <textarea
                  id={`block-${block.id}`}
                  class="w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                  rows="1"
                  placeholder="List item"
                  value={block.text}
                  use:autosize
                  onfocus={() => (activeBlockId = block.id)}
                  oninput={(e) => onBlockInput(block, e)}
                  onkeydown={(e) => onKeyDown(block, index, e)}
                ></textarea>
              </div>
            {:else if block.type === 'numbered'}
              <div class="flex items-start gap-2">
                <span class="mt-0.5 min-w-4 shrink-0 text-right text-[15px] text-zinc-400">{numberFor(index)}.</span>
                <textarea
                  id={`block-${block.id}`}
                  class="w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                  rows="1"
                  placeholder="List item"
                  value={block.text}
                  use:autosize
                  onfocus={() => (activeBlockId = block.id)}
                  oninput={(e) => onBlockInput(block, e)}
                  onkeydown={(e) => onKeyDown(block, index, e)}
                ></textarea>
              </div>
            {:else if block.type === 'quote'}
              <div class="border-l-2 border-[var(--color-accent)]/60 pl-3">
                <textarea
                  id={`block-${block.id}`}
                  class="w-full resize-none overflow-hidden bg-transparent text-[15px] italic leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600"
                  rows="1"
                  placeholder="Quote"
                  value={block.text}
                  use:autosize
                  onfocus={() => (activeBlockId = block.id)}
                  oninput={(e) => onBlockInput(block, e)}
                  onkeydown={(e) => onKeyDown(block, index, e)}
                ></textarea>
              </div>
            {:else if block.type === 'callout'}
              <div class="flex items-start gap-2 rounded-lg bg-[var(--color-accent)]/10 px-3 py-2">
                <i class="bx bx-bulb mt-0.5 shrink-0 text-lg text-[var(--color-accent2)]"></i>
                <textarea
                  id={`block-${block.id}`}
                  class="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500"
                  rows="1"
                  placeholder="Callout"
                  value={block.text}
                  use:autosize
                  onfocus={() => (activeBlockId = block.id)}
                  oninput={(e) => onBlockInput(block, e)}
                  onkeydown={(e) => onKeyDown(block, index, e)}
                ></textarea>
              </div>
            {:else if block.type === 'code'}
              <textarea
                id={`block-${block.id}`}
                class="w-full resize-none overflow-hidden rounded-lg bg-black/40 px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                rows="1"
                placeholder="Code"
                value={block.text}
                use:autosize
                spellcheck="false"
                onfocus={() => (activeBlockId = block.id)}
                oninput={(e) => onBlockInput(block, e)}
                onkeydown={(e) => onKeyDown(block, index, e)}
              ></textarea>
            {:else if block.type === 'heading1'}
              <textarea
                id={`block-${block.id}`}
                class="w-full resize-none overflow-hidden bg-transparent text-[26px] font-bold leading-tight text-white outline-none placeholder:text-zinc-600"
                rows="1"
                placeholder="Heading 1"
                value={block.text}
                use:autosize
                onfocus={() => (activeBlockId = block.id)}
                oninput={(e) => onBlockInput(block, e)}
                onkeydown={(e) => onKeyDown(block, index, e)}
              ></textarea>
            {:else if block.type === 'heading2'}
              <textarea
                id={`block-${block.id}`}
                class="w-full resize-none overflow-hidden bg-transparent text-[21px] font-bold leading-tight text-white outline-none placeholder:text-zinc-600"
                rows="1"
                placeholder="Heading 2"
                value={block.text}
                use:autosize
                onfocus={() => (activeBlockId = block.id)}
                oninput={(e) => onBlockInput(block, e)}
                onkeydown={(e) => onKeyDown(block, index, e)}
              ></textarea>
            {:else if block.type === 'heading3'}
              <textarea
                id={`block-${block.id}`}
                class="w-full resize-none overflow-hidden bg-transparent text-[17px] font-semibold leading-tight text-white outline-none placeholder:text-zinc-600"
                rows="1"
                placeholder="Heading 3"
                value={block.text}
                use:autosize
                onfocus={() => (activeBlockId = block.id)}
                oninput={(e) => onBlockInput(block, e)}
                onkeydown={(e) => onKeyDown(block, index, e)}
              ></textarea>
            {:else}
              <textarea
                id={`block-${block.id}`}
                class="w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                rows="1"
                placeholder="Type '/' for commands"
                value={block.text}
                use:autosize
                onfocus={() => (activeBlockId = block.id)}
                oninput={(e) => onBlockInput(block, e)}
                onkeydown={(e) => onKeyDown(block, index, e)}
              ></textarea>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Add block -->
      <div class="group flex items-start gap-1">
        <div class="flex w-8 shrink-0 justify-center pt-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            class="flex h-6 w-6 items-center justify-center rounded-md text-base text-zinc-500 hover:bg-white/10 hover:text-white"
            title="Add block"
            onclick={() => addAfter(blocks.at(-1)?.id ?? null)}
          >
            <i class="bx bx-plus"></i>
          </button>
        </div>
        <button
          class="flex-1 cursor-text py-2 text-left text-[15px] text-zinc-600 hover:text-zinc-400"
          onclick={() => addAfter(blocks.at(-1)?.id ?? null)}
        >
          Click here to continue writing…
        </button>
      </div>
    </div>
  </div>
{/if}
