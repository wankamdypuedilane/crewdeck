import { describe, expect, it } from "vitest";
import {
  checkFile,
  contentMatches,
  documentPath,
  formatBytes,
  formatOf,
  isSafeDisplayName,
  MAX_DOCUMENT_BYTES,
  storageFileName,
} from "@/lib/documents/files";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? Array.from(v, (c) => c.charCodeAt(0)) : [v])));

describe("formatOf", () => {
  it("derives the type from the extension, in any case", () => {
    expect(formatOf("Brief.PDF")?.contentType).toBe("application/pdf");
    expect(formatOf("photo.jpg")?.kind).toBe("jpeg");
    expect(formatOf("budget.csv")?.contentType).toBe("text/csv");
  });

  it("rejects unknown, missing and disguised extensions", () => {
    expect(formatOf("setup.exe")).toBeNull();
    expect(formatOf("README")).toBeNull();
    expect(formatOf("invoice.pdf.html")).toBeNull();
    expect(formatOf("drawing.svg")).toBeNull();
  });
});

describe("checkFile", () => {
  it("accepts a document within the limit", () => {
    expect(checkFile({ name: "brief.pdf", size: 1200 })).toMatchObject({ ok: true });
    expect(checkFile({ name: "brief.pdf", size: MAX_DOCUMENT_BYTES })).toMatchObject({ ok: true });
  });

  it("explains why a file is refused", () => {
    expect(checkFile({ name: "setup.exe", size: 10 })).toMatchObject({ ok: false, message: expect.stringContaining(".pdf") });
    expect(checkFile({ name: "empty.txt", size: 0 })).toEqual({ ok: false, message: "This file is empty." });
    expect(checkFile({ name: "video.png", size: MAX_DOCUMENT_BYTES + 1 })).toMatchObject({ ok: false, message: expect.stringContaining("25 MB") });
  });
});

describe("isSafeDisplayName", () => {
  it("accepts names in any language", () => {
    expect(isSafeDisplayName("Plan d'été — v2.pdf")).toBe(true);
    expect(isSafeDisplayName("会议记录.txt")).toBe(true);
  });

  it("refuses control characters and path separators", () => {
    expect(isSafeDisplayName("a\r\nSet-Cookie: x.pdf")).toBe(false);
    expect(isSafeDisplayName("../../etc/passwd.txt")).toBe(false);
    expect(isSafeDisplayName("C:\\fakepath\\a.pdf")).toBe(false);
    expect(isSafeDisplayName("   ")).toBe(false);
  });
});

describe("storageFileName and documentPath", () => {
  it("produce plain ASCII object names", () => {
    expect(storageFileName("Plan d'été 2027.PDF")).toBe("plan-d-ete-2027.pdf");
    expect(storageFileName("  --Notes!!.md")).toBe("notes.md");
    expect(storageFileName("会议记录.txt")).toBe("document.txt");
    expect(storageFileName(`${"a".repeat(300)}.csv`)).toHaveLength(84);
  });

  it("build the <workspace>/<document>/<file> layout", () => {
    expect(documentPath("ws-1", "doc-1", "Ferry brief.pdf")).toBe("ws-1/doc-1/ferry-brief.pdf");
  });
});

describe("contentMatches", () => {
  it("recognizes the magic numbers of binary formats", () => {
    expect(contentMatches(bytes("%PDF-1.7\n"), "pdf")).toBe(true);
    expect(contentMatches(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0), "png")).toBe(true);
    expect(contentMatches(bytes(0xff, 0xd8, 0xff, 0xe0), "jpeg")).toBe(true);
    expect(contentMatches(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "), "webp")).toBe(true);
  });

  it("refuses content that does not match its name", () => {
    expect(contentMatches(bytes("<html><script>"), "pdf")).toBe(false);
    expect(contentMatches(bytes("%PDF-1.7"), "png")).toBe(false);
    expect(contentMatches(bytes("RIFF", 0, 0, 0, 0, "AVI "), "webp")).toBe(false);
    expect(contentMatches(bytes(), "jpeg")).toBe(false);
  });

  it("accepts UTF-8 text and refuses binary data named .txt", () => {
    expect(contentMatches(new TextEncoder().encode("Ordre du jour : été\r\n\tpoint 1"), "text")).toBe(true);
    expect(contentMatches(bytes("MZ", 0x90, 0x00, 0x03), "text")).toBe(false); // an executable
    expect(contentMatches(bytes(0xc3, 0x28), "text")).toBe(false); // invalid UTF-8
  });
});

describe("formatBytes", () => {
  it("uses readable units", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(48_213)).toBe("47 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
    expect(formatBytes(MAX_DOCUMENT_BYTES)).toBe("25 MB");
  });
});
