"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { type MoveResult, moveTask } from "@/app/(app)/workspaces/[workspaceId]/boards/[boardId]/actions";
import { applyMove, type Move, placementOf, resolveDrop } from "@/lib/board/moves";
import type { MoveTaskInput } from "@/lib/board/schemas";
import type { Board, Member, Task } from "@/lib/board/types";
import { BoardColumn } from "./board-column";
import { TaskDialog } from "./task-dialog";
import { useBoardRealtime } from "./use-board-realtime";

type KanbanBoardProps = {
  board: Board;
  members: Member[];
  /** Saves a move. Defaults to the Server Action; the design preview passes its own. */
  onMove?: (input: MoveTaskInput, move: Move) => Promise<MoveResult>;
};

const saveMove = (input: MoveTaskInput) => moveTask(input);

export function KanbanBoard({ board, members, onMove = saveMove }: KanbanBoardProps) {
  const router = useRouter();
  useBoardRealtime(board.id);

  // The server's columns, plus moves still in flight. When the transition
  // ends, React drops the optimistic state and shows the refreshed props.
  const [columns, addOptimisticMove] = useOptimistic(board.columns, applyMove);
  const [, startTransition] = useTransition();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const sensors = useSensors(
    // A small distance lets clicks through without starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Space to pick up, arrows to move, Space to drop, Escape to cancel.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(move: Move) {
    const next = applyMove(columns, move);
    const placement = placementOf(next, move.taskId);
    const task = columns.flatMap((column) => column.tasks).find((t) => t.id === move.taskId);
    if (!placement || !task) return;

    startTransition(async () => {
      addOptimisticMove(move);
      const input = { taskId: task.id, toColumnId: move.toColumnId, version: task.version, ...placement };
      const result = await onMove(input, move);
      if (!result.ok) {
        toast.error(
          result.reason === "conflict"
            ? "Someone else changed this board. It has been refreshed."
            : "The task could not be moved.",
        );
        router.refresh();
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(columns.flatMap((column) => column.tasks).find((task) => task.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    if (!event.over) return;
    const move = resolveDrop(columns, String(event.active.id), String(event.over.id));
    if (move) commit(move);
  }

  function moveToColumn(task: Task, columnId: string) {
    const target = columns.find((column) => column.id === columnId);
    if (target) commit({ taskId: task.id, toColumnId: columnId, toIndex: target.tasks.length });
  }

  const columnName = (id: string | number) =>
    columns.find((column) => column.tasks.some((task) => task.id === id) || column.id === id)?.name ?? "";
  const titleOf = (id: string | number) => columns.flatMap((c) => c.tasks).find((t) => t.id === id)?.title ?? "task";

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
        accessibility={{
          // What screen readers hear during a keyboard drag.
          announcements: {
            onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `${titleOf(active.id)} is over ${columnName(over.id)}.` : `${titleOf(active.id)} is no longer over a column.`,
            onDragEnd: ({ active, over }) =>
              over ? `${titleOf(active.id)} was dropped in ${columnName(over.id)}.` : `${titleOf(active.id)} was dropped.`,
            onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
          },
        }}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              boardId={board.id}
              column={column}
              columns={columns}
              members={members}
              onOpen={setOpenTask}
              onMoveTo={moveToColumn}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="w-72 rounded-lg border bg-card p-3 text-sm font-medium shadow-lg">{activeTask.title}</div>
          )}
        </DragOverlay>
      </DndContext>
      <TaskDialog task={openTask} members={members} onClose={() => setOpenTask(null)} />
    </>
  );
}
