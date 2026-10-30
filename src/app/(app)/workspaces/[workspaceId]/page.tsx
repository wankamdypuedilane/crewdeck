import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AddMemberForm, CreateBoardForm } from "@/components/workspaces/forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/current-user";
import { getWorkspace } from "@/lib/board/queries";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

export default function WorkspacePage({ params }: PageProps<"/workspaces/[workspaceId]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <WorkspaceDetails params={params} />
      </Suspense>
    </main>
  );
}

async function WorkspaceDetails({ params }: { params: PageProps<"/workspaces/[workspaceId]">["params"] }) {
  const { workspaceId } = await params;
  const user = await requireUser(`/workspaces/${workspaceId}`);
  // A malformed id would make PostgreSQL raise an error: answer 404 instead.
  if (!z.uuid().safeParse(workspaceId).success) notFound();
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();
  const myRole = workspace.members.find((member) => member.id === user.id)?.role;

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-semibold">{workspace.name}</h1>
      <section aria-labelledby="boards" className="space-y-4">
        <h2 id="boards" className="text-xl font-semibold">Boards</h2>
        {workspace.boards.length === 0 ? (
          <p className="text-muted-foreground">No board yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {workspace.boards.map((board) => (
              <li key={board.id}>
                <Link href={`/workspaces/${workspace.id}/boards/${board.id}`} className="block rounded-lg border p-4 font-medium hover:border-primary">
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(myRole === "owner" || myRole === "admin") && <CreateBoardForm workspaceId={workspace.id} />}
      </section>
      <section aria-labelledby="members" className="space-y-4">
        <h2 id="members" className="text-xl font-semibold">Members</h2>
        <ul className="divide-y rounded-lg border">
          {workspace.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between p-3">
              <span>{member.full_name || "Unnamed member"}{member.id === user.id && " (you)"}</span>
              <Badge variant="secondary">{member.role}</Badge>
            </li>
          ))}
        </ul>
        {myRole === "owner" && <AddMemberForm workspaceId={workspace.id} />}
      </section>
    </div>
  );
}
