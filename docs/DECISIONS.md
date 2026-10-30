# Architecture decisions

## 2026-11-06: Membership checks in security definer helpers
Policies call `private.is_member()` and `private.has_role()`. They are
`security definer` so that reading `workspace_members` inside its own policies
does not recurse. They live in the `private` schema, which the Data API does not expose.

## 2026-11-06: Denormalized workspace_id, guarded by composite foreign keys
Columns and tasks carry `workspace_id` so that policies need no join. Composite
foreign keys `(board_id, workspace_id)` and `(column_id, board_id)` make an
inconsistent copy impossible, including moving a task to another board's column.

## 2026-11-06: Fractional positions
Task order uses `double precision` positions. A move writes one row with the
midpoint between its neighbours; when neighbours are closer than 1e-6 the column
is renumbered by `rebalance_column()`, which does not bump versions.

## 2026-11-06: Optimistic concurrency with a version column
Every update increments `tasks.version` (trigger). Moves and edits send the
version the user saw and update `where version = ...`; zero rows means a conflict,
reported to the user, and the board is refreshed.

## 2026-11-06: Realtime as a signal, not a data source
The browser subscribes to `postgres_changes` on `tasks` for the open board and
refreshes the page. The server re-reads everything with RLS; realtime payloads are
never rendered directly.

## 2026-11-06: @dnd-kit/core 6 rather than @dnd-kit/react
`@dnd-kit/react` is still 0.x (October 2026). Version 6 of `@dnd-kit/core` is
stable, supports React 19 and has keyboard sensors and screen reader announcements.

## 2026-11-07: Documents in a private bucket, one folder per workspace
Files live in the private bucket `documents` at `<workspace id>/<document id>/<file name>`.
Storage policies read the workspace id from the path (`private.document_workspace()`,
which returns null for malformed paths instead of raising a cast error). The object
name is a plain ASCII version of the file name; the original name is kept in
`documents.name` and used for downloads.

## 2026-11-07: Direct uploads with signed upload URLs
Files go from the browser to Storage, not through a Server Action: no body-size
limit to raise, no double transfer on the user's connection. The server signs an
upload URL for one path (Storage checks the insert policy at that moment), then
verifies the stored file (served type, size, magic number or UTF-8 text) before
inserting the metadata row. A file that fails the check is deleted.

## 2026-11-07: The metadata row is created after the file, and trusts Storage
A row can only describe an existing object uploaded by the same user (insert
policy). A trigger copies size and type from `storage.objects.metadata`; clients
can insert only id, workspace_id, name and storage_path. Deletion removes the row
first, then the file: a failure leaves an unreferenced file, never a dangling row.

## 2026-11-07: Downloads through a Route Handler and one-minute signed URLs
Links point to `/workspaces/[id]/documents/[docId]/download`, which checks the
row through RLS and redirects (303, no-store) to a signed URL valid for 60 seconds,
with `download` set to the original name (Content-Disposition: attachment).
