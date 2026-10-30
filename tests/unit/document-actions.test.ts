// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase client: Storage calls and the documents table.
const files = { createSignedUploadUrl: vi.fn(), download: vi.fn(), remove: vi.fn() };
const insert = vi.fn();
const deleteSelect = vi.fn();
const calls: string[] = [];
const supabase = {
  storage: { from: vi.fn(() => files) },
  from: vi.fn(() => ({
    insert: (row: unknown) => {
      calls.push("insert row");
      return insert(row);
    },
    delete: () => ({ eq: () => ({ select: () => (calls.push("delete row"), deleteSelect()) }) }),
  })),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: async () => ({ id: "user-1", email: null }) }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { completeUpload, deleteDocument, prepareUpload } = await import(
  "@/app/(app)/workspaces/[workspaceId]/documents/actions"
);

const WS = "3f0c6a51-8d2e-4b7a-9c41-2e5d8f1a7b90";
const DOC = "a8b2c4d6-1e3f-4a5b-8c7d-9e0f1a2b3c4d";
const PATH = `${WS}/${DOC}/ferry-brief.pdf`;
const blob = (content: string, type: string) => new Blob([content], { type });

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  files.remove.mockImplementation(async () => (calls.push("remove file"), { data: [], error: null }));
});

describe("prepareUpload", () => {
  it("refuses an unsupported file without contacting Storage", async () => {
    const result = await prepareUpload({ workspaceId: WS, name: "setup.exe", size: 1000 });
    expect(result).toEqual({ ok: false, message: "This type of file is not accepted." });
    expect(files.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("signs an upload URL for a new path under the workspace", async () => {
    files.createSignedUploadUrl.mockResolvedValue({ data: { token: "tok", path: "p", signedUrl: "u" }, error: null });
    const result = await prepareUpload({ workspaceId: WS, name: "Ferry brief.pdf", size: 48_213 });
    expect(result).toMatchObject({ ok: true, token: "tok", contentType: "application/pdf" });
    const path = files.createSignedUploadUrl.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^${WS}/[0-9a-f-]{36}/ferry-brief\\.pdf$`));
    expect(result.ok && path.split("/")[1]).toBe(result.ok && result.documentId);
  });

  it("reports a refusal by the storage policies", async () => {
    files.createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "new row violates row-level security policy" } });
    const result = await prepareUpload({ workspaceId: WS, name: "brief.pdf", size: 10 });
    expect(result).toEqual({ ok: false, message: "You cannot add documents to this workspace." });
  });
});

describe("completeUpload", () => {
  const input = { workspaceId: WS, documentId: DOC, name: "Ferry brief.pdf" };

  it("records a verified file, without sending its size or type", async () => {
    files.download.mockResolvedValue({ data: blob("%PDF-1.7\n...", "application/pdf"), error: null });
    insert.mockResolvedValue({ error: null });
    expect(await completeUpload(input)).toEqual({ ok: true });
    expect(files.download).toHaveBeenCalledWith(PATH);
    expect(insert).toHaveBeenCalledWith({ id: DOC, workspace_id: WS, name: "Ferry brief.pdf", storage_path: PATH });
    expect(refresh).toHaveBeenCalled();
  });

  it("deletes a file whose content does not match its name", async () => {
    files.download.mockResolvedValue({ data: blob("<html><script>alert(1)</script>", "application/pdf"), error: null });
    const result = await completeUpload(input);
    expect(result).toEqual({ ok: false, message: "This file is not a valid PDF document." });
    expect(calls).toEqual(["remove file"]);
  });

  it("deletes a file stored with another type than its name announces", async () => {
    files.download.mockResolvedValue({ data: blob("%PDF-1.7\n", "image/png"), error: null });
    expect((await completeUpload(input)).ok).toBe(false);
    expect(files.remove).toHaveBeenCalledWith([PATH]);
  });

  it("removes the file again when the row cannot be saved", async () => {
    files.download.mockResolvedValue({ data: blob("%PDF-1.7\n", "application/pdf"), error: null });
    insert.mockResolvedValue({ error: { code: "42501", message: "row-level security" } });
    expect(await completeUpload(input)).toEqual({ ok: false, message: "The document could not be saved." });
    expect(calls).toEqual(["insert row", "remove file"]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  it("deletes the row first, then the file", async () => {
    deleteSelect.mockResolvedValue({ data: [{ storage_path: PATH }], error: null });
    expect(await deleteDocument(DOC)).toEqual({ ok: true });
    expect(calls).toEqual(["delete row", "remove file"]);
    expect(files.remove).toHaveBeenCalledWith([PATH]);
  });

  it("leaves the file alone when the policies refuse to delete the row", async () => {
    deleteSelect.mockResolvedValue({ data: [], error: null });
    expect(await deleteDocument(DOC)).toEqual({ ok: false, message: "You cannot delete this document." });
    expect(files.remove).not.toHaveBeenCalled();
  });
});
