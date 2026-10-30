import { z } from "zod";
import { formatOf, isSafeDisplayName, MAX_DOCUMENT_BYTES } from "./files";

const id = z.uuid("Invalid identifier.");

const fileName = z
  .string()
  .trim()
  .min(1, "The file needs a name.")
  .max(200, "File names can be up to 200 characters.")
  .refine(isSafeDisplayName, "This file name contains characters that are not allowed.")
  .refine((name) => formatOf(name) !== null, "This type of file is not accepted.");

export const prepareUploadSchema = z.object({
  workspaceId: id,
  name: fileName,
  // Declared by the browser: early refusal only. The bucket enforces the limit.
  size: z.number().int().positive("This file is empty.").max(MAX_DOCUMENT_BYTES, "This file is too large."),
});

export const completeUploadSchema = z.object({
  workspaceId: id,
  documentId: id,
  name: fileName,
});

export type PrepareUploadInput = z.infer<typeof prepareUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
