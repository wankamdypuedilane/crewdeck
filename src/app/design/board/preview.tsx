"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/board/kanban-board";
import { applyMove } from "@/lib/board/moves";
import type { Board, Member } from "@/lib/board/types";

// Keeps moves in local state instead of saving them: the board behaves as in
// the application, without a database.
export function BoardPreview({ initial, members }: { initial: Board; members: Member[] }) {
  const [board, setBoard] = useState(initial);
  return (
    <KanbanBoard
      board={board}
      members={members}
      onMove={async (_input, move) => {
        setBoard((current) => ({ ...current, columns: applyMove(current.columns, move) }));
        return { ok: true };
      }}
    />
  );
}
