import { completeUpload, prepareUpload } from "@/app/(app)/workspaces/[workspaceId]/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { checkFile } from "./files";

export type UploadResult = { ok: true } | { ok: false; message: string };

/**
 * Uploads a document in three steps, from the browser:
 * 1. the server checks the request and signs an upload URL for one path;
 * 2. the browser sends the bytes straight to Storage with that URL;
 * 3. the server verifies the stored file and records it.
 */
export async function uploadDocument(workspaceId: string, file: File): Promise<UploadResult> {
  const check = checkFile(file);
  if (!check.ok) return check;

  const ticket = await prepareUpload({ workspaceId, name: file.name, size: file.size });
  if (!ticket.ok) return ticket;

  const { error } = await createClient()
    .storage.from("documents")
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.contentType });
  if (error) return { ok: false, message: "The upload failed. Check your connection and try again." };

  return completeUpload({ workspaceId, documentId: ticket.documentId, name: file.name });
}
