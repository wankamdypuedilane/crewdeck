export type Member = { id: string; full_name: string; role: "owner" | "admin" | "member" };

export type Task = {
  id: string;
  column_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  version: number;
};

export type Column = {
  id: string;
  name: string;
  position: number;
  wip_limit: number | null;
  tasks: Task[]; // sorted by position
};

export type Board = {
  id: string;
  name: string;
  workspace_id: string;
  columns: Column[]; // sorted by position
};
