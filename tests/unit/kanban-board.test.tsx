import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Member } from "@/lib/board/types";

const moveTask = vi.fn();
vi.mock("@/app/(app)/workspaces/[workspaceId]/boards/[boardId]/actions", () => ({
  moveTask: (input: unknown) => moveTask(input),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { KanbanBoard } = await import("@/components/board/kanban-board");

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const task = (n: number, column: string, title: string) => ({
  id: ID(n), column_id: column, title, description: "", assignee_id: null, due_date: null, position: n * 1024, version: 3,
});

const board: Board = {
  id: "board-1",
  name: "Sprint 12",
  workspace_id: "ws-1",
  columns: [
    { id: "todo", name: "To do", position: 1024, wip_limit: null, tasks: [task(1, "todo", "Draft timetable"), task(2, "todo", "Pick colours")] },
    { id: "doing", name: "In progress", position: 2048, wip_limit: 1, tasks: [task(3, "doing", "Ferry API")] },
    { id: "done", name: "Done", position: 3072, wip_limit: null, tasks: [] },
  ],
};
const members: Member[] = [{ id: "u1", full_name: "Léa Garnier", role: "owner" }];

beforeEach(() => vi.clearAllMocks());

describe("KanbanBoard", () => {
  it("renders one labelled region per column with its tasks and counts", () => {
    render(<KanbanBoard board={board} members={members} />);
    const todo = screen.getByRole("region", { name: "To do" });
    expect(within(todo).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "In progress" })).getByText("1 / 1")).toBeInTheDocument();
  });

  it("offers drag handles with an accessible name", () => {
    render(<KanbanBoard board={board} members={members} />);
    expect(screen.getByRole("button", { name: "Move “Draft timetable”" })).toBeInTheDocument();
  });

  it("moves a task with the menu, optimistically, sending neighbours and version", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    moveTask.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<KanbanBoard board={board} members={members} />);

    await user.click(screen.getByRole("button", { name: "Actions for “Draft timetable”" }));
    await user.click(await screen.findByRole("menuitem", { name: "In progress" }));

    // Shown in its new column before the server answers.
    const doing = screen.getByRole("region", { name: "In progress" });
    await waitFor(() => expect(within(doing).getByText("Draft timetable")).toBeInTheDocument());
    expect(moveTask).toHaveBeenCalledWith({
      taskId: ID(1),
      toColumnId: "doing",
      version: 3,
      beforeId: ID(3),
      afterId: null,
    });
    finish({ ok: true });
  });

  it("refreshes the board when the server reports a conflict", async () => {
    moveTask.mockResolvedValue({ ok: false, reason: "conflict" });
    const user = userEvent.setup();
    render(<KanbanBoard board={board} members={members} />);
    await user.click(screen.getByRole("button", { name: "Actions for “Pick colours”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Done" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
