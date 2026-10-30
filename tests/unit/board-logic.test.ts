import { describe, expect, it } from "vitest";
import { applyMove, placementOf, resolveDrop } from "@/lib/board/moves";
import { MIN_GAP, needsRebalance, positionBetween } from "@/lib/board/positions";
import type { Column, Task } from "@/lib/board/types";

const task = (id: string, column_id: string, position: number): Task => ({
  id, column_id, title: id, description: "", assignee_id: null, due_date: null, position, version: 1,
});

const board = (): Column[] => [
  { id: "todo", name: "To do", position: 1024, wip_limit: null, tasks: [task("a", "todo", 1024), task("b", "todo", 2048), task("c", "todo", 3072)] },
  { id: "doing", name: "In progress", position: 2048, wip_limit: 2, tasks: [task("d", "doing", 1024)] },
  { id: "done", name: "Done", position: 3072, wip_limit: null, tasks: [] },
];

const ids = (columns: Column[]) => Object.fromEntries(columns.map((c) => [c.id, c.tasks.map((t) => t.id)]));

describe("positionBetween", () => {
  it("handles empty columns and both ends", () => {
    expect(positionBetween(null, null)).toBe(1024);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(2048, null)).toBe(3072);
  });

  it("takes the middle between two neighbours", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("refuses neighbours in the wrong order", () => {
    expect(() => positionBetween(2048, 1024)).toThrow(RangeError);
  });

  it("detects when neighbours are too close after many insertions", () => {
    const before = 1024;
    let after = 2048;
    let steps = 0;
    while (!needsRebalance(before, after)) {
      after = positionBetween(before, after);
      steps += 1;
    }
    expect(after - before).toBeLessThan(MIN_GAP);
    expect(steps).toBeGreaterThan(25); // inserting always in the same place
  });
});

describe("applyMove", () => {
  it("moves a task to another column at the requested index", () => {
    const result = applyMove(board(), { taskId: "b", toColumnId: "doing", toIndex: 0 });
    expect(ids(result)).toEqual({ todo: ["a", "c"], doing: ["b", "d"], done: [] });
    expect(result[1]!.tasks[0]!.column_id).toBe("doing");
  });

  it("reorders inside a column and never mutates its input", () => {
    const before = board();
    const result = applyMove(before, { taskId: "a", toColumnId: "todo", toIndex: 2 });
    expect(ids(result).todo).toEqual(["b", "c", "a"]);
    expect(ids(before).todo).toEqual(["a", "b", "c"]);
  });

  it("clamps the index and ignores unknown tasks", () => {
    expect(ids(applyMove(board(), { taskId: "a", toColumnId: "done", toIndex: 99 })).done).toEqual(["a"]);
    expect(applyMove(board(), { taskId: "zzz", toColumnId: "done", toIndex: 0 })).toEqual(board());
  });
});

describe("resolveDrop and placementOf", () => {
  it("appends when dropped on a column", () => {
    expect(resolveDrop(board(), "a", "done")).toEqual({ taskId: "a", toColumnId: "done", toIndex: 0 });
    expect(resolveDrop(board(), "a", "doing")).toEqual({ taskId: "a", toColumnId: "doing", toIndex: 1 });
  });

  it("takes the place of the card it is dropped on, like arrayMove", () => {
    const down = applyMove(board(), resolveDrop(board(), "a", "c")!);
    expect(ids(down).todo).toEqual(["b", "c", "a"]);
    const up = applyMove(board(), resolveDrop(board(), "c", "a")!);
    expect(ids(up).todo).toEqual(["c", "a", "b"]);
  });

  it("reports the new neighbours to send to the server", () => {
    const moved = applyMove(board(), { taskId: "c", toColumnId: "todo", toIndex: 1 });
    expect(placementOf(moved, "c")).toEqual({ beforeId: "a", afterId: "b" });
    const alone = applyMove(board(), { taskId: "c", toColumnId: "done", toIndex: 0 });
    expect(placementOf(alone, "c")).toEqual({ beforeId: null, afterId: null });
  });

  it("does nothing when dropped on itself", () => {
    expect(resolveDrop(board(), "a", "a")).toBeNull();
  });
});
