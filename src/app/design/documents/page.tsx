import type { Metadata } from "next";
import type { DocumentRow } from "@/lib/documents/types";
import { DocumentsPreview } from "./preview";

// A static preview of the documents page with sample data, for design reviews,
// screenshots and end-to-end tests. Nothing is uploaded: files stay in memory.
export const metadata: Metadata = { title: "Documents preview", robots: { index: false } };

const WORKSPACE = "00000000-0000-4000-8000-0000000000c1";
const LEA = "00000000-0000-4000-8000-0000000000a1";
const TOM = "00000000-0000-4000-8000-0000000000a2";

const doc = (n: number, name: string, type: string, size: number, date: string, by: string, canDelete: boolean): DocumentRow => ({
  id: `00000000-0000-4000-8000-0000000000e${n}`,
  name,
  content_type: type,
  size_bytes: size,
  created_at: date,
  uploaded_by: by,
  uploader: by === LEA ? "Léa Garnier" : "Tom Becker",
  canDelete,
});

// Seen by Tom, a member: he may delete his own documents only.
const documents: DocumentRow[] = [
  doc(1, "Ferry timetable — winter 2027.pdf", "application/pdf", 1_843_200, "2026-11-12T09:14:00Z", TOM, true),
  doc(2, "Seat map sketch.png", "image/png", 612_352, "2026-11-10T16:40:00Z", LEA, false),
  doc(3, "Interview notes.md", "text/markdown", 8_704, "2026-11-08T11:02:00Z", TOM, true),
  doc(4, "Port fees 2027.csv", "text/csv", 23_552, "2026-11-05T08:30:00Z", LEA, false),
];

export default function DocumentsPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="text-muted-foreground">Files shared with the members of this workspace only.</p>
      </div>
      <DocumentsPreview workspaceId={WORKSPACE} initial={documents} />
    </main>
  );
}
