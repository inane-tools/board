import type { Board, TagDefinition } from './board';
export function normalizeTag(raw: string): string { return raw.trim().replace(/^@+/, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40); }
export function tagColor(name: string, definitions: TagDefinition[] = []): string {
  const saved = definitions.find(tag => tag.name === name)?.color;
  if (saved && /^#[0-9a-f]{6}$/i.test(saved)) return saved;
  const palette = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6'];
  let hash = 0; for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return palette[hash % palette.length];
}
export function collectTags(boards: Board[], definitions: TagDefinition[]): string[] {
  return [...new Set([...definitions.map(tag => tag.name), ...boards.flatMap(board => [...board.tags ?? [], ...board.items.flatMap(item => item.tags ?? [])])])].sort((a,b) => a.localeCompare(b));
}
