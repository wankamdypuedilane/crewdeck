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
