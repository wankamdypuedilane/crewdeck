"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type ActionResult, deleteDocument } from "@/app/(app)/workspaces/[workspaceId]/documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/lib/documents/files";
import type { DocumentRow } from "@/lib/documents/types";

// Same output on the server and in every browser: no hydration mismatch.
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

type DocumentListProps = {
  workspaceId: string;
  documents: DocumentRow[];
  /** The Server Action by default; the design preview passes a fake. */
  onDelete?: (documentId: string) => Promise<ActionResult>;
};

export function DocumentList({ workspaceId, documents, onDelete = deleteDocument }: DocumentListProps) {
  const [toDelete, setToDelete] = useState<DocumentRow | null>(null);
  const [deleting, startDelete] = useTransition();

  if (documents.length === 0) {
    return <p className="text-muted-foreground">No document yet. Add the first one above.</p>;
  }

  const confirmDelete = () => {
    const doc = toDelete;
    if (!doc) return;
    startDelete(async () => {
      const result = await onDelete(doc.id);
      if (!result.ok) toast.error(result.message);
      setToDelete(null);
    });
  };

  return (
    <>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Documents of this workspace, newest first</caption>
        <thead className="border-b text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">Name</th>
            <th scope="col" className="py-2 pr-4 font-medium">Size</th>
            <th scope="col" className="hidden py-2 pr-4 font-medium sm:table-cell">Added by</th>
            <th scope="col" className="hidden py-2 pr-4 font-medium sm:table-cell">Date</th>
            <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td className="py-2 pr-4">
                {/* <a>, not <Link>: this URL is a Route Handler that answers with
                    a redirect to the file, not a page to render. */}
                <a
                  href={`/workspaces/${workspaceId}/documents/${doc.id}/download`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {doc.name}
                </a>
              </td>
              <td className="py-2 pr-4 tabular-nums">{formatBytes(doc.size_bytes)}</td>
              <td className="hidden py-2 pr-4 sm:table-cell">{doc.uploader}</td>
              <td className="hidden py-2 pr-4 sm:table-cell">
                <time dateTime={doc.created_at}>{dateFormat.format(new Date(doc.created_at))}</time>
              </td>
              <td className="py-2 text-right">
                {doc.canDelete && (
                  <Button variant="ghost" size="sm" aria-label={`Delete “${doc.name}”`} onClick={() => setToDelete(doc)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              “{toDelete?.name}” will be removed for everyone in the workspace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting…" : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
