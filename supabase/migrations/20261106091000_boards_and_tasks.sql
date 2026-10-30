-- Kanban boards: boards, columns and tasks.

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  -- Target of the composite foreign keys below.
  unique (id, workspace_id)
);

create index boards_workspace_idx on public.boards (workspace_id);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  -- Copied from the board so that policies need no join; the composite foreign
  -- key guarantees that the copy is always right.
  workspace_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  position double precision not null,
  wip_limit integer check (wip_limit is null or wip_limit > 0),
  unique (id, board_id),
  foreign key (board_id, workspace_id) references public.boards (id, workspace_id) on delete cascade
);

create index board_columns_board_idx on public.board_columns (board_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  column_id uuid not null,
  workspace_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  -- Order inside the column: fractional positions (see src/lib/board/positions.ts).
  position double precision not null,
  -- Optimistic concurrency: every update increments it (trigger below).
  version integer not null default 1,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A task can only sit in a column of its own board, in its own workspace.
  foreign key (column_id, board_id) references public.board_columns (id, board_id) on delete cascade,
  foreign key (board_id, workspace_id) references public.boards (id, workspace_id) on delete cascade
);

create index tasks_column_position_idx on public.tasks (column_id, position);
create index tasks_board_idx on public.tasks (board_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

create function private.bump_task_version()
returns trigger
language plpgsql
as $$
begin
  -- Renumbering positions (rebalance_column) keeps the order, so it is not a
  -- new version: concurrent editors must not get a conflict because of it.
  if current_setting('crewdeck.rebalancing', true) = 'on' then
    return new;
  end if;
  new.version = old.version + 1;
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_bump_version
  before update on public.tasks
  for each row execute function private.bump_task_version();

-- Every new board starts with three columns.
create function private.add_default_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.board_columns (board_id, workspace_id, name, position)
  values (new.id, new.workspace_id, 'To do', 1024),
         (new.id, new.workspace_id, 'In progress', 2048),
         (new.id, new.workspace_id, 'Done', 3072);
  return new;
end;
$$;

create trigger boards_add_default_columns
  after insert on public.boards
  for each row execute function private.add_default_columns();

alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;

-- Boards and columns: every member reads; owners and admins manage.
create policy "Members read boards" on public.boards for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Admins create boards" on public.boards for insert to authenticated
  with check ((select private.has_role(workspace_id, '{owner,admin}')));
create policy "Admins rename boards" on public.boards for update to authenticated
  using ((select private.has_role(workspace_id, '{owner,admin}')))
  with check ((select private.has_role(workspace_id, '{owner,admin}')));
create policy "Admins delete boards" on public.boards for delete to authenticated
  using ((select private.has_role(workspace_id, '{owner,admin}')));

create policy "Members read columns" on public.board_columns for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Admins manage columns" on public.board_columns for all to authenticated
  using ((select private.has_role(workspace_id, '{owner,admin}')))
  with check ((select private.has_role(workspace_id, '{owner,admin}')));

-- Tasks: every member reads, creates, edits, moves and deletes.
-- An assignee must belong to the task's workspace.
create policy "Members read tasks" on public.tasks for select to authenticated
  using ((select private.is_member(workspace_id)));

create policy "Members create tasks" on public.tasks for insert to authenticated
  with check (
    (select private.is_member(workspace_id))
    and created_by = (select auth.uid())
    and (assignee_id is null or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = tasks.workspace_id and m.user_id = tasks.assignee_id
    ))
  );

create policy "Members update tasks" on public.tasks for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check (
    (select private.is_member(workspace_id))
    and (assignee_id is null or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = tasks.workspace_id and m.user_id = tasks.assignee_id
    ))
  );

create policy "Members delete tasks" on public.tasks for delete to authenticated
  using ((select private.is_member(workspace_id)));

-- Privileges: no anonymous access; on tasks, only the editable columns.
revoke all on public.boards, public.board_columns, public.tasks from anon;
revoke update on public.boards from authenticated;
grant update (name) on public.boards to authenticated;
revoke update on public.tasks from authenticated;
grant update (column_id, title, description, assignee_id, due_date, position) on public.tasks to authenticated;

-- Renumbers a column's tasks 1024, 2048, ... when fractional positions get too
-- close. security invoker (the default): RLS applies to the caller.
create function public.rebalance_column(col uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('crewdeck.rebalancing', 'on', true);
  update public.tasks t
  set position = ordered.rn * 1024
  from (
    select id, row_number() over (order by position, created_at) as rn
    from public.tasks where column_id = col
  ) ordered
  where t.id = ordered.id;
  perform set_config('crewdeck.rebalancing', 'off', true);
end;
$$;

revoke execute on function public.rebalance_column(uuid) from public, anon;
grant execute on function public.rebalance_column(uuid) to authenticated;

-- Realtime: stream task changes to subscribed members (RLS still applies).
alter publication supabase_realtime add table public.tasks;
