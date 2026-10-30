import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// A download link that works without JavaScript and never goes stale: the
// signed URL is created when the link is followed, and expires a minute later.
const LINK_LIFETIME_SECONDS = 60;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/workspaces/[workspaceId]/documents/[documentId]/download">,
) {
  const { workspaceId, documentId } = await ctx.params;
  await requireUser(`/workspaces/${workspaceId}/documents`);
  if (!z.uuid().safeParse(workspaceId).success || !z.uuid().safeParse(documentId).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  // RLS: non-members get no row, exactly like a document that does not exist.
  const { data: doc } = await supabase
    .from("documents")
    .select("name, storage_path")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  // download: the original name, sent as Content-Disposition: attachment, so
  // the browser saves the file instead of displaying it.
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, LINK_LIFETIME_SECONDS, { download: doc.name });
  if (error) return new NextResponse("This document is not available right now.", { status: 503 });

  const response = NextResponse.redirect(data.signedUrl, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
