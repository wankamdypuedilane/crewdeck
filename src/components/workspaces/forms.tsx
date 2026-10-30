"use client";

import { useActionState } from "react";
import { addMember, createBoard, createWorkspace } from "@/app/(app)/workspaces/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/auth/schemas";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-64 flex-1">
        <FormField name="name" label="New workspace" placeholder="Harbour redesign" errors={state.fieldErrors?.name} required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</Button>
      <div className="basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function CreateBoardForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createBoard, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="min-w-64 flex-1">
        <FormField name="name" label="New board" placeholder="Sprint 12" errors={state.fieldErrors?.name} required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create board"}</Button>
      <div className="basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(addMember, initialFormState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <FormField name="email" type="email" label="E-mail address" autoComplete="off" errors={state.fieldErrors?.email} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" defaultValue="member" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add member"}</Button>
      </div>
    </form>
  );
}
