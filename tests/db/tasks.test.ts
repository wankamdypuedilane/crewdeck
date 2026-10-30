import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, connect, createUser } from "./helpers";

let db: Client;
let owner: string;
let member: string;
let outsider: string;
let workspace: string;
let otherWorkspace: string;
let board: string;
let otherBoardColumn: string;
let columns: Record<string, string>;
let task: string;

async function runAs<T>(userId: string, fn: () => Promise<T>) {
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  const result = await fn();
  await db.query("commit");
  return result;
}

beforeAll(async () => {
  db = await connect();
  owner = await createUser(db, "lea.tasks@example.com", { full_name: "Léa Garnier" });
  member = await createUser(db, "tom.tasks@example.com", { full_name: "Tom Becker" });
  outsider = await createUser(db, "sam.tasks@example.com", { full_name: "Sam Okoro" });

  await runAs(owner, async () => {
    workspace = (await db.query("insert into public.workspaces (name) values ('Ferry app') returning id")).rows[0].id;
    await db.query("select public.add_workspace_member($1, 'tom.tasks@example.com')", [workspace]);
    board = (await db.query("insert into public.boards (workspace_id, name) values ($1, 'Sprint 12') returning id", [workspace])).rows[0].id;
  });
  await runAs(outsider, async () => {
    otherWorkspace = (await db.query("insert into public.workspaces (name) values ('Side project') returning id")).rows[0].id;
    const otherBoard = (await db.query("insert into public.boards (workspace_id, name) values ($1, 'Ideas') returning id", [otherWorkspace])).rows[0].id;
    otherBoardColumn = (await db.query("select id from public.board_columns where board_id = $1 limit 1", [otherBoard])).rows[0].id;
  });
  const { rows } = await db.query("select name, id from public.board_columns where board_id = $1", [board]);
  columns = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  await runAs(member, async () => {
    task = (
      await db.query(
        "insert into public.tasks (board_id, column_id, workspace_id, title, position) values ($1, $2, $3, 'Draft timetable screen', 1024) returning id",
        [board, columns["To do"], workspace],
      )
    ).rows[0].id;
  });
});

afterAll(async () => {
  await db.end();
});

describe("boards", () => {
  it("start with three ordered columns", async () => {
    const { rows } = await db.query("select name from public.board_columns where board_id = $1 order by position", [board]);
    expect(rows.map((r) => r.name)).toEqual(["To do", "In progress", "Done"]);
  });

  it("can be created by admins and owners only", async () => {
    await expect(
      asUser(db, member, () => db.query("insert into public.boards (workspace_id, name) values ($1, 'Mine')", [workspace])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("tasks", () => {
  it("are hidden from people outside the workspace", async () => {
    const { rows } = await asUser(db, outsider, () => db.query("select id from public.tasks where board_id = $1", [board]));
    expect(rows).toEqual([]);
  });

  it("cannot be created by outsiders, even with valid ids", async () => {
    await expect(
      asUser(db, outsider, () =>
        db.query(
          "insert into public.tasks (board_id, column_id, workspace_id, title, position) values ($1, $2, $3, 'Spam', 1)",
          [board, columns["To do"], workspace],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot be moved into a column of another board", async () => {
    await expect(
      asUser(db, member, () => db.query("update public.tasks set column_id = $1 where id = $2", [otherBoardColumn, task])),
    ).rejects.toThrow(/foreign key/);
  });

  it("cannot be assigned to someone outside the workspace", async () => {
    await expect(
      asUser(db, member, () => db.query("update public.tasks set assignee_id = $1 where id = $2", [outsider, task])),
    ).rejects.toThrow(/row-level security/);
    const ok = await asUser(db, member, () => db.query("update public.tasks set assignee_id = $1 where id = $2", [owner, task]));
    expect(ok.rowCount).toBe(1);
  });

  it("increments the version on every update", async () => {
    const versions = await asUser(db, member, async () => {
      const before = (await db.query("select version from public.tasks where id = $1", [task])).rows[0].version;
      const after = (
        await db.query("update public.tasks set title = 'Draft the timetable screen' where id = $1 returning version", [task])
      ).rows[0].version;
      return { before, after };
    });
    expect(versions.after).toBe(versions.before + 1);
  });

  it("ignores the update when the expected version is stale (optimistic concurrency)", async () => {
    const result = await asUser(db, member, async () => {
      const { version } = (await db.query("select version from public.tasks where id = $1", [task])).rows[0];
      // Someone else saves first...
      await db.query("update public.tasks set title = 'Edited by Léa' where id = $1", [task]);
      // ...so our update, based on the old version, matches no row.
      return db.query("update public.tasks set column_id = $1 where id = $2 and version = $3", [columns["Done"], task, version]);
    });
    expect(result.rowCount).toBe(0);
  });

  it("does not let members change the version or the board directly", async () => {
    await expect(
      asUser(db, member, () => db.query("update public.tasks set version = 1 where id = $1", [task])),
    ).rejects.toThrow(/permission denied/);
  });

  it("renumbers a column when positions get too close", async () => {
    const positions = await asUser(db, member, async () => {
      for (const [title, position] of [["A", 1.0000001], ["B", 1.0000002]] as const) {
        await db.query(
          "insert into public.tasks (board_id, column_id, workspace_id, title, position) values ($1, $2, $3, $4, $5)",
          [board, columns["In progress"], workspace, title, position],
        );
      }
      await db.query("select public.rebalance_column($1)", [columns["In progress"]]);
      const { rows } = await db.query("select title, position, version from public.tasks where column_id = $1 order by position", [columns["In progress"]]);
      return rows;
    });
    // Same order, new spacing, and no new version: nobody's edit becomes "stale".
    expect(positions).toEqual([
      { title: "A", position: 1024, version: 1 },
      { title: "B", position: 2048, version: 1 },
    ]);
  });

  it("are published for Realtime", async () => {
    const { rows } = await db.query(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime'",
    );
    expect(rows.map((r) => r.tablename)).toContain("tasks");
  });
});
