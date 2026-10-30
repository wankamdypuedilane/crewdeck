import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/current-user";
import { getWorkspaceDocuments } from "@/lib/documents/queries";

export const metadata: Metadata = { title: "Documents", robots: { index: false } };

export default function DocumentsPage({ params }: PageProps<"/workspaces/[workspaceId]/documents">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Documents params={params} />
      </Suspense>
    </main>
  );
}

async function Documents({ params }: { params: PageProps<"/workspaces/[workspaceId]/documents">["params"] }) {
  const { workspaceId } = await params;
  const user = await requireUser(`/workspaces/${workspaceId}/documents`);
  if (!z.uuid().safeParse(workspaceId).success) notFound();
  const result = await getWorkspaceDocuments(workspaceId, user.id);
  if (!result) notFound();

  // The interface only offers what the policies allow; the policies decide.
  const managesAll = result.role === "owner" || result.role === "admin";
  const rows = result.documents.map((doc) => ({ ...doc, canDelete: managesAll || doc.uploaded_by === user.id }));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href={`/workspaces/${workspaceId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {result.workspace.name}
        </Link>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="text-muted-foreground">Files shared with the members of this workspace only.</p>
      </div>
      <DocumentUploader workspaceId={workspaceId} />
      <DocumentList workspaceId={workspaceId} documents={rows} />
    </div>
  );
}
