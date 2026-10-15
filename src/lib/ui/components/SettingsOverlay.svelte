<script lang="ts">
  import { dialogFocus } from '$lib/ui/actions/dialogFocus';
  import { fade, fly } from '$lib/ui/transitions';
  import { settingsStore, updateSettings } from '$lib/app/services/settings';
  import { closeSettings, settingsOpen } from '$lib/app/services/overlays';
  import { previewCustomAccent } from '$lib/app/services/theme';
  import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, ZOOM_STEPS, zoomFillPercent, applyZoom } from '$lib/app/services/zoom';
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
  let zoomDraft: number | null = null;
  $: zoomValue = zoomDraft ?? $settingsStore.uiZoom;
  const accentPresets = ['#ff4d5e', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6'];

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

  const dependencies = [
    { name: 'drag-rs', use: 'native drag-out support', license: 'MIT / Apache-2.0', url: 'https://github.com/crabnebula-dev/drag-rs' },
    { name: 'clipboard-win', use: 'Windows file clipboard', license: 'BSL-1.0', url: 'https://github.com/DoumanAsh/clipboard-win' },
    { name: 'arboard', use: 'native clipboard via Tauri', license: 'MIT / Apache-2.0', url: 'https://github.com/1Password/arboard' },
  {
    "name": "Tauri",
    "use": "desktop shell, window controls and OS integration",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/tauri-apps/tauri"
  },
  {
    "name": "Tauri plugins",
    "use": "local store, external links, process and single-instance support",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/tauri-apps/plugins-workspace"
  },
  {
    "name": "Svelte",
    "use": "UI framework",
    "license": "MIT",
    "url": "https://github.com/sveltejs/svelte"
  },
  {
    "name": "Vite",
    "use": "frontend build tooling",
    "license": "MIT",
    "url": "https://github.com/vitejs/vite"
  },
  {
    "name": "Vitest",
    "use": "unit testing",
    "license": "MIT",
    "url": "https://github.com/vitest-dev/vitest"
  },
  {
    "name": "jsdom",
    "use": "DOM for unit tests",
    "license": "MIT",
    "url": "https://github.com/jsdom/jsdom"
  },
  {
    "name": "TypeScript",
    "use": "frontend type checking",
    "license": "Apache-2.0",
    "url": "https://github.com/microsoft/TypeScript"
  },
  {
    "name": "Tailwind CSS",
    "use": "styling",
    "license": "MIT",
    "url": "https://github.com/tailwindlabs/tailwindcss"
  },
  {
    "name": "Boxicons",
    "use": "icons and icon font",
    "license": "CC BY 4.0 / OFL-1.1 / MIT",
    "url": "https://github.com/atisawd/boxicons"
  },
  {
    "name": "Gabarito",
    "use": "typeface (via Fontsource)",
    "license": "OFL-1.1",
    "url": "https://github.com/googlefonts/gabarito"
  },
  {
    "name": "Serde / serde_json",
    "use": "library and settings serialization",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/serde-rs/serde"
  },
  {
    "name": "reqwest",
    "use": "HTTP requests for link previews",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/seanmonstar/reqwest"
  },
  {
    "name": "Tokio",
    "use": "Rust async runtime",
    "license": "MIT",
    "url": "https://github.com/tokio-rs/tokio"
  },
  {
    "name": "regex",
    "use": "link preview metadata parsing",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/rust-lang/regex"
  },
  {
    "name": "base64",
    "use": "imported file encoding",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/marshallpierce/rust-base64"
  },
  {
    "name": "webview2-com",
    "use": "WebView2 memory management",
    "license": "MIT",
    "url": "https://github.com/wravery/webview2-rs"
  },
  {
    "name": "windows-rs",
    "use": "Windows API bindings",
    "license": "MIT / Apache-2.0",
    "url": "https://github.com/microsoft/windows-rs"
  }
];

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
      class="relative flex max-h-[88%] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--color-popover)] shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
      use:dialogFocus={closeSettings}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: -12, duration: 180 }}
      out:fade={{ duration: 120 }}
    >
      <button
        class="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
        aria-label="Close settings"
        onclick={closeSettings}
      >
        <i class="bx bx-x text-xl"></i>
      </button>
      <div use:overlayScrollbar={{ topInset: 0 }} class="journal-overlay-scroll min-h-0 flex-1 space-y-3 p-6">
        <header class="pb-1 pr-8">
          <h2 class="text-[26px] font-extrabold tracking-tight text-white sm:text-[30px]">Settings</h2>
          <p class="mt-0.5 text-[12px] text-zinc-500">Appearance, editor and app information.</p>
        </header>
        <SettingsSection title="Appearance" description="Tweak the zoom, theme and layout of Board." collapsible open>
          <div class="flex flex-col gap-5">
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="text-[12px] font-semibold text-zinc-200">Zoom</span>
                <span class="text-[11px] tabular-nums text-zinc-500">{Math.round(zoomValue * 100)}%</span>
              </div>
              <input class="journal-range w-full" type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoomValue} style="--fill: {zoomFillPercent(zoomValue)}%" aria-label="UI zoom"
                oninput={(event) => { zoomDraft = Number(event.currentTarget.value); applyZoom(zoomDraft); }}
                onchange={() => { if (zoomDraft !== null) { void updateSettings({ uiZoom: zoomDraft }); zoomDraft = null; } }} />
              <div class="pointer-events-none mt-1.5 flex justify-between px-[6px]">
                {#each ZOOM_STEPS as step (step)}<span class="h-1.5 w-px rounded-full {Math.abs(step - zoomValue) < ZOOM_STEP / 2 ? 'bg-[var(--color-accent2)]' : 'bg-white/15'}"></span>{/each}
              </div>
            </div>
            <div>
              <div class="mb-2 text-[12px] font-semibold text-zinc-200">Theme</div>
              <div class="flex gap-1 rounded-xl bg-white/[0.03] p-1">
                {#each themeOptions as option (option.value)}
                  <button class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-colors {$settingsStore.theme === option.value ? 'bg-[var(--color-accent)] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}" aria-pressed={$settingsStore.theme === option.value} onclick={() => setTheme(option.value)}><i class="bx {option.value === 'system' ? 'bx-desktop' : option.value === 'light' ? 'bx-sun' : 'bx-moon'}" aria-hidden="true"></i>{option.label}</button>
                {/each}
              </div>
            </div>
            <div>
              <div class="mb-2 text-[12px] font-semibold text-zinc-200">Accent colour</div>
              <div class="flex flex-wrap items-center gap-2">
                <input bind:this={accentInput} type="color" aria-label="Accent colour" value={$settingsStore.accentColor} class="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent" oninput={previewAccent} onchange={commitAccent} />
                <div class="flex flex-wrap items-center gap-1.5">
                  {#each accentPresets as preset (preset)}<button class="h-6 w-6 rounded-full border border-white/15 transition-transform hover:scale-110" style="background: {preset}" title={preset} aria-label={'Accent ' + preset} aria-pressed={$settingsStore.accentColor.toLowerCase() === preset} onclick={() => updateSettings({ accentColor: preset })}></button>{/each}
                </div>
              </div>
            </div>
            <div>
              <div class="mb-2 text-[12px] font-semibold text-zinc-200">Window controls</div>
              <label class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2 text-[12px] text-zinc-300"><i class="bx bx-window shrink-0 text-sm text-zinc-500" aria-hidden="true"></i>Show window controls</span>
                <Toggle checked={$settingsStore.windowControls} label="Show window controls" onchange={(value) => updateSettings({ windowControls: value })} />
              </label>
            </div>
            <div>
              <div class="mb-2 text-[12px] font-semibold text-zinc-200">Background</div>
              <label class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2 text-[12px] text-zinc-300"><i class="bx bx-color-fill shrink-0 text-sm text-zinc-500" aria-hidden="true"></i>Tint surfaces with accent</span>
                <Toggle checked={$settingsStore.tintedBackground} label="Tinted surfaces" onchange={(value) => updateSettings({ tintedBackground: value })} />
              </label>
            </div>
            <div>
              <div class="mb-2 text-[12px] font-semibold text-zinc-200">Layout</div>
              <div class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2 text-[12px] text-zinc-300"><i class="bx bx-dock-bottom shrink-0 text-sm text-zinc-500" aria-hidden="true"></i>Board toolbar</span>
                <Dropdown value={$settingsStore.boardToolbar} options={toolbarOptions} onchange={(value) => updateSettings({ boardToolbar: value as 'bottom' | 'top' | 'left' | 'right' | 'off' })} ariaLabel="Board toolbar position" />
              </div>
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

        <SettingsSection
          title="Open Source &amp; Contributors"
          description="The projects Board is built on, and the people who helped."
          collapsible
        >
          <ul class="grid grid-cols-1 gap-x-6 text-[11px] text-zinc-400 sm:grid-cols-2">
            {#each dependencies as dep}
              <li class="flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.04] py-2">
                <a
                  class="shrink-0 font-medium text-zinc-300 transition-colors hover:text-white"
                  href={dep.url}
                  title={dep.use}
                  onclick={(event) => { event.preventDefault(); openExternal(dep.url); }}
                >{dep.name}</a>
                <span class="truncate text-right text-[10px] text-zinc-600" title={dep.use + ' · ' + dep.license}>{dep.license}</span>
              </li>
            {/each}
          </ul>
          <div class="mt-4 border-t border-white/[0.06] pt-3">
            <h3 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Contributors</h3>
            <p class="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
              <a class="font-semibold text-[var(--color-accent2)] hover:underline" href="https://inane.tools" onclick={(event) => { event.preventDefault(); openExternal('https://inane.tools'); }}>inane.tools</a> — design and development.
            </p>
            <p class="mt-1.5 text-[11px] leading-relaxed text-zinc-400"><span class="font-semibold text-zinc-300">DeepSeek</span> — assisted with the initial Board implementation.</p>
            <p class="mt-1.5 text-[11px] leading-relaxed text-zinc-400"><span class="font-semibold text-zinc-300">Codex (OpenAI)</span> — repository migration, code review, data-safety fixes, regression tests and UI refinements.</p>
            <p class="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
              Board's shared frontend and desktop shell are based on
              <a class="font-semibold text-[var(--color-accent2)] hover:underline" href="https://github.com/inane-tools/cherry" onclick={(event) => { event.preventDefault(); openExternal('https://github.com/inane-tools/cherry'); }}>Cherry</a>.
              Thanks to its contributors and the open-source projects behind both apps.
            </p>
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
