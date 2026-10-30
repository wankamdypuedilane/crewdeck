import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Board, Column, Member, Task } from "./types";

// Private, per-user data: never cached across users. RLS filters every query.

export type WorkspaceSummary = { id: string; name: string; role: Member["role"] };

export async function getMyWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces (id, name)")
    .eq("user_id", userId)
    .order("joined_at");
  if (error) throw new Error("Could not load workspaces");
  return data.flatMap((row) => {
    const ws = row.workspaces as unknown as { id: string; name: string } | null;
    return ws ? [{ id: ws.id, name: ws.name, role: row.role as Member["role"] }] : [];
  });
}

export async function getWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const [{ data: workspace }, { data: boards }, { data: members }] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle(),
    supabase.from("boards").select("id, name").eq("workspace_id", workspaceId).order("created_at"),
    supabase
      .from("workspace_members")
      .select("role, profiles (id, full_name)")
      .eq("workspace_id", workspaceId)
      .order("joined_at"),
  ]);
  // RLS returns nothing for non-members: same answer as a missing workspace.
  if (!workspace) return null;
  return {
    ...workspace,
    boards: boards ?? [],
    members: toMembers(members ?? []),
  };
}

export async function getBoard(boardId: string): Promise<{ board: Board; members: Member[] } | null> {
  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, name, workspace_id")
    .eq("id", boardId)
    .maybeSingle();
  if (!board) return null;

  const [{ data: columns }, { data: tasks }, { data: members }] = await Promise.all([
    supabase.from("board_columns").select("id, name, position, wip_limit").eq("board_id", boardId).order("position"),
    supabase
      .from("tasks")
      .select("id, column_id, title, description, assignee_id, due_date, position, version")
      .eq("board_id", boardId)
      .order("position"),
    supabase.from("workspace_members").select("role, profiles (id, full_name)").eq("workspace_id", board.workspace_id),
  ]);

  const byColumn = Map.groupBy((tasks ?? []) as Task[], (task) => task.column_id);
  const withTasks: Column[] = (columns ?? []).map((column) => ({
    ...column,
    tasks: byColumn.get(column.id) ?? [],
  }));
  return { board: { ...board, columns: withTasks }, members: toMembers(members ?? []) };
}

function toMembers(rows: { role: string; profiles: unknown }[]): Member[] {
  return rows.flatMap((row) => {
    const profile = row.profiles as { id: string; full_name: string } | null;
    return profile ? [{ ...profile, role: row.role as Member["role"] }] : [];
  });
}
