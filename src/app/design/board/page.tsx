import type { Metadata } from "next";
import { BoardPreview } from "./preview";
import type { Board, Member } from "@/lib/board/types";

// A static preview of the board with sample data, for design reviews and
// screenshots. It is not connected to the database: moves live in memory only.
export const metadata: Metadata = { title: "Board preview", robots: { index: false } };

const members: Member[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", full_name: "Léa Garnier", role: "owner" },
  { id: "00000000-0000-4000-8000-0000000000a2", full_name: "Tom Becker", role: "member" },
];

const t = (n: number, column: string, title: string, extra: Partial<Board["columns"][0]["tasks"][0]> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  column_id: column, title, description: "", assignee_id: null, due_date: null, position: n * 1024, version: 1, ...extra,
});

const board: Board = {
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Ferry app — Sprint 12",
  workspace_id: "00000000-0000-4000-8000-0000000000c1",
  columns: [
    { id: "00000000-0000-4000-8000-0000000000d1", name: "To do", position: 1024, wip_limit: null, tasks: [
      t(1, "00000000-0000-4000-8000-0000000000d1", "Timetable screen: empty state"),
      t(2, "00000000-0000-4000-8000-0000000000d1", "Write release notes", { due_date: "2026-11-20" }),
      t(3, "00000000-0000-4000-8000-0000000000d1", "Accessibility audit of the booking flow", { assignee_id: members[1]!.id }),
    ] },
    { id: "00000000-0000-4000-8000-0000000000d2", name: "In progress", position: 2048, wip_limit: 2, tasks: [
      t(4, "00000000-0000-4000-8000-0000000000d2", "Ferry departures API", { assignee_id: members[0]!.id, due_date: "2026-11-14" }),
      t(5, "00000000-0000-4000-8000-0000000000d2", "Offline mode for tickets", { assignee_id: members[1]!.id }),
      t(6, "00000000-0000-4000-8000-0000000000d2", "Seat map prototype"),
    ] },
    { id: "00000000-0000-4000-8000-0000000000d3", name: "Done", position: 3072, wip_limit: null, tasks: [
      t(7, "00000000-0000-4000-8000-0000000000d3", "Choose the map provider"),
    ] },
  ],
};

export default function BoardPreviewPage() {
  return (
    <main className="w-full flex-1 space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">{board.name}</h1>
      <BoardPreview initial={board} members={members} />
    </main>
  );
}
