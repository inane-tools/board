// Context-menu builders for boards, shared by the sidebar, the canvas nodes and
// the title bar so the same actions are available everywhere.

import type { Board, BoardKind } from '$lib/core/board';
import { createBoard, deleteBoard, toggleFavorite, updateBoard } from './library';
import { openBoard } from './navigation';
import { openContextMenu } from './contextMenu';
import { showConfirm, showPrompt } from './dialogs';

/** Create a child board of `parentId` (or the root) and open it. */
export function newBoard(kind: BoardKind, parentId: string | null): Board {
  const board = createBoard(kind, parentId);
  openBoard(board.id);
  return board;
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
    { label: 'Rename', icon: 'bx bx-pencil', action: () => renameBoard(board) },
    {
      label: 'Change icon',
      icon: 'bx bx-smile',
      action: () =>
        showPrompt({ title: 'Board icon', label: 'Emoji or symbol', value: board.icon }, (value) =>
          updateBoard(board.id, { icon: [...value][0] ?? board.icon }),
        ),
    },
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

export function renameBoard(board: Board): void {
  showPrompt({ title: 'Rename', label: 'Name', value: board.title }, (value) =>
    updateBoard(board.id, { title: value }),
  );
}

export function addTagToBoard(board: Board): void {
  showPrompt({ title: 'Add tag', label: 'Tag (searched with @tag)', placeholder: 'idea' }, (raw) => {
    const tag = raw.replace(/^@/, '').trim();
    if (!tag) return;
    updateBoard(board.id, { tags: [...new Set([...(board.tags ?? []), tag])] });
  });
}

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
