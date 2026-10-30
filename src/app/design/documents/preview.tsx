"use client";

import { useState } from "react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { formatOf } from "@/lib/documents/files";
import type { DocumentRow } from "@/lib/documents/types";

// Uploads and deletions change local state only: the page behaves as in the
// application, without Storage or a database.
export function DocumentsPreview({ workspaceId, initial }: { workspaceId: string; initial: DocumentRow[] }) {
  const [documents, setDocuments] = useState(initial);
  return (
    <>
      <DocumentUploader
        workspaceId={workspaceId}
        onUpload={async (_workspaceId, file) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const row: DocumentRow = {
            id: crypto.randomUUID(),
            name: file.name,
            content_type: formatOf(file.name)?.contentType ?? "application/octet-stream",
            size_bytes: file.size,
            created_at: new Date().toISOString(),
            uploaded_by: "preview",
            uploader: "Tom Becker",
            canDelete: true,
          };
          setDocuments((current) => [row, ...current]);
          return { ok: true };
        }}
      />
      <DocumentList
        workspaceId={workspaceId}
        documents={documents}
        onDelete={async (id) => {
          setDocuments((current) => current.filter((doc) => doc.id !== id));
          return { ok: true };
        }}
      />
    </>
  );
}
