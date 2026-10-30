"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon, GripVerticalIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Column, Member, Task } from "@/lib/board/types";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  columns: Column[];
  assignee?: Member;
  onOpen: (task: Task) => void;
  onMoveTo: (task: Task, columnId: string) => void;
};

export function TaskCard({ task, columns, assignee, onOpen, onMoveTo }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task" } });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card p-3 shadow-xs",
        isDragging && "opacity-40",
      )}
    >
      {/* The handle is the only drag source, so the title stays a normal button. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="mt-0.5 cursor-grab rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`Move “${task.title}”`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <button type="button" onClick={() => onOpen(task)} className="text-left text-sm font-medium hover:underline">
          {task.title}
        </button>
        {(assignee || task.due_date) && (
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {assignee && <span>{assignee.full_name}</span>}
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="size-3" aria-hidden="true" />
                <time dateTime={task.due_date}>{task.due_date}</time>
              </span>
            )}
          </p>
        )}
      </div>
      {/* A single-pointer alternative to dragging (WCAG 2.2, 2.5.7). */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for “${task.title}”`}>
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {columns
            .filter((column) => column.id !== task.column_id)
            .map((column) => (
              <DropdownMenuItem key={column.id} onSelect={() => onMoveTo(task, column.id)}>
                {column.name}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
