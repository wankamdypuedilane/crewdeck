import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateWorkspaceForm } from "@/components/workspaces/forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/current-user";
import { getMyWorkspaces } from "@/lib/board/queries";

export const metadata: Metadata = { title: "Workspaces", robots: { index: false } };

export default function WorkspacesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-12">
      <h1 className="text-3xl font-semibold">Workspaces</h1>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <WorkspaceList />
      </Suspense>
      <CreateWorkspaceForm />
    </main>
  );
}

async function WorkspaceList() {
  const user = await requireUser("/workspaces");
  const workspaces = await getMyWorkspaces(user.id);
  if (workspaces.length === 0) {
    return <p className="text-muted-foreground">You are not in any workspace yet. Create one below.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <Link href={`/workspaces/${workspace.id}`} className="flex items-center justify-between p-4 hover:bg-muted">
            <span className="font-medium">{workspace.name}</span>
            <Badge variant="secondary">{workspace.role}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
