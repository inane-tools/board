<script lang="ts">
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { fade, fly } from '$lib/ui/transitions';
  import { closePrompt, promptStore } from '$lib/app/services/dialogs';
  import DialogHeader from './DialogHeader.svelte';

  $: state = $promptStore;
  let value = '';
  let loadedKey = '';

  $: if (state.open) {
    const key = `${state.title}:${state.value}`;
    if (key !== loadedKey) {
      loadedKey = key;
      value = state.value;
      queueMicrotask(() => {
        const input = document.getElementById('prompt-dialog-input');
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
      });
    }
  } else {
    loadedKey = '';
  }

  function submit(): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const onSubmit = state.onSubmit;
    closePrompt();
    onSubmit(trimmed);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') closePrompt();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if state.open}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/60 p-4"
    role="presentation"
    onclick={closePrompt}
    in:fade={{ duration: 150 }}
    out:fade={{ duration: 120 }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_30px_80px_rgba(0,0,0,0.72)]"
      use:dialogFocus={closePrompt}
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: -12, duration: 180 }}
      out:fade={{ duration: 120 }}
    >
      <DialogHeader title={state.title} description={state.label} onClose={closePrompt} />
      <div class="px-6">
        <input
          id="prompt-dialog-input"
          aria-label={state.label || state.title}
          bind:value
          placeholder={state.placeholder}
          class="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-[var(--color-accent)]/60"
          onkeydown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>
      <footer class="flex items-center justify-end gap-2 p-6">
        <button
          class="rounded-lg bg-white/[0.06] px-4 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-white"
          onclick={closePrompt}
        >
          Cancel
        </button>
        <button
          class="journal-btn-scrim rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--color-accent2)] disabled:opacity-40"
          disabled={!value.trim()}
          onclick={submit}
        >
          {state.confirmLabel}
        </button>
      </footer>
    </div>
  </div>
{/if}
