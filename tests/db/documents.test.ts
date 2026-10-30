import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, connect, createUser } from "./helpers";

let db: Client;
let owner: string; // Léa, owner of the workspace
let uploader: string; // Tom, member
let teammate: string; // Mia, member
let outsider: string; // Sam, member of another workspace only
let workspace: string;
let docId: string;
let docPath: string;

const uuid = () => crypto.randomUUID();
const pdf = JSON.stringify({ size: 48213, mimetype: "application/pdf" });

async function runAs<T>(userId: string, fn: () => Promise<T>) {
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  const result = await fn();
  await db.query("commit");
  return result;
}

/** What Storage does when a user uploads a file: a row in storage.objects. */
const upload = (path: string, metadata = pdf) =>
  db.query("insert into storage.objects (bucket_id, name, metadata) values ('documents', $1, $2)", [path, metadata]);

const register = (id: string, ws: string, path: string, name = "Brief.pdf") =>
  db.query("insert into public.documents (id, workspace_id, name, storage_path) values ($1, $2, $3, $4)", [id, ws, name, path]);

beforeAll(async () => {
  db = await connect();
  owner = await createUser(db, "lea.docs@example.com", { full_name: "Léa Garnier" });
  uploader = await createUser(db, "tom.docs@example.com", { full_name: "Tom Becker" });
  teammate = await createUser(db, "mia.docs@example.com", { full_name: "Mia Laurent" });
  outsider = await createUser(db, "sam.docs@example.com", { full_name: "Sam Okoro" });

  await runAs(owner, async () => {
    workspace = (await db.query("insert into public.workspaces (name) values ('Ferry app') returning id")).rows[0].id;
    await db.query("select public.add_workspace_member($1, 'tom.docs@example.com')", [workspace]);
    await db.query("select public.add_workspace_member($1, 'mia.docs@example.com')", [workspace]);
  });
  await runAs(outsider, async () => {
    await db.query("insert into public.workspaces (name) values ('Side project')");
  });

  // Tom uploads a brief and registers it.
  docId = uuid();
  docPath = `${workspace}/${docId}/ferry-brief.pdf`;
  await runAs(uploader, async () => {
    await upload(docPath);
    await register(docId, workspace, docPath, "Ferry brief.pdf");
  });
});

afterAll(async () => {
  await db.end();
});

describe("the documents bucket", () => {
  it("is private, limited to 25 MiB and to an allow-list of types", async () => {
    const { rows } = await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents'");
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(25 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toContain("application/pdf");
    expect(rows[0].allowed_mime_types).not.toContain("text/html");
  });
});

describe("storage policies", () => {
  it("let members upload into their workspace's folder", async () => {
    await asUser(db, teammate, async () => {
      await expect(upload(`${workspace}/${uuid()}/minutes.txt`)).resolves.toBeDefined();
    });
  });

  it("refuse uploads into another workspace's folder", async () => {
    await asUser(db, outsider, async () => {
      await expect(upload(`${workspace}/${uuid()}/minutes.txt`)).rejects.toThrow(/row-level security/);
    });
  });

  it("refuse malformed paths with a policy error, not a crash", async () => {
    for (const path of [`${workspace}/minutes.txt`, `${workspace}/not-a-uuid/minutes.txt`, `${workspace}/${uuid()}/../x.txt`, `${workspace}/${uuid()}/.env`]) {
      await asUser(db, uploader, async () => {
        await expect(upload(path)).rejects.toThrow(/row-level security/);
      });
    }
  });

  it("show a workspace's files to its members only", async () => {
    const count = async (user: string) =>
      asUser(db, user, async () => (await db.query("select name from storage.objects where bucket_id = 'documents'")).rowCount);
    expect(await count(owner)).toBe(1);
    expect(await count(teammate)).toBe(1);
    expect(await count(outsider)).toBe(0);
  });

  it("let the uploader or an owner delete a file, not another member", async () => {
    const remove = async (user: string) =>
      asUser(db, user, async () => (await db.query("delete from storage.objects where name = $1", [docPath])).rowCount);
    expect(await remove(teammate)).toBe(0);
    expect(await remove(outsider)).toBe(0);
    expect(await remove(uploader)).toBe(1); // rolled back after each call
    expect(await remove(owner)).toBe(1);
  });

  it("never let anyone replace or move a stored file", async () => {
    await asUser(db, uploader, async () => {
      const { rowCount } = await db.query("update storage.objects set name = $1 where name = $2", [`${workspace}/${uuid()}/other.pdf`, docPath]);
      expect(rowCount).toBe(0);
    });
  });
});

describe("document rows", () => {
  it("copy size and type from Storage instead of trusting the client", async () => {
    const { rows } = await db.query("select size_bytes, content_type, uploaded_by from public.documents where id = $1", [docId]);
    expect(rows[0]).toEqual({ size_bytes: "48213", content_type: "application/pdf", uploaded_by: uploader });
    await asUser(db, uploader, async () => {
      await expect(
        db.query("insert into public.documents (id, workspace_id, name, storage_path, size_bytes) values ($1, $2, 'x.pdf', $3, 1)", [uuid(), workspace, `${workspace}/${uuid()}/x.pdf`]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("need an uploaded file at their path", async () => {
    const id = uuid();
    await asUser(db, uploader, async () => {
      await expect(register(id, workspace, `${workspace}/${id}/missing.pdf`)).rejects.toThrow(/No uploaded file/);
    });
  });

  it("can only describe a file you uploaded yourself", async () => {
    const id = uuid();
    const path = `${workspace}/${id}/notes.pdf`;
    await asUser(db, uploader, async () => {
      await upload(path);
      // Pretend to be Mia within the same transaction: the file is Tom's.
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: teammate, role: "authenticated" })]);
      await expect(register(id, workspace, path)).rejects.toThrow(/row-level security/);
    });
  });

  it("must live under their own workspace and id", async () => {
    const id = uuid();
    const otherId = uuid();
    const path = `${workspace}/${otherId}/brief.pdf`;
    await asUser(db, uploader, async () => {
      await upload(path);
      await expect(register(id, workspace, path)).rejects.toThrow(/documents_path_matches_row/);
    });
  });

  it("are visible to members only", async () => {
    const titles = async (user: string) =>
      asUser(db, user, async () => (await db.query("select name from public.documents")).rows.map((r) => r.name));
    expect(await titles(teammate)).toEqual(["Ferry brief.pdf"]);
    expect(await titles(outsider)).toEqual([]);
  });

  it("can be deleted by their uploader or an owner, not by another member", async () => {
    const remove = async (user: string) =>
      asUser(db, user, async () => (await db.query("delete from public.documents where id = $1", [docId])).rowCount);
    expect(await remove(teammate)).toBe(0);
    expect(await remove(outsider)).toBe(0);
    expect(await remove(uploader)).toBe(1);
    expect(await remove(owner)).toBe(1);
  });
});
