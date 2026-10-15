export interface MediaUrl { url: string; name: string; kind: 'image' | 'video'; }
/** Match the URL path, ignoring query strings and fragments (including signed URLs). */
export function mediaUrl(raw: string): MediaUrl | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const name = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const extension = name.split('.').pop()?.toLowerCase();
    if (extension && ['jpg','jpeg','png','gif','webp','bmp','avif'].includes(extension)) return { url: url.href, name, kind: 'image' };
    if (extension && ['mp4','webm','mov','m4v','ogv'].includes(extension)) return { url: url.href, name, kind: 'video' };
  } catch { /* Not a supported direct-media URL. */ }
  return null;
}
export function droppedLink(uriList: string, text: string): string {
  const urls = uriList.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  return urls[0] ?? text.trim();
}
