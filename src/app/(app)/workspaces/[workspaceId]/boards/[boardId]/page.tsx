import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { KanbanBoard } from "@/components/board/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/current-user";
import { getBoard } from "@/lib/board/queries";

type Params = PageProps<"/workspaces/[workspaceId]/boards/[boardId]">["params"];

export const metadata: Metadata = { title: "Board", robots: { index: false } };

export default function BoardPage({ params }: PageProps<"/workspaces/[workspaceId]/boards/[boardId]">) {
  return (
    <main className="w-full flex-1 px-6 py-8">
      <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
        <BoardLoader params={params} />
      </Suspense>
    </main>
  );
}

async function BoardLoader({ params }: { params: Params }) {
  const { workspaceId, boardId } = await params;
  await requireUser(`/workspaces/${workspaceId}/boards/${boardId}`);
  if (!z.uuid().safeParse(boardId).success) notFound();
  const result = await getBoard(boardId);
  // Also refuse a board id paired with another workspace id in the URL.
  if (!result || result.board.workspace_id !== workspaceId) notFound();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href={`/workspaces/${workspaceId}`} className="hover:underline">Workspace</Link> / {result.board.name}
      </nav>
      <h1 className="text-2xl font-semibold">{result.board.name}</h1>
      <KanbanBoard board={result.board} members={result.members} />
    </div>
  );
}
