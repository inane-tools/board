// ── Board core domain ──────────────────────────────────────────────
// Pure types. No Tauri, no DOM imports allowed here.
//
// Everything is a Board. A board is either a freeform canvas (notes, images,
// links, colours and child-board nodes) or a document (the block editor). The
// library is a tree: the unremovable root board is Home, and every other board
// hangs off a parent. A child board is placed on its parent's canvas as a
// `board` item, so opening it is just clicking its node.

/** The kind of content a single editor block holds (Notion-style). */
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** Todo state; only meaningful for `todo` blocks. */
  checked?: boolean;
  /** Image source (data URL or remote URL) for `image` blocks. */
  url?: string;
  /** Optional accent colour for callouts. */
  color?: string;
}

export type MoodItemType =
  | 'note'
  | 'todo'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'text'
  | 'link'
  | 'color'
  | 'board';

export interface MoodItem {
  id: string;
  type: MoodItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stacking order; larger paints on top. */
  z: number;
  text?: string;
  checked?: boolean;
  /** Image/video/audio source or link href. */
  url?: string;
  /** Swatch / card background colour. */
  color?: string;
  /** The child board this node opens; only for `board` items. */
  boardId?: string;
  /** Original file name (files, media). */
  name?: string;
  /** File mime type. */
  mime?: string;
  /** File size in bytes. */
  size?: number;
  /** On-disk asset path (desktop), for opening the original file. */
  path?: string;
  /** Tags for the item, searchable with `@tag`. */
  tags?: string[];
  /** OpenGraph / oEmbed preview data for link items. */
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSite?: string;
}

export type BoardKind = 'canvas' | 'document';

export interface Board {
  id: string;
  /** `null` for the root (Home) board. */
  parentId: string | null;
  kind: BoardKind;
  title: string;
  /** Emoji or symbol shown beside the title. */
  icon: string;
  /** Canvas background tint. */
  color: string;
  /** Cover image (data URL or remote URL), used by documents. */
  cover?: string;
  favorite: boolean;
  /** Tags, searchable with `@tag`. */
  tags?: string[];
  /** Canvas content. */
  items: MoodItem[];
  /** Document content. */
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export interface TagDefinition { name: string; color: string; }

export interface Library {
  tagDefinitions?: TagDefinition[];
  boards: Board[];
}

export const EMPTY_LIBRARY: Library = { boards: [] };

/** A random-enough unique id that also reads fine in the DOM. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh, empty block of the given type. */
export function makeBlock(type: BlockType = 'paragraph', text = ''): Block {
  return {
    id: newId(),
    type,
    text,
    ...(type === 'todo' ? { checked: false } : {}),
  };
}

/** A fresh board. Documents start with one paragraph; canvases start empty. */
export function makeBoard(
  kind: BoardKind,
  parentId: string | null,
  title = kind === 'document' ? 'Untitled journal' : 'Untitled board',
  icon = kind === 'document' ? '📓' : '🗂️',
): Board {
  const now = Date.now();
  return {
    id: newId(),
    parentId,
    kind,
    title,
    icon,
    color: '#1c1c1c',
    favorite: false,
    items: [],
    blocks: kind === 'document' ? [makeBlock('paragraph')] : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function makeMoodItem(
  type: MoodItemType,
  patch: Partial<Omit<MoodItem, 'id' | 'type'>> = {},
): MoodItem {
  const defaults: Record<MoodItemType, Pick<MoodItem, 'width' | 'height'>> = {
    note: { width: 200, height: 140 },
    todo: { width: 220, height: 160 },
    image: { width: 220, height: 220 },
    video: { width: 320, height: 180 },
    audio: { width: 300, height: 110 },
    file: { width: 220, height: 120 },
    text: { width: 280, height: 200 },
    link: { width: 280, height: 210 },
    color: { width: 120, height: 120 },
    board: { width: 240, height: 160 },
  };
  const base: MoodItem = {
    id: newId(),
    type,
    x: 40,
    y: 40,
    z: Date.now(),
    ...defaults[type],
    ...(type === 'note' || type === 'todo' ? { text: '', color: '#26262b' } : {}),
    ...(type === 'link' ? { url: '', text: '' } : {}),
    ...(type === 'color' ? { color: '#ff4d5e' } : {}),
  };
  return { ...base, ...patch };
}

/** The root (Home) board, if it exists. */
export function rootBoard(boards: Board[]): Board | undefined {
  return boards.find((board) => board.parentId === null);
}

/** Direct children of a board. */
export function childrenOf(boards: Board[], parentId: string): Board[] {
  return boards.filter((board) => board.parentId === parentId);
}

/** Every descendant id of a board (not including the board itself). */
export function descendantIds(boards: Board[], id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const child of boards) {
      if (child.parentId !== parent || seen.has(child.id)) continue;
      seen.add(child.id); out.push(child.id); pending.push(child.id);
    }
  }
  return out;
}

/** Short preview text for a document board's card/node. */
export function boardPreview(board: Board): string {
  for (const block of board.blocks) {
    const text = block.text.trim();
    if (text) return text;
  }
  if (board.items.length > 0) return `${board.items.length} items`;
  return board.kind === 'document' ? 'Empty journal' : 'Empty board';
}

/** A host name for display (no `www.`). */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Add a scheme to a bare URL and reject anything that is not http(s). */
export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/** An embeddable player URL for a known provider, or null. */
export function embedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const spotify = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([\w]+)/i);
  if (spotify) return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;
  const soundcloud = /soundcloud\.com\/.+/i.test(url);
  if (soundcloud) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`;
  return null;
}

/** A YouTube thumbnail for a URL, or null. */
export function youtubeThumb(url: string): string | null {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i,
  );
  return yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

export const ITEM_TYPE_LABEL: Record<MoodItemType, string> = {
  note: 'Note',
  todo: 'To-do',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  file: 'File',
  text: 'Text',
  link: 'Link',
  color: 'Colour',
  board: 'Board',
};

/** A human label for an item (used in the item list and search results). */
export function itemLabel(item: MoodItem, boards: Board[] = []): string {
  switch (item.type) {
    case 'board': {
      const child = item.boardId ? boards.find((b) => b.id === item.boardId) : undefined;
      return child?.title || 'Board';
    }
    case 'link':
      return item.ogTitle || item.url || 'Link';
    case 'color':
      return item.color || 'Colour';
    case 'note':
    case 'todo':
      return item.text?.split('\n')[0].slice(0, 60) || ITEM_TYPE_LABEL[item.type];
    default:
      return item.name || ITEM_TYPE_LABEL[item.type];
  }
}

/** A one-line preview for an item. */
export function itemSnippet(item: MoodItem, boards: Board[] = []): string {
  switch (item.type) {
    case 'link':
      return item.url || '';
    case 'note':
    case 'todo':
    case 'text':
      return item.text?.replace(/\s+/g, ' ').slice(0, 90) || '';
    case 'board': {
      const child = item.boardId ? boards.find((b) => b.id === item.boardId) : undefined;
      return child ? (child.kind === 'document' ? 'Journal' : `${child.items.length} items`) : '';
    }
    default:
      return item.name || '';
  }
}

/** All tags used across a set of boards (unique, sorted). */
export function allTags(boards: Board[]): string[] {
  const set = new Set<string>();
  for (const board of boards) {
    for (const tag of board.tags ?? []) set.add(tag);
    for (const item of board.items) for (const tag of item.tags ?? []) set.add(tag);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export const BLOCK_TYPES: BlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'callout',
  'code',
  'divider',
  'image',
];

export const BLOCK_LABELS: Record<BlockType, { label: string; icon: string; hint: string }> = {
  paragraph: { label: 'Text', icon: 'bx bx-text', hint: 'Plain paragraph' },
  heading1: { label: 'Heading 1', icon: 'bx bx-heading', hint: 'Big section title' },
  heading2: { label: 'Heading 2', icon: 'bx bx-heading', hint: 'Medium section title' },
  heading3: { label: 'Heading 3', icon: 'bx bx-heading', hint: 'Small section title' },
  bulleted: { label: 'Bulleted list', icon: 'bx bx-list-ul', hint: 'Simple bullet list' },
  numbered: { label: 'Numbered list', icon: 'bx bx-list-ol', hint: 'Ordered list' },
  todo: { label: 'To-do', icon: 'bx bx-check-square', hint: 'Task with a checkbox' },
  quote: { label: 'Quote', icon: 'bx bxs-quote-alt-left', hint: 'Quoted text' },
  callout: { label: 'Callout', icon: 'bx bx-info-circle', hint: 'Highlighted note' },
  code: { label: 'Code', icon: 'bx bx-code-alt', hint: 'Monospaced code' },
  divider: { label: 'Divider', icon: 'bx bx-minus', hint: 'Horizontal rule' },
  image: { label: 'Image', icon: 'bx bx-image', hint: 'Paste or upload a picture' },
};
