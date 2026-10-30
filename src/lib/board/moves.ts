import type { Column, Task } from "./types";

export type Move = { taskId: string; toColumnId: string; toIndex: number };

/** Where a task lands, and the ids of its new neighbours (null at the ends). */
export type Placement = { beforeId: string | null; afterId: string | null };

/** Returns new columns with the task moved; the input is never mutated. */
export function applyMove(columns: Column[], move: Move): Column[] {
  let moving: Task | undefined;
  const without = columns.map((column) => {
    const index = column.tasks.findIndex((task) => task.id === move.taskId);
    if (index === -1) return column;
    moving = column.tasks[index];
    return { ...column, tasks: column.tasks.toSpliced(index, 1) };
  });
  if (!moving) return columns;

  return without.map((column) => {
    if (column.id !== move.toColumnId) return column;
    const index = Math.max(0, Math.min(move.toIndex, column.tasks.length));
    const placed = { ...moving!, column_id: column.id };
    return { ...column, tasks: column.tasks.toSpliced(index, 0, placed) };
  });
}

/** The neighbours of a task after `applyMove`, to send to the server. */
export function placementOf(columns: Column[], taskId: string): Placement | null {
  for (const column of columns) {
    const index = column.tasks.findIndex((task) => task.id === taskId);
    if (index === -1) continue;
    return {
      beforeId: column.tasks[index - 1]?.id ?? null,
      afterId: column.tasks[index + 1]?.id ?? null,
    };
  }
  return null;
}

/**
 * Translates a drag-and-drop result into a move. `overId` is either a task id
 * (dropped on a card) or a column id (dropped on a column's empty space).
 */
export function resolveDrop(columns: Column[], activeId: string, overId: string): Move | null {
  if (activeId === overId) return null;
  const target = columns.find((column) => column.id === overId);
  if (target) {
    // On the column itself: append at the end.
    const count = target.tasks.filter((task) => task.id !== activeId).length;
    return { taskId: activeId, toColumnId: target.id, toIndex: count };
  }
  for (const column of columns) {
    const overIndex = column.tasks.findIndex((task) => task.id === overId);
    if (overIndex === -1) continue;
    // Like arrayMove(): the card takes the index of the card it is dropped on,
    // whether it comes from above, from below or from another column.
    return { taskId: activeId, toColumnId: column.id, toIndex: overIndex };
  }
  return null;
}
