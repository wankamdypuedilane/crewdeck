-- CrewDeck: project documents.
-- The files live in a private Storage bucket. What we know about them (name,
-- size, type, who added them) lives in public.documents.

-- ---------------------------------------------------------------------------
-- The bucket: private, 25 MiB per file, an allow-list of declared types.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
        'text/plain', 'text/markdown', 'text/csv']
);

-- ---------------------------------------------------------------------------
-- Paths: <workspace id>/<document id>/<file name>
-- Returns the workspace id of a well-formed path, or null. Policies call it for
-- every object: casting a malformed folder name to uuid would raise an error
-- instead of simply refusing the request.
-- ---------------------------------------------------------------------------
create function private.document_workspace(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

revoke execute on function private.document_workspace(text) from public, anon;
grant execute on function private.document_workspace(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies. Members read and upload files in their workspaces'
-- folders. There is no update policy: a stored file is never replaced or moved.
-- ---------------------------------------------------------------------------
create policy "Members read workspace files" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and private.is_member(private.document_workspace(name)));

create policy "Members upload workspace files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and private.is_member(private.document_workspace(name)));

-- The uploader (Storage sets owner_id from the JWT), or an owner or admin.
create policy "Uploaders and admins delete files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      (owner_id = (select auth.uid())::text and private.is_member(private.document_workspace(name)))
      or private.has_role(private.document_workspace(name), '{owner,admin}')
    )
  );

-- ---------------------------------------------------------------------------
-- Metadata: one row per document. The id is chosen by the server before the
-- upload, because it is part of the file's path.
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- The path must be <this row's workspace>/<this row's id>/<file name>.
  constraint documents_path_matches_row check (
    private.document_workspace(storage_path) = workspace_id
    and split_part(storage_path, '/', 2) = id::text
  )
);

create index documents_workspace_created_idx on public.documents (workspace_id, created_at desc);

-- Size and type are facts about the stored file: copy them from Storage
-- instead of trusting the client. Runs with the caller's rights (and RLS).
create function private.copy_file_facts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  facts jsonb;
begin
  select o.metadata into facts
  from storage.objects o
  where o.bucket_id = 'documents' and o.name = new.storage_path;
  if facts is null then
    raise exception 'No uploaded file at %', new.storage_path using errcode = '23503';
  end if;
  new.size_bytes := (facts ->> 'size')::bigint;
  new.content_type := facts ->> 'mimetype';
  return new;
end;
$$;

revoke execute on function private.copy_file_facts() from public, anon;
grant execute on function private.copy_file_facts() to authenticated;

create trigger documents_copy_file_facts
  before insert on public.documents
  for each row execute function private.copy_file_facts();

alter table public.documents enable row level security;

create policy "Members read documents" on public.documents
  for select to authenticated
  using ((select private.is_member(workspace_id)));

-- A row may only describe a file that exists and that you uploaded yourself.
create policy "Members register their own uploads" on public.documents
  for insert to authenticated
  with check (
    (select private.is_member(workspace_id))
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'documents'
        and o.name = documents.storage_path
        and o.owner_id = (select auth.uid())::text
    )
  );

create policy "Uploaders and admins delete documents" on public.documents
  for delete to authenticated
  using (
    ((select private.is_member(workspace_id)) and uploaded_by = (select auth.uid()))
    or (select private.has_role(workspace_id, '{owner,admin}'))
  );

-- Privileges: no anonymous access; clients choose only these four columns.
revoke all on public.documents from anon;
revoke insert, update on public.documents from authenticated;
grant insert (id, workspace_id, name, storage_path) on public.documents to authenticated;
