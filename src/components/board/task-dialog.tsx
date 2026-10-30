"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTask, updateTask } from "@/app/(app)/workspaces/[workspaceId]/boards/[boardId]/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/auth/schemas";
import type { Member, Task } from "@/lib/board/types";

type TaskDialogProps = { task: Task | null; members: Member[]; onClose: () => void };

export function TaskDialog({ task, members, onClose }: TaskDialogProps) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {/* key: a fresh form (and fresh state) for every task opened. */}
        {task && <TaskForm key={`${task.id}:${task.version}`} task={task} members={members} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ task, members, onClose }: { task: Task; members: Member[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateTask, initialFormState);
  const [deleting, startDelete] = useTransition();
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>Edit task</DialogTitle>
        <DialogDescription>Changes are visible to everyone in the workspace.</DialogDescription>
      </DialogHeader>
      <FormMessage state={state} />
      <input type="hidden" name="taskId" value={task.id} />
      {/* The version this form was opened with: the server refuses the save if it changed. */}
      <input type="hidden" name="version" value={task.version} />
      <FormField name="title" label="Title" defaultValue={task.title} maxLength={200} errors={errors.title} required />
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={5} maxLength={5000} defaultValue={task.description} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Assignee</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={task.assignee_id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            aria-describedby={errors.assigneeId ? "assigneeId-error" : undefined}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name || "Unnamed member"}</option>
            ))}
          </select>
          {errors.assigneeId && <p id="assigneeId-error" className="text-sm text-destructive">{errors.assigneeId[0]}</p>}
        </div>
        <FormField name="dueDate" label="Due date" type="date" defaultValue={task.due_date ?? ""} errors={errors.dueDate} />
      </div>
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="destructive"
          disabled={deleting}
          onClick={() =>
            startDelete(async () => {
              const result = await deleteTask(task.id);
              if (result.ok) onClose();
              else toast.error("The task could not be deleted.");
            })
          }
        >
          Delete
        </Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}
