<script lang="ts">
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { fade, fly } from '$lib/ui/transitions';
  import { closeConfirm, confirmStore } from '$lib/app/services/dialogs';
  import DialogHeader from './DialogHeader.svelte';

  $: state = $confirmStore;

  function submit(): void {
    const onConfirm = state.onConfirm;
    closeConfirm();
    onConfirm();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') closeConfirm();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if state.open}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/60 p-4"
    role="presentation"
    onclick={closeConfirm}
    in:fade={{ duration: 150 }}
    out:fade={{ duration: 120 }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_30px_80px_rgba(0,0,0,0.72)]"
      use:dialogFocus={closeConfirm}
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: -12, duration: 180 }}
      out:fade={{ duration: 120 }}
    >
      <DialogHeader title={state.title} onClose={closeConfirm} />
      {#if state.message}
        <p class="px-6 text-[13px] leading-relaxed text-zinc-300">{state.message}</p>
      {/if}
      <footer class="flex justify-end gap-2 p-6">
        <button
          class="rounded-lg bg-white/[0.06] px-4 py-2 text-[12px] text-zinc-200 transition-colors hover:bg-white/[0.1]"
          onclick={closeConfirm}
        >
          Cancel
        </button>
        <button
          class="rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition-colors {state.destructive
            ? 'bg-red-600 hover:bg-red-500'
            : 'journal-btn-scrim bg-[var(--color-accent)] hover:bg-[var(--color-accent2)]'}"
          onclick={submit}
        >
          {state.confirmLabel}
        </button>
      </footer>
    </div>
  </div>
{/if}
