// Image helpers: turn a picked file or a clipboard image into a data URL the
// store can hold. Data URLs keep everything in the library document so there
// are no broken external links, at the cost of a larger file.

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

/** First image on a clipboard payload, if any. */
export function imageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** Open the OS picker and resolve the chosen image as a data URL (or null). */
export function pickImageFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      readImageFile(file).then(resolve, () => resolve(null));
    };
    input.click();
  });
}
