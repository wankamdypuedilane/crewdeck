"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ACCEPTED_EXTENSIONS, checkFile, formatBytes, MAX_DOCUMENT_BYTES } from "@/lib/documents/files";
import { type UploadResult, uploadDocument } from "@/lib/documents/upload-client";
import { cn } from "@/lib/utils";

type Status = { kind: "idle" | "success" | "error"; message: string };
const idle: Status = { kind: "idle", message: "" };

type DocumentUploaderProps = {
  workspaceId: string;
  /** The real three-step upload by default; the design preview passes a fake. */
  onUpload?: (workspaceId: string, file: File) => Promise<UploadResult>;
};

export function DocumentUploader({ workspaceId, onUpload = uploadDocument }: DocumentUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [status, action, pending] = useActionState(
    async (_previous: Status): Promise<Status> => {
      // Read from the input itself rather than from FormData: jsdom, which our
      // unit tests use, leaves files chosen with user-event out of FormData.
      const file = input.current?.files?.[0];
      if (!file) return { kind: "error", message: "Choose a file first." };
      // Instant feedback in the browser. The server checks everything again.
      const check = checkFile(file);
      if (!check.ok) return { kind: "error", message: check.message };
      const result = await onUpload(workspaceId, file);
      return result.ok
        ? { kind: "success", message: `“${file.name}” was added.` }
        : { kind: "error", message: result.message };
    },
    idle,
  );

  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="document-file">Add a document</Label>
        <input
          ref={input}
          id="document-file"
          name="file"
          type="file"
          // A convenience for the file picker, not a control: "All files" is one click away.
          accept={ACCEPTED_EXTENSIONS.join(",")}
          aria-describedby="document-help document-status"
          aria-invalid={status.kind === "error" || undefined}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground"
        />
        <p id="document-help" className="text-sm text-muted-foreground">
          PDF, PNG, JPEG, WebP, plain text, Markdown or CSV, up to {formatBytes(MAX_DOCUMENT_BYTES)}.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      <p
        id="document-status"
        role="status"
        className={cn("min-h-5 text-sm", status.kind === "error" ? "text-destructive" : "text-muted-foreground")}
      >
        {pending ? "Uploading the document…" : status.message}
      </p>
    </form>
  );
}
