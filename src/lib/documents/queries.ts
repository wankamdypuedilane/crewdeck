import "server-only";
import type { Member } from "@/lib/board/types";
import { createClient } from "@/lib/supabase/server";
import type { DocumentItem } from "./types";

// Private, per-user data: never cached across users. RLS filters every query.

export async function getWorkspaceDocuments(workspaceId: string, userId: string) {
  const supabase = await createClient();
  const [{ data: workspace }, { data: membership }, { data: documents, error }] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle(),
    supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("documents")
      .select("id, name, content_type, size_bytes, created_at, uploaded_by, profiles (full_name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  // RLS returns nothing for non-members: same answer as a missing workspace.
  if (!workspace || !membership) return null;
  if (error) throw new Error("Could not load documents");

  const items: DocumentItem[] = documents.map(({ profiles, ...doc }) => ({
    ...doc,
    size_bytes: Number(doc.size_bytes), // a bigint column: make sure it is a number

    uploader: (profiles as unknown as { full_name: string } | null)?.full_name || "Former member",
  }));
  return { workspace, role: membership.role as Member["role"], documents: items };
}
