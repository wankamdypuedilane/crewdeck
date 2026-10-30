"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/auth/schemas";
import { needsRebalance, positionBetween } from "@/lib/board/positions";
import { createTaskSchema, type MoveTaskInput, moveTaskSchema, updateTaskSchema } from "@/lib/board/schemas";
import { createClient } from "@/lib/supabase/server";

export type MoveResult = { ok: true } | { ok: false; reason: "conflict" | "invalid" | "error" };

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/workspaces");
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { boardId, columnId, title } = parsed.data;

  const supabase = await createClient();
  // The board tells us the workspace; RLS has already checked membership.
  const { data: board } = await supabase.from("boards").select("workspace_id").eq("id", boardId).maybeSingle();
  if (!board) return { status: "error", message: "This board no longer exists." };

  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    board_id: boardId,
    column_id: columnId,
    workspace_id: board.workspace_id,
    title,
    position: positionBetween(last?.position ?? null, null),
  });
  if (error) return { status: "error", message: "The task could not be created." };
  // The board is rendered per request (never cached): re-render it for this user.
  refresh();
  return { status: "success" };
}

/**
 * Moves a task between two neighbours. The client sends ids, never positions:
 * the server reads the neighbours' positions itself.
 */
export async function moveTask(input: MoveTaskInput): Promise<MoveResult> {
  await requireUser("/workspaces");
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { taskId, toColumnId, beforeId, afterId, version } = parsed.data;
  const supabase = await createClient();

  const readNeighbours = async () => {
    const ids = [beforeId, afterId].filter((value): value is string => value !== null);
    if (ids.length === 0) return { before: null, after: null };
    const { data } = await supabase.from("tasks").select("id, position").eq("column_id", toColumnId).in("id", ids);
    const find = (id: string | null) => (id ? (data?.find((row) => row.id === id)?.position ?? undefined) : null);
    return { before: find(beforeId), after: find(afterId) };
  };

  let { before, after } = await readNeighbours();
  // A neighbour that moved away or was deleted in the meantime: the view is stale.
  if (before === undefined || after === undefined) return { ok: false, reason: "conflict" };
  if (before !== null && after !== null && after <= before) return { ok: false, reason: "conflict" };

  if (needsRebalance(before, after)) {
    await supabase.rpc("rebalance_column", { col: toColumnId });
    ({ before, after } = await readNeighbours());
    if (before === undefined || after === undefined) return { ok: false, reason: "conflict" };
  }

  // Optimistic concurrency: the update applies only if nobody changed the task
  // since this user loaded it. The trigger increments the version.
  const { data, error } = await supabase
    .from("tasks")
    .update({ column_id: toColumnId, position: positionBetween(before, after) })
    .eq("id", taskId)
    .eq("version", version)
    .select("id");
  if (error) return { ok: false, reason: "error" };
  if (data.length === 0) return { ok: false, reason: "conflict" };

  refresh();
  return { ok: true };
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/workspaces");
  const parsed = updateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const { taskId, version, title, description, assigneeId, dueDate } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ title, description, assignee_id: assigneeId, due_date: dueDate })
    .eq("id", taskId)
    .eq("version", version)
    .select("id");
  if (error) {
    // The policy refuses assignees from outside the workspace.
    if (error.code === "42501") return { status: "error", fieldErrors: { assigneeId: ["Choose a member of this workspace."] } };
    return { status: "error", message: "The task could not be saved." };
  }
  if (data.length === 0) {
    return {
      status: "error",
      message: "Someone changed this task while you were editing it. Close the dialog to see their version.",
    };
  }
  refresh();
  return { status: "success", message: "Task saved." };
}

export async function deleteTask(taskId: string): Promise<{ ok: boolean }> {
  await requireUser("/workspaces");
  if (!z.uuid().safeParse(taskId).success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error || data.length === 0) return { ok: false };
  refresh();
  return { ok: true };
}
