// Context-menu builders for boards, shared by the sidebar, the canvas nodes and
// the title bar so the same actions are available everywhere.

import type { Board, BoardKind } from '$lib/core/board';
import { deleteBoard, toggleFavorite } from './library';
import { openBoard } from './navigation';
import { openContextMenu } from './contextMenu';
import { showConfirm } from './dialogs';
import { createBoardDetails, editBoardDetails } from './boardEditor';
import { openTagEditor } from './tagEditor';

/** Create a child board of `parentId` (or the root) and open it. */
export function newBoard(kind: BoardKind, parentId: string | null): void {
  createBoardDetails(kind, parentId, undefined, board => openBoard(board.id));
}

export function boardMenu(event: MouseEvent, board: Board, isRoot = false): void {
  openContextMenu(event, [
    { label: 'Open', icon: 'bx bx-radio-circle-marked', action: () => openBoard(board.id) },
    {
      label: 'New board here',
      icon: 'bx bx-layout',
      action: () => newBoard('canvas', board.kind === 'canvas' ? board.id : board.parentId),
    },
    {
      label: 'New journal here',
      icon: 'bx bx-note',
      action: () => newBoard('document', board.kind === 'canvas' ? board.id : board.parentId),
    },
    {
      label: board.favorite ? 'Remove from favorites' : 'Add to favorites',
      icon: board.favorite ? 'bx bx-star' : 'bx bxs-star',
      separatorBefore: true,
      action: () => toggleFavorite(board.id),
    },
    { label: board.kind === 'document' ? 'Edit journal' : 'Edit board', icon: 'bx bx-pencil', action: () => editBoardDetails(board) },
    { label: 'Add tag…', icon: 'bx bx-purchase-tag', action: () => addTagToBoard(board) },
    ...(isRoot
      ? []
      : [
          {
            label: 'Delete',
            icon: 'bx bx-trash',
            destructive: true,
            separatorBefore: true,
            action: () => confirmDeleteBoard(board),
          },
        ]),
  ]);
}

export function renameBoard(board: Board): void { editBoardDetails(board); }
export function addTagToBoard(board: Board): void { openTagEditor(board.id); }

export function confirmDeleteBoard(board: Board): void {
  showConfirm(
    {
      title: board.kind === 'document' ? 'Delete journal?' : 'Delete board?',
      message: `“${board.title}” and everything inside it will be permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    },
    () => deleteBoard(board.id),
  );
}
