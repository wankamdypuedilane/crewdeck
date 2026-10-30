import { z } from "zod";

const id = z.uuid("Invalid identifier.");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters.").max(60, "At most 60 characters."),
});

export const createBoardSchema = z.object({
  workspaceId: id,
  name: z.string().trim().min(1, "Give the board a name.").max(60, "At most 60 characters."),
});

export const addMemberSchema = z.object({
  workspaceId: id,
  email: z.email("Enter a valid e-mail address.").max(254),
  role: z.enum(["admin", "member"]),
});

export const createTaskSchema = z.object({
  boardId: id,
  columnId: id,
  title: z.string().trim().min(1, "Write a title.").max(200, "At most 200 characters."),
});

export const moveTaskSchema = z.object({
  taskId: id,
  toColumnId: id,
  beforeId: id.nullable(),
  afterId: id.nullable(),
  version: z.number().int().positive(),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const updateTaskSchema = z.object({
  taskId: id,
  version: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "Write a title.").max(200, "At most 200 characters."),
  description: z.string().trim().max(5000, "At most 5,000 characters."),
  // The select sends "" for "Unassigned".
  assigneeId: z.union([id, z.literal("").transform(() => null)]),
  dueDate: z.union([z.iso.date("Use a valid date."), z.literal("").transform(() => null)]),
});
