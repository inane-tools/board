<script lang="ts">
  import { tagDefinitions } from '$lib/app/services/library';
  import { tagColor } from '$lib/core/tags';
  export let tags: string[] = [];
</script>
<span class="flex min-w-0 items-center gap-1 overflow-hidden">
  {#each tags as tag (tag)}
    <span class="max-w-24 shrink-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none" style="background: color-mix(in srgb, {tagColor(tag, $tagDefinitions)} 20%, transparent); color: {tagColor(tag, $tagDefinitions)}" title={'@' + tag}>@{tag}</span>
  {/each}
</span>
