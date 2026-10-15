import { writable } from 'svelte/store';
import type { Board, BoardKind } from '$lib/core/board';
import type { Point } from '$lib/core/boardLayout';
export interface BoardEditorState { kind: BoardKind; board?: Board; parentId: string | null; center?: Point; onCreated?: (board: Board) => void; }
export const boardEditor = writable<BoardEditorState | null>(null);
export function editBoardDetails(board: Board): void { boardEditor.set({ kind: board.kind, board, parentId: board.parentId }); }
export function createBoardDetails(kind: BoardKind, parentId: string | null, center?: Point, onCreated?: (board: Board) => void): void { boardEditor.set({ kind, parentId, center, onCreated }); }
export function closeBoardEditor(): void { boardEditor.set(null); }
