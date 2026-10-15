// Accent theming.
//
// The accent is a user-chosen colour (Settings → Appearance). It drives
// `--color-accent` / `--color-accent2` (fills and text) and, when "tinted
// surfaces" is on, a hint of colour mixed into the neutral surface tokens.

import { clampLuminance, fromHex, mix, toHex, washCompanion, type Rgb } from './themeColor';

const DEFAULT_PAIR = {
  accent: { r: 255, g: 77, b: 94 } as Rgb,
  accent2: { r: 255, g: 138, b: 92 } as Rgb,
};

/**
 * The accent is a *fill* colour, so the same value that looks right on the
 * near-black theme reads too heavy on the light one. Track the theme and
 * lighten the accent toward white in light mode.
 */
let lightMode = false;
let current = { accent: DEFAULT_PAIR.accent, accent2: DEFAULT_PAIR.accent2 };

function lighten(c: Rgb, amount: number): Rgb {
  return {
    r: c.r + (255 - c.r) * amount,
    g: c.g + (255 - c.g) * amount,
    b: c.b + (255 - c.b) * amount,
  };
}

function applyAccent(preview = false): void {
  const root = document.documentElement.style;
  const accent = lightMode
    ? clampLuminance(lighten(current.accent, 0.15), 0.4, 0.62)
    : clampLuminance(current.accent, 0.28, 0.6);
  const accent2 = lightMode
    ? clampLuminance(current.accent2, 0.2, 0.55)
    : clampLuminance(current.accent2, 0.55, 1);
  root.setProperty('--color-accent', toHex(accent));
  root.setProperty('--color-accent2', toHex(accent2));
  if (preview) return;
  root.setProperty('--color-wash-secondary', toHex(washCompanion(accent)));
  applySurfaceTint();
}

/** Called by `appearance.ts` when the light/dark theme changes. */
export function setLightMode(on: boolean): void {
  if (lightMode === on) return;
  lightMode = on;
  applyAccent();
}

/** Neutral surface tokens and the base each is derived from per theme. */
const SURFACE_TOKENS: Record<string, { dark: string; light: string }> = {
  '--color-surface': { dark: '#050505', light: '#f4f4f5' },
  '--color-card': { dark: '#1c1c1c', light: '#f4f4f5' },
  '--color-elevated': { dark: '#1a1a1a', light: '#ffffff' },
  '--color-field': { dark: '#1a1a1a', light: '#ffffff' },
  '--color-popover': { dark: '#101010', light: '#ffffff' },
  '--color-art': { dark: '#1c1c1c', light: '#ededf0' },
};

let tinted = false;

/** Called by `appearance.ts` when the "tinted surfaces" option changes. */
export function setTinted(on: boolean): void {
  if (tinted === on) return;
  tinted = on;
  applyAccent();
}

/** Override (or restore) the neutral surface tokens with accent-tinted values. */
function applySurfaceTint(): void {
  const root = document.documentElement.style;
  if (!tinted) {
    for (const token of Object.keys(SURFACE_TOKENS)) root.removeProperty(token);
    return;
  }
  const amount = lightMode ? 0.13 : 0.1;
  for (const [token, base] of Object.entries(SURFACE_TOKENS)) {
    const from = fromHex(lightMode ? base.light : base.dark);
    if (!from) continue;
    root.setProperty(token, toHex(mix(from, current.accent, amount)));
  }
}

function setAccent(colour: Rgb, preview = false): void {
  current = {
    accent: colour,
    accent2: {
      r: Math.min(255, colour.r * 1.25 + 30),
      g: Math.min(255, colour.g * 1.25 + 30),
      b: Math.min(255, colour.b * 1.25 + 30),
    },
  };
  applyAccent(preview);
}

/** Apply a fixed custom accent colour (hex). */
export function applyCustomAccent(hex: string): void {
  setAccent(fromHex(hex) ?? DEFAULT_PAIR.accent);
}

/** Lightweight drag preview; defer backdrop and surface tint until release. */
export function previewCustomAccent(hex: string): void {
  setAccent(fromHex(hex) ?? DEFAULT_PAIR.accent, true);
}
