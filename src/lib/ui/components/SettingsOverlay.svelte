<script lang="ts">
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { fade, fly } from '$lib/ui/transitions';
  import { settingsStore, updateSettings } from '$lib/app/services/settings';
  import { closeSettings, settingsOpen } from '$lib/app/services/overlays';
  import { previewCustomAccent } from '$lib/app/services/theme';
  import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, applyZoom } from '$lib/app/services/zoom';
  import { buildDate, majorMinor, releaseCodename } from '$lib/app/services/release';
  import { openExternal } from '$lib/app/services/openExternal';
  import { overlayScrollbar } from '$lib/ui/actions/overlayScrollbar';
  import SettingsSection from './SettingsSection.svelte';
  import Toggle from './Toggle.svelte';
  import Dropdown from './Dropdown.svelte';
  import logoUrl from '$lib/assets/logo.png';
  import inaneWordmark from '$lib/assets/inane.svg';

  $: codename = releaseCodename(__APP_VERSION__);
  $: shortVersion = majorMinor(__APP_VERSION__);
  $: built = buildDate(__BOARD_BUILD__);

  let accentInput: HTMLInputElement | undefined;

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') closeSettings();
  }

  function setTheme(value: string): void {
    void updateSettings({ theme: value as 'system' | 'light' | 'dark' });
  }

  function previewAccent(): void {
    if (accentInput) previewCustomAccent(accentInput.value);
  }

  function commitAccent(): void {
    if (accentInput) void updateSettings({ accentColor: accentInput.value });
  }

  const themeOptions = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  const fontOptions = [
    { value: 'sans', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'mono', label: 'Mono' },
  ];

  const toolbarOptions = [
    { value: 'bottom', label: 'Bottom' },
    { value: 'top', label: 'Top' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'off', label: 'Off' },
  ];
</script>

<svelte:window onkeydown={onKey} />

{#if $settingsOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="absolute inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-4"
    role="presentation"
    onclick={closeSettings}
    in:fade={{ duration: 150 }}
    out:fade={{ duration: 120 }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="flex max-h-[88%] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
      use:dialogFocus={closeSettings}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: -12, duration: 180 }}
      out:fade={{ duration: 120 }}
    >
      <header class="flex shrink-0 items-start gap-3 px-6 pb-4 pt-6">
        <div class="min-w-0 flex-1">
          <h2 class="text-[26px] font-extrabold tracking-tight text-white sm:text-[30px]">Settings</h2>
          <p class="mt-0.5 text-[12px] text-zinc-500">Appearance, editor and app data.</p>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
          aria-label="Close settings"
          onclick={closeSettings}
        >
          <i class="bx bx-x text-xl"></i>
        </button>
      </header>

      <div use:overlayScrollbar={{ topInset: 0 }} class="journal-overlay-scroll min-h-0 flex-1 space-y-3 px-6 pb-6">
        <SettingsSection title="Appearance" description="Theme and accent colour.">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-[12px] font-semibold text-zinc-300"><i class="bx bx-adjust text-lg" aria-hidden="true"></i>Theme</span>
              <Dropdown value={$settingsStore.theme} options={themeOptions} onchange={setTheme} ariaLabel="Theme" />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-[12px] font-semibold text-zinc-300"><i class="bx bx-palette text-lg" aria-hidden="true"></i>Accent colour</span>
              <div class="flex items-center gap-2">
                <span class="font-mono text-[11px] text-zinc-500">{$settingsStore.accentColor}</span>
                <input
                  bind:this={accentInput}
                  type="color"
                  aria-label="Accent colour"
                  value={$settingsStore.accentColor}
                  class="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                  oninput={previewAccent}
                  onchange={commitAccent}
                />
              </div>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-[12px] font-semibold text-zinc-300"><i class="bx bx-window-alt text-lg" aria-hidden="true"></i>Window controls</span>
              <Toggle
                checked={$settingsStore.windowControls}
                label="Window controls"
                onchange={(v) => updateSettings({ windowControls: v })}
              />
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-[12px] font-semibold text-zinc-300"><i class="bx bx-color-fill text-lg" aria-hidden="true"></i>Tinted surfaces</span>
              <Toggle
                checked={$settingsStore.tintedBackground}
                label="Tinted surfaces"
                onchange={(v) => updateSettings({ tintedBackground: v })}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Editor" description="How journals are typed.">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[12px] text-zinc-300">Editor font</span>
              <Dropdown
                value={$settingsStore.editorFont}
                options={fontOptions}
                onchange={(v) => updateSettings({ editorFont: v as 'sans' | 'serif' | 'mono' })}
                ariaLabel="Editor font"
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Sidebar & window" description="Layout and desktop chrome.">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[12px] text-zinc-300">Board toolbar</span>
              <Dropdown
                value={$settingsStore.boardToolbar}
                options={toolbarOptions}
                onchange={(v) => updateSettings({ boardToolbar: v as 'bottom' | 'top' | 'left' | 'right' | 'off' })}
                ariaLabel="Board toolbar position"
              />
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between">
                <span class="text-[12px] text-zinc-300">Zoom</span>
                <span class="text-[11px] text-zinc-500">{Math.round($settingsStore.uiZoom * 100)}%</span>
              </div>
              <input
                class="journal-range w-full"
                style="--fill: {(($settingsStore.uiZoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={$settingsStore.uiZoom}
                aria-label="Zoom"
                oninput={(e) => applyZoom(Number((e.currentTarget as HTMLInputElement).value))}
                onchange={(e) => updateSettings({ uiZoom: Number((e.currentTarget as HTMLInputElement).value) })}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Developer" description="Tools for troubleshooting.">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[12px] text-zinc-300">Enable DevTools (F12)</span>
            <Toggle
              checked={$settingsStore.devToolsEnabled}
              label="Enable DevTools"
              onchange={(v) => updateSettings({ devToolsEnabled: v })}
            />
          </div>
        </SettingsSection>

        <!-- About -->
        <section class="rounded-xl bg-gradient-to-br from-[var(--color-accent)]/10 to-transparent px-5 py-4">
          <div class="flex items-start gap-3">
            <img src={logoUrl} alt="Board" class="h-10 w-10 shrink-0 rounded-xl shadow-lg" />
            <div class="min-w-0 flex-1">
              <h2 class="text-[18px] font-extrabold tracking-tight text-white sm:text-[20px]">
                Board {shortVersion} <span class="text-[var(--color-accent2)]">{codename}</span>
              </h2>
              <p class="mt-0.5 text-[10px] tabular-nums text-zinc-500">v{__APP_VERSION__} · {built}</p>
            </div>
            <button
              class="flex h-8 shrink-0 items-center gap-1.5 self-center rounded-lg bg-white/[0.06] px-3 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
              title="Releases on GitHub"
              onclick={() => openExternal('https://github.com/inane-tools/board/releases')}
            >
              <i class="bx bxl-github text-base"></i>
              Releases
            </button>
          </div>

          <div class="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <div class="flex items-center gap-1.5">
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
                title="@inanetools on X"
                aria-label="X (Twitter)"
                onclick={() => openExternal('https://x.com/inanetools')}
              >
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path
                    d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
                  />
                </svg>
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
                title="GitHub repository"
                aria-label="GitHub repository"
                onclick={() => openExternal('https://github.com/inane-tools/board')}
              >
                <i class="bx bxl-github text-lg"></i>
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
                title="inane.tools"
                aria-label="inane.tools website"
                onclick={() => openExternal('https://inane.tools')}
              >
                <i class="bx bx-globe text-lg"></i>
              </button>
            </div>
            <img src={inaneWordmark} alt="inane.tools" class="inane-wordmark h-6 w-auto opacity-80" />
          </div>
        </section>
      </div>
    </div>
  </div>
{/if}
