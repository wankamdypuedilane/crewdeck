"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/auth/schemas";
import { addMemberSchema, createBoardSchema, createWorkspaceSchema } from "@/lib/board/schemas";
import { createClient } from "@/lib/supabase/server";

function invalid(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors };
}

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/workspaces");
  const parsed = createWorkspaceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  // created_by defaults to auth.uid(); a trigger makes the creator the owner.
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();
  if (error) return { status: "error", message: "The workspace could not be created." };
  redirect(`/workspaces/${data.id}`);
}

export async function createBoard(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/workspaces");
  const parsed = createBoardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({ workspace_id: parsed.data.workspaceId, name: parsed.data.name })
    .select("id")
    .single();
  if (error) {
    // RLS refuses members who are not owner or admin.
    return { status: "error", message: "Only owners and admins can create boards." };
  }
  redirect(`/workspaces/${parsed.data.workspaceId}/boards/${data.id}`);
}

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/workspaces");
  const parsed = addMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_workspace_member", {
    ws: parsed.data.workspaceId,
    member_email: parsed.data.email,
    member_role: parsed.data.role,
  });
  if (error) {
    if (error.code === "P0002") {
      return {
        status: "error",
        fieldErrors: { email: ["No CrewDeck account uses this address. Ask them to sign up first."] },
      };
    }
    if (error.code === "42501") return { status: "error", message: "Only the owner can add members." };
    return { status: "error", message: "The member could not be added." };
  }
  refresh();
  return { status: "success", message: `${parsed.data.email} can now open this workspace.` };
}
