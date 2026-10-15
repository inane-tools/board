<script lang="ts">
  import { boardsStore, tagDefinitions, editTag, deleteTag, updateBoard, updateMoodItem } from '$lib/app/services/library';
  import { collectTags, normalizeTag, tagColor } from '$lib/core/tags';
  import { tagEditor, closeTagEditor } from '$lib/app/services/tagEditor';
  import { showConfirm } from '$lib/app/services/dialogs';
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';
  import DialogHeader from './DialogHeader.svelte';
  let name = ''; let color = '#60a5fa'; let error = '';
  $: names = collectTags($boardsStore, $tagDefinitions);
  $: board = $boardsStore.find(board => board.id === $tagEditor?.boardId);
  $: target = $tagEditor?.itemId ? board?.items.find(item => item.id === $tagEditor?.itemId) : board;
  $: targets = $tagEditor?.itemIds ? board?.items.filter(item => $tagEditor?.itemIds?.includes(item.id)) ?? [] : target ? [target] : [];
  function assign(tag: string) {
    if (!$tagEditor || !targets.length) return;
    const remove = targets.every(value => value.tags?.includes(tag));
    for (const value of targets) {
      const tags = remove ? value.tags?.filter(name => name !== tag) ?? [] : [...new Set([...value.tags ?? [], tag])];
      if ($tagEditor.itemIds || $tagEditor.itemId) updateMoodItem($tagEditor.boardId, value.id, { tags });
      else updateBoard($tagEditor.boardId, { tags });
    }
  }

  function create() {
    const tag = normalizeTag(name);
    if (!tag) { error = 'Enter a tag name.'; return; }
    if (names.includes(tag)) { error = 'A tag with that name already exists.'; return; }
    editTag(tag, tag, color); assign(tag); name = ''; error = '';
  }
  function rename(old: string, input: HTMLInputElement) {
    const next = normalizeTag(input.value);
    if (!next || (next !== old && names.includes(next))) { error = 'Use a unique, nonempty tag name.'; input.value = old; return; }
    editTag(old, next, tagColor(old, $tagDefinitions)); error = '';
  }
</script>
{#if $tagEditor}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-4" onclick={closeTagEditor} role="presentation">
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="flex max-h-[85%] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-2xl" role="dialog" aria-modal="true" aria-label="Tag editor" tabindex="-1" use:dialogFocus={closeTagEditor} onclick={(event) => event.stopPropagation()}>
      <DialogHeader title="Tags" description={$tagEditor.itemIds ? 'Organize the selected items. Names and colors are shared across Board.' : $tagEditor.itemId ? 'Organize this item. Names and colors are shared across Board.' : 'Organize this board. Names and colors are shared across Board.'} onClose={closeTagEditor} />
      <div class="journal-overlay-scroll min-h-0 flex-1 space-y-2 px-6 pb-4" use:overlayScrollbar={{ topInset: 0 }}>
        {#each names as tag (tag)}
          <div class="flex items-center gap-2 rounded-xl bg-[var(--color-card)] p-2">
            <input type="checkbox" checked={targets.length > 0 && targets.every(value => value.tags?.includes(tag))} onchange={() => assign(tag)} aria-label={'Assign @' + tag} class="h-4 w-4 accent-[var(--color-accent)]" />
            <input type="color" value={tagColor(tag, $tagDefinitions)} onchange={(event) => editTag(tag, tag, event.currentTarget.value)} aria-label={'Color for @' + tag} class="h-7 w-8 shrink-0 cursor-pointer border-0 bg-transparent" />
            <input value={tag} onchange={(event) => rename(tag, event.currentTarget)} aria-label={'Name for @' + tag} class="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[12px] text-zinc-200 outline-none focus:bg-white/5" />
            <button class="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-red-500/15 hover:text-red-400" aria-label={'Delete @' + tag} onclick={() => showConfirm({ title: 'Delete tag?', message: '@' + tag + ' will be removed from every board and item. The content itself will remain.', confirmLabel: 'Delete tag', destructive: true }, () => deleteTag(tag))}><i class="bx bx-trash"></i></button>
          </div>
        {:else}<p class="py-4 text-[12px] text-zinc-500">No tags yet. Create your first below.</p>{/each}
      </div>
      <form class="flex items-center gap-2 border-t border-white/5 px-6 py-4" onsubmit={(event) => { event.preventDefault(); create(); }}>
        <input type="color" bind:value={color} aria-label="New tag color" class="h-8 w-9 cursor-pointer border-0 bg-transparent" />
        <input bind:value={name} placeholder="New tag name" aria-label="New tag name" class="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[12px] text-zinc-200 outline-none" />
        <button class="rounded-full bg-[var(--color-accent)] px-4 py-2 text-[12px] font-semibold text-white" type="submit">Add</button>
      </form>
      {#if error}<p role="alert" class="px-6 pb-4 text-[12px] text-red-400">{error}</p>{/if}
    </div>
  </div>
{/if}
