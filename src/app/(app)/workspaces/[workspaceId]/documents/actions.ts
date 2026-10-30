"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { contentMatches, documentPath, formatOf, MAX_DOCUMENT_BYTES } from "@/lib/documents/files";
import {
  type CompleteUploadInput,
  completeUploadSchema,
  type PrepareUploadInput,
  prepareUploadSchema,
} from "@/lib/documents/schemas";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "documents";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type UploadTicket =
  | { ok: true; documentId: string; path: string; token: string; contentType: string }
  | { ok: false; message: string };

/**
 * Step 1 of an upload: check the request and hand out a signed upload URL.
 * Storage checks the insert policy now, with this user's session, so only
 * members of the workspace receive a token.
 */
export async function prepareUpload(input: PrepareUploadInput): Promise<UploadTicket> {
  await requireUser("/workspaces");
  const parsed = prepareUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid file." };
  const { workspaceId, name } = parsed.data;
  const format = formatOf(name)!; // the schema has checked it

  const documentId = crypto.randomUUID();
  const path = documentPath(workspaceId, documentId, name);
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, message: "You cannot add documents to this workspace." };
  return { ok: true, documentId, path, token: data.token, contentType: format.contentType };
}

/**
 * Step 3: verify what was actually stored, then record it. Step 2, sending
 * the bytes, happens between the browser and Storage.
 */
export async function completeUpload(input: CompleteUploadInput): Promise<ActionResult> {
  await requireUser("/workspaces");
  const parsed = completeUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { workspaceId, documentId, name } = parsed.data;
  const format = formatOf(name)!;
  // Rebuild the path instead of trusting one sent by the browser.
  const path = documentPath(workspaceId, documentId, name);
  const supabase = await createClient();
  const files = supabase.storage.from(BUCKET);

  const { data: blob, error: downloadError } = await files.download(path);
  if (downloadError) return { ok: false, message: "The upload did not complete. Please try again." };

  // The type Storage will serve, and the bytes, must match the name.
  const servedType = blob.type.split(";")[0]?.trim();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (servedType !== format.contentType || bytes.length > MAX_DOCUMENT_BYTES || !contentMatches(bytes, format.kind)) {
    await files.remove([path]);
    return { ok: false, message: `This file is not a valid ${format.label}.` };
  }

  // Size and type are copied from Storage by a trigger: we send neither.
  const { error } = await supabase
    .from("documents")
    .insert({ id: documentId, workspace_id: workspaceId, name, storage_path: path });
  if (error) {
    // Compensating action: no row, so no file either.
    await files.remove([path]);
    return { ok: false, message: "The document could not be saved." };
  }
  refresh();
  return { ok: true };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  await requireUser("/workspaces");
  if (!z.uuid().safeParse(documentId).success) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();

  // The row first. If removing the file fails afterwards, we are left with an
  // unreferenced file (harmless, cleaned up later), never a row without a file.
  const { data, error } = await supabase.from("documents").delete().eq("id", documentId).select("storage_path");
  if (error || data.length === 0) return { ok: false, message: "You cannot delete this document." };

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([data[0]!.storage_path]);
  if (removeError) console.warn("Unreferenced document file left in Storage", { documentId });
  refresh();
  return { ok: true };
}
