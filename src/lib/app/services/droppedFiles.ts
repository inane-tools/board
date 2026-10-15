/** Read every directory batch: Chromium can return only 100 entries per call. */
export async function readDroppedFiles(transfer: DataTransfer): Promise<{ files: File[]; errors: string[] }> {
  // Capture entries synchronously while the drop event's data store is readable.
  const entries: FileSystemEntry[] = [];
  const files: File[] = [];
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else { const file = item.getAsFile(); if (file) files.push(file); }
  }
  if (!entries.length && !files.length) files.push(...Array.from(transfer.files));
  const errors: string[] = [];
  const pending = [...entries].reverse();
  while (pending.length) {
    const entry = pending.pop()!;
    try {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const children: FileSystemEntry[] = [];
        while (true) {
          let batch: FileSystemEntry[];
          try { batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject)); }
          catch { errors.push(entry.fullPath || entry.name); break; }
          if (!batch.length) break;
          children.push(...batch);
        }
        // Preserve any entries already read even if a later sibling is unreadable.
        for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
      }
    } catch { errors.push(entry.fullPath || entry.name); }
  }
  return { files, errors };
}
