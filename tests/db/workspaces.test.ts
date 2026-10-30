import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, connect, createUser } from "./helpers";

let db: Client;
let owner: string; // Léa, owner of "Harbour redesign"
let member: string; // Tom, member
let outsider: string; // Sam, in no workspace
let workspace: string;

beforeAll(async () => {
  db = await connect();
  owner = await createUser(db, "lea.ws@example.com", { full_name: "Léa Garnier" });
  member = await createUser(db, "tom.ws@example.com", { full_name: "Tom Becker" });
  outsider = await createUser(db, "sam.ws@example.com", { full_name: "Sam Okoro" });
  // Committed setup data, created through the same paths as the application.
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: owner, role: "authenticated" })]);
  const { rows } = await db.query<{ id: string }>(
    "insert into public.workspaces (name) values ('Harbour redesign') returning id",
  );
  workspace = rows[0]!.id;
  await db.query("select public.add_workspace_member($1, 'tom.ws@example.com')", [workspace]);
  await db.query("commit");
});

afterAll(async () => {
  await db.end();
});

describe("workspaces", () => {
  it("makes the creator the owner", async () => {
    const { rows } = await db.query(
      "select role from public.workspace_members where workspace_id = $1 and user_id = $2",
      [workspace, owner],
    );
    expect(rows).toEqual([{ role: "owner" }]);
  });

  it("is visible to members only", async () => {
    const asMember = await asUser(db, member, () => db.query("select name from public.workspaces"));
    expect(asMember.rows).toEqual([{ name: "Harbour redesign" }]);
    const asOutsider = await asUser(db, outsider, () => db.query("select name from public.workspaces"));
    expect(asOutsider.rows).toEqual([]);
  });

  it("is invisible to anonymous visitors", async () => {
    await expect(asAnon(db, () => db.query("select * from public.workspaces"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("refuses a created_by that is not the current user", async () => {
    await expect(
      asUser(db, outsider, () =>
        db.query("insert into public.workspaces (name, created_by) values ('Fake', $1)", [owner]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("members", () => {
  it("lets teammates see each other's profiles, not strangers'", async () => {
    const { rows } = await asUser(db, member, () =>
      db.query("select full_name from public.profiles order by full_name"),
    );
    expect(rows.map((r) => r.full_name)).toEqual(["Léa Garnier", "Tom Becker"]);
  });

  it("only lets owners add members", async () => {
    await expect(
      asUser(db, member, () => db.query("select public.add_workspace_member($1, 'sam.ws@example.com')", [workspace])),
    ).rejects.toThrow(/Only workspace owners/);
  });

  it("reports unknown addresses with a dedicated error code", async () => {
    await expect(
      asUser(db, owner, () => db.query("select public.add_workspace_member($1, 'nobody@example.com')", [workspace])),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it("refuses direct inserts into workspace_members", async () => {
    await expect(
      asUser(db, outsider, () =>
        db.query("insert into public.workspace_members (workspace_id, user_id) values ($1, $2)", [workspace, outsider]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let members promote themselves", async () => {
    const result = await asUser(db, member, () =>
      db.query("update public.workspace_members set role = 'admin' where user_id = $1", [member]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("never lets the owner remove themselves", async () => {
    const result = await asUser(db, owner, () =>
      db.query("delete from public.workspace_members where user_id = $1", [owner]),
    );
    expect(result.rowCount).toBe(0);
  });
});
