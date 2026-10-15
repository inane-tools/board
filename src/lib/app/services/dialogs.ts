// Small promise-free dialog service: one prompt and one confirm dialog live in
// the shell and are driven by these stores, so any surface can ask for a name
// or a confirmation without owning the markup.

import { writable } from 'svelte/store';

export interface PromptState {
  open: boolean;
  title: string;
  label: string;
  value: string;
  placeholder: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
}

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

export const promptStore = writable<PromptState>({
  open: false,
  title: '',
  label: '',
  value: '',
  placeholder: '',
  confirmLabel: 'Save',
  onSubmit: () => {},
});

export const confirmStore = writable<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  destructive: false,
  onConfirm: () => {},
});

export interface PromptOptions {
  title: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
}

export function showPrompt(options: PromptOptions, onSubmit: (value: string) => void): void {
  promptStore.set({
    open: true,
    title: options.title,
    label: options.label ?? '',
    value: options.value ?? '',
    placeholder: options.placeholder ?? '',
    confirmLabel: options.confirmLabel ?? 'Save',
    onSubmit,
  });
}

export function closePrompt(): void {
  promptStore.update((s) => ({ ...s, open: false }));
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function showConfirm(options: ConfirmOptions, onConfirm: () => void): void {
  confirmStore.set({
    open: true,
    title: options.title,
    message: options.message ?? '',
    confirmLabel: options.confirmLabel ?? 'Confirm',
    destructive: options.destructive ?? false,
    onConfirm,
  });
}

export function closeConfirm(): void {
  confirmStore.update((s) => ({ ...s, open: false }));
}
