import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentRow } from "@/lib/documents/types";

vi.mock("@/app/(app)/workspaces/[workspaceId]/documents/actions", () => ({
  deleteDocument: vi.fn(),
  prepareUpload: vi.fn(),
  completeUpload: vi.fn(),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (message: string) => toastError(message) } }));

const { DocumentUploader } = await import("@/components/documents/document-uploader");
const { DocumentList } = await import("@/components/documents/document-list");

const WS = "3f0c6a51-8d2e-4b7a-9c41-2e5d8f1a7b90";
const file = (name: string, content = "%PDF-1.7", type = "application/pdf") => new File([content], name, { type });

beforeEach(() => vi.clearAllMocks());

describe("DocumentUploader", () => {
  it("refuses an unsupported file in the browser, before any upload", async () => {
    const onUpload = vi.fn();
    // The accept attribute only filters the picker: simulate "All files".
    const user = userEvent.setup({ applyAccept: false });
    render(<DocumentUploader workspaceId={WS} onUpload={onUpload} />);

    await user.upload(screen.getByLabelText("Add a document"), file("setup.exe", "MZ", "application/x-msdownload"));
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This type of file is not accepted.");
    expect(screen.getByLabelText("Add a document")).toHaveAttribute("aria-invalid", "true");
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("uploads an accepted file and announces the result", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    const onUpload = vi.fn(() => new Promise<{ ok: true }>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<DocumentUploader workspaceId={WS} onUpload={onUpload} />);

    await user.upload(screen.getByLabelText("Add a document"), file("Ferry brief.pdf"));
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Uploading the document…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("“Ferry brief.pdf” was added."));
    expect(onUpload).toHaveBeenCalledWith(WS, expect.any(File));
  });

  it("shows the server's explanation when an upload fails", async () => {
    const onUpload = vi.fn().mockResolvedValue({ ok: false, message: "This file is not a valid PDF document." });
    const user = userEvent.setup();
    render(<DocumentUploader workspaceId={WS} onUpload={onUpload} />);
    await user.upload(screen.getByLabelText("Add a document"), file("fake.pdf", "<html>"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("This file is not a valid PDF document."));
  });
});

const row = (n: number, name: string, canDelete: boolean): DocumentRow => ({
  id: `doc-${n}`, name, content_type: "application/pdf", size_bytes: 1_572_864, created_at: "2026-11-12T09:14:00Z",
  uploaded_by: "u", uploader: "Tom Becker", canDelete,
});

describe("DocumentList", () => {
  it("links each document to its download route and offers delete only when allowed", () => {
    render(<DocumentList workspaceId={WS} documents={[row(1, "Brief.pdf", true), row(2, "Sketch.pdf", false)]} />);
    expect(screen.getByRole("link", { name: "Brief.pdf" })).toHaveAttribute("href", `/workspaces/${WS}/documents/doc-1/download`);
    const table = screen.getByRole("table", { name: "Documents of this workspace, newest first" });
    expect(within(table).getAllByText("1.5 MB")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Delete “Brief.pdf”" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete “Sketch.pdf”" })).not.toBeInTheDocument();
  });

  it("asks for confirmation, then deletes and reports failures", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, message: "You cannot delete this document." });
    const user = userEvent.setup();
    render(<DocumentList workspaceId={WS} documents={[row(1, "Brief.pdf", true)]} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Delete “Brief.pdf”" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this document?" });
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete document" }));

    expect(onDelete).toHaveBeenCalledWith("doc-1");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("You cannot delete this document."));
  });

  it("says so when there is no document", () => {
    render(<DocumentList workspaceId={WS} documents={[]} />);
    expect(screen.getByText("No document yet. Add the first one above.")).toBeInTheDocument();
  });
});
