<script lang="ts">
  import { tipStore } from '$lib/app/services/tooltip';

  $: tip = $tipStore;
</script>

{#if tip.show}
  <div
    class="pointer-events-none fixed z-[80] rounded-lg bg-[var(--color-elevated)] px-3 py-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.55)] {tip.placement ===
    'top'
      ? '-translate-x-1/2 -translate-y-full'
      : '-translate-y-1/2'}"
    style="left: {tip.x}px; top: {tip.y}px;"
  >
    <div class="whitespace-nowrap text-[12px] font-medium text-white">{tip.title}</div>
    {#if tip.subtitle}<div class="whitespace-nowrap text-[10px] text-zinc-500">{tip.subtitle}</div>{/if}
  </div>
{/if}
