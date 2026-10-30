"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useActionState, useRef } from "react";
import { createTask } from "@/app/(app)/workspaces/[workspaceId]/boards/[boardId]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/auth/schemas";
import type { Column, Member, Task } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

type BoardColumnProps = {
  boardId: string;
  column: Column;
  columns: Column[];
  members: Member[];
  onOpen: (task: Task) => void;
  onMoveTo: (task: Task, columnId: string) => void;
};

export function BoardColumn({ boardId, column, columns, members, onOpen, onMoveTo }: BoardColumnProps) {
  // The column itself is a drop target, so empty columns can receive cards.
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const overLimit = column.wip_limit !== null && column.tasks.length > column.wip_limit;
  const headingId = `column-${column.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted/60 p-3", isOver && "ring-2 ring-primary")}
    >
      <header className="flex items-center justify-between">
        <h2 id={headingId} className="font-semibold">{column.name}</h2>
        <Badge variant={overLimit ? "warning" : "secondary"}>
          {column.tasks.length}
          {column.wip_limit !== null && ` / ${column.wip_limit}`}
          {overLimit && <span className="sr-only"> (over the work-in-progress limit)</span>}
        </Badge>
      </header>
      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columns={columns}
              assignee={members.find((member) => member.id === task.assignee_id)}
              onOpen={onOpen}
              onMoveTo={onMoveTo}
            />
          ))}
        </ul>
      </SortableContext>
      <AddTaskForm boardId={boardId} columnId={column.id} columnName={column.name} />
    </section>
  );
}

function AddTaskForm({ boardId, columnId, columnName }: { boardId: string; columnId: string; columnName: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, data: FormData) => {
    const result = await createTask(prev, data);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, initialFormState);
  const error = state.fieldErrors?.title?.[0] ?? (state.status === "error" ? state.message : undefined);

  return (
    <form ref={formRef} action={action} className="space-y-1">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="columnId" value={columnId} />
      <div className="flex gap-2">
        <Input
          name="title"
          placeholder="Add a task"
          aria-label={`New task in ${columnName}`}
          maxLength={200}
          aria-invalid={error ? true : undefined}
        />
        <Button type="submit" size="sm" disabled={pending}>Add</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
