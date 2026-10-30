-- CrewDeck: profiles, workspaces and memberships.

-- Helpers used by policies live in a schema that the Data API does not expose.
create schema private;
grant usage on schema private to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per user, created by a trigger on auth.users.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Workspaces and members
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- The primary key indexes (workspace_id, user_id); "my workspaces" needs user_id first.
create index workspace_members_user_idx on public.workspace_members (user_id);

-- security definer: the functions read workspace_members without triggering
-- its own policies (which call them), avoiding infinite recursion.
create function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid())
  );
$$;

create function private.has_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and role = any (roles)
  );
$$;

revoke execute on function private.is_member(uuid), private.has_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function private.is_member(uuid), private.has_role(uuid, public.workspace_role[]) to authenticated;

-- Whoever creates a workspace becomes its owner, in the same transaction.
create function private.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function private.add_creator_as_owner();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- `created_by` is needed too: `insert ... returning` checks this policy before
-- the after-insert trigger has added the creator as a member.
create policy "Members read their workspaces"
  on public.workspaces for select
  to authenticated
  using ((select private.is_member(id)) or created_by = (select auth.uid()));

create policy "Users create workspaces they own"
  on public.workspaces for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Owners and admins rename workspaces"
  on public.workspaces for update
  to authenticated
  using ((select private.has_role(id, '{owner,admin}')))
  with check ((select private.has_role(id, '{owner,admin}')));

create policy "Owners delete workspaces"
  on public.workspaces for delete
  to authenticated
  using ((select private.has_role(id, '{owner}')));

create policy "Members see who else is in their workspaces"
  on public.workspace_members for select
  to authenticated
  using ((select private.is_member(workspace_id)));

-- Owners manage memberships, but never their own row: a workspace always keeps its owner.
create policy "Owners change other members' roles"
  on public.workspace_members for update
  to authenticated
  using ((select private.has_role(workspace_id, '{owner}')) and user_id <> (select auth.uid()))
  with check ((select private.has_role(workspace_id, '{owner}')) and user_id <> (select auth.uid()));

create policy "Owners remove other members, members leave"
  on public.workspace_members for delete
  to authenticated
  using (
    ((select private.has_role(workspace_id, '{owner}')) and user_id <> (select auth.uid()))
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- Profiles are visible to their owner and to people who share a workspace.
create policy "Users read their own profile and their teammates'"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members theirs
      where theirs.user_id = profiles.id and (select private.is_member(theirs.workspace_id))
    )
  );

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Privileges: tables are reachable only as allowed here.
revoke all on public.profiles, public.workspaces, public.workspace_members from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;
-- Memberships are created by the trigger and by add_workspace_member() only.
revoke insert on public.workspace_members from authenticated;
revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

-- Adding a member by e-mail needs to read auth.users, which clients cannot do.
-- The function runs with its owner's rights, so it checks authorization itself.
create function public.add_workspace_member(
  ws uuid,
  member_email text,
  member_role public.workspace_role default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  if not private.has_role(ws, '{owner}') then
    raise exception 'Only workspace owners can add members' using errcode = '42501';
  end if;
  if member_role = 'owner' then
    raise exception 'A workspace has a single owner' using errcode = '22023';
  end if;

  select id into member_id from auth.users where lower(email) = lower(trim(member_email));
  if member_id is null then
    -- P0002 = no_data_found. The caller decides what to tell the user.
    raise exception 'No CrewDeck account uses this address' using errcode = 'P0002';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, member_id, member_role)
  on conflict (workspace_id, user_id) do nothing;
  return member_id;
end;
$$;

revoke execute on function public.add_workspace_member(uuid, text, public.workspace_role) from public, anon;
grant execute on function public.add_workspace_member(uuid, text, public.workspace_role) to authenticated;
