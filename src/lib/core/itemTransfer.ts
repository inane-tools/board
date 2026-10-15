import type { Board, MoodItem } from './board';
export function itemText(item: MoodItem, boards: Board[] = []): string {
  if (item.type === 'board') return boards.find(board => board.id === item.boardId)?.title ?? 'Board';
  if (item.type === 'link') return item.url ?? '';
  if (item.type === 'color') return item.color ?? '';
  return item.text ?? item.name ?? item.url ?? '';
}
export function exportName(item: MoodItem): string {
  if (item.name) return item.name;
  if (item.type === 'image') return 'Image.png';
  if (item.type === 'link') return 'Link.url';
  if (item.type === 'board') return 'Board.json';
  return (item.type === 'todo' ? 'Task' : item.type === 'color' ? 'Color' : 'Note') + '.txt';
}
