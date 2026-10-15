<script lang="ts">
  import { boardEditor, closeBoardEditor } from '$lib/app/services/boardEditor';
  import { boardsStore, createBoard, updateBoard } from '$lib/app/services/library';
  import { readImageFile } from '$lib/app/services/images';
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';
  import { fade, fly } from '$lib/ui/transitions';
  import DialogHeader from './DialogHeader.svelte';
  let loaded: typeof $boardEditor = null;
  let name = ''; let icon = ''; let cover = ''; let error = ''; let loadingImage = false;
  $: state = $boardEditor;
  $: journal = state?.kind === 'document';
  $: defaultName = journal ? 'Untitled journal' : 'Untitled board';
  $: defaultIcon = journal ? '📓' : '🗂️';
  $: if (state && state !== loaded) { loaded = state; name = state.board?.title ?? ''; icon = state.board?.icon ?? ''; cover = state.board?.cover ?? ''; error = ''; loadingImage = false; }
  $: if (!state) loaded = null;
  async function pickBanner(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    const opening = state; loadingImage = true;
    try { const url = await readImageFile(file); if ($boardEditor === opening) cover = url; }
    catch { if ($boardEditor === opening) error = 'Could not read that image.'; }
    finally { if ($boardEditor === opening) loadingImage = false; }
  }
  function save() {
    if (!state || loadingImage) return;
    const title = name.trim() || state.board?.title || defaultName;
    const nextIcon = icon.trim() || state.board?.icon || defaultIcon;
    if (state.board) {
      if (!$boardsStore.some(board => board.id === state.board!.id)) { error = 'This board no longer exists.'; return; }
      updateBoard(state.board.id, { title, icon: nextIcon, ...(journal ? { cover: cover.trim() || undefined } : {}) });
    } else {
      if (state.parentId && !$boardsStore.some(board => board.id === state.parentId)) { error = 'The parent board no longer exists.'; return; }
      const created = createBoard(state.kind, state.parentId, title, nextIcon, state.center);
      if (journal && cover.trim()) updateBoard(created.id, { cover: cover.trim() });
      state.onCreated?.(created);
    }
    closeBoardEditor();
  }
</script>
{#if state}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/60 p-4" role="presentation" onclick={closeBoardEditor} in:fade={{ duration: 150 }} out:fade={{ duration: 120 }}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="flex max-h-[85%] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_30px_80px_rgba(0,0,0,0.72)]" role="dialog" aria-modal="true" aria-label={(state.board ? 'Edit ' : 'New ') + (journal ? 'journal' : 'board')} tabindex="-1" use:dialogFocus={closeBoardEditor} onclick={(event) => event.stopPropagation()} in:fly={{ y: -12, duration: 180 }} out:fade={{ duration: 120 }}>
      <form class="flex min-h-0 flex-1 flex-col" onsubmit={(event) => { event.preventDefault(); save(); }}>
      <DialogHeader title={(state.board ? 'Edit ' : 'New ') + (journal ? 'journal' : 'board')} description={state.board?.title ?? 'Choose an icon and name, or leave them blank to use the defaults.'} onClose={closeBoardEditor} />
      <div class="journal-overlay-scroll min-h-0 flex-1 space-y-4 px-6" use:overlayScrollbar={{ topInset: 0 }}>
        <div class="flex items-start gap-4">
          <label class="flex w-20 shrink-0 flex-col gap-1.5"><span class="text-[11px] font-medium text-zinc-400">Icon</span><input bind:value={icon} placeholder={defaultIcon} maxlength="32" aria-label="Icon" class="h-20 w-20 rounded-lg border border-white/10 bg-[var(--color-art)] text-center text-4xl outline-none focus:border-[var(--color-accent)]/60" /></label>
          <label class="flex min-w-0 flex-1 flex-col gap-1.5"><span class="text-[11px] font-medium text-zinc-400">Name</span><input bind:value={name} placeholder={defaultName} aria-label="Name" class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[var(--color-accent)]/60" /><span class="text-[10px] leading-relaxed text-zinc-600">Use an emoji or symbol for the icon. Changes apply when you press {state.board ? 'Save' : 'Create'}.</span></label>
        </div>
        {#if journal}
          <div class="space-y-2">
            <span class="text-[11px] font-medium text-zinc-400">Banner image</span>
            <label class="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[var(--color-art)]">
              {#if cover}<img src={cover} alt="Banner preview" class="h-full w-full object-cover" />{:else}<i class="bx bx-image-add text-3xl text-zinc-500"></i>{/if}
              <span class="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><i class="bx bx-upload text-lg"></i>{loadingImage ? 'Loading…' : 'Choose image'}</span>
              <input type="file" accept="image/*" class="sr-only" aria-label="Choose banner image" onchange={pickBanner} disabled={loadingImage} />
            </label>
            <div class="flex items-center gap-2"><input bind:value={cover} type="url" placeholder="Or paste an image URL…" aria-label="Banner image URL" class="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[var(--color-accent)]/60" />{#if cover}<button type="button" class="rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/10" onclick={() => cover = ''}>Remove</button>{/if}</div>
          </div>
        {/if}
        {#if error}<p role="alert" class="text-[12px] text-red-400">{error}</p>{/if}
      </div>
      <footer class="flex shrink-0 items-center justify-end gap-2 p-6"><button type="button" class="rounded-lg bg-white/[0.06] px-4 py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white" onclick={closeBoardEditor}>Cancel</button><button type="submit" disabled={loadingImage} class="journal-btn-scrim rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[var(--color-accent2)] disabled:opacity-40">{state.board ? 'Save' : 'Create'}</button></footer>
      </form>
    </div>
  </div>
{/if}
