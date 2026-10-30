// Rules for project documents, shared by the browser (early feedback) and the
// server (the real checks). Pure functions: no I/O, easy to test.

/** Keep in sync with file_size_limit of the "documents" bucket. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export type DocumentKind = "pdf" | "png" | "jpeg" | "webp" | "text";
export type DocumentFormat = { kind: DocumentKind; contentType: string; label: string };

// The extension decides the type. Browsers disagree about declared types: the
// same CSV file may arrive as text/csv, application/vnd.ms-excel or "".
const FORMATS: Record<string, DocumentFormat> = {
  pdf: { kind: "pdf", contentType: "application/pdf", label: "PDF document" },
  png: { kind: "png", contentType: "image/png", label: "PNG image" },
  jpg: { kind: "jpeg", contentType: "image/jpeg", label: "JPEG image" },
  jpeg: { kind: "jpeg", contentType: "image/jpeg", label: "JPEG image" },
  webp: { kind: "webp", contentType: "image/webp", label: "WebP image" },
  txt: { kind: "text", contentType: "text/plain", label: "text file" },
  md: { kind: "text", contentType: "text/markdown", label: "Markdown file" },
  csv: { kind: "text", contentType: "text/csv", label: "CSV file" },
};

export const ACCEPTED_EXTENSIONS = Object.keys(FORMATS).map((extension) => `.${extension}`);

function extensionOf(fileName: string): string | null {
  return /\.([A-Za-z0-9]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? null;
}

export function formatOf(fileName: string): DocumentFormat | null {
  const extension = extensionOf(fileName);
  return extension ? (FORMATS[extension] ?? null) : null;
}

export type FileCheck = { ok: true; format: DocumentFormat } | { ok: false; message: string };

/** Checks what the browser says about a file: fast feedback, not a guarantee. */
export function checkFile(file: { name: string; size: number }): FileCheck {
  const format = formatOf(file.name);
  if (!format || !isSafeDisplayName(file.name)) {
    return { ok: false, message: `This type of file is not accepted. Use ${ACCEPTED_EXTENSIONS.join(", ")}.` };
  }
  if (file.size === 0) return { ok: false, message: "This file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: `This file is too large: documents can be up to ${formatBytes(MAX_DOCUMENT_BYTES)}.` };
  }
  return { ok: true, format };
}

/**
 * A name shown to people and sent back in the download header: any language,
 * but no control characters (a line break could inject an HTTP header) and no
 * path separators.
 */
export function isSafeDisplayName(name: string): boolean {
  for (const char of name) {
    const code = char.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f || char === "/" || char === "\\") return false;
  }
  return name.trim().length > 0;
}

/**
 * The object name in Storage: ASCII letters, digits, dots, dashes and
 * underscores only. "Plan d'été 2027.PDF" becomes "plan-d-ete-2027.pdf".
 */
export function storageFileName(fileName: string): string {
  const extension = extensionOf(fileName) ?? "bin";
  const base = fileName
    .slice(0, fileName.length - extension.length - 1)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents: é -> e
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${base || "document"}.${extension}`;
}

/** <workspace id>/<document id>/<file name>: the layout the policies expect. */
export function documentPath(workspaceId: string, documentId: string, fileName: string): string {
  return `${workspaceId}/${documentId}/${storageFileName(fileName)}`;
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((byte, i) => bytes[offset + i] === byte);
}

/** Does the content really look like the type announced by the file name? */
export function contentMatches(bytes: Uint8Array, kind: DocumentKind): boolean {
  switch (kind) {
    case "pdf":
      return startsWith(bytes, ascii("%PDF-"));
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "webp":
      return startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8);
    case "text":
      return isPlainText(bytes);
  }
}

// Valid UTF-8, and no control characters except tab, line feed and carriage
// return. Bytes below 0x20 never occur inside multi-byte UTF-8 sequences.
function isPlainText(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if ((byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte === 0x7f) return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}
