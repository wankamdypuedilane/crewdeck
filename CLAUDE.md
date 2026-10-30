@AGENTS.md

# CrewDeck: instructions for coding agents

CrewDeck is Tidewater Studio's team workspace: shared Kanban boards and
project documents for small teams. Read docs/PRD.md before planning a feature
and docs/DECISIONS.md before changing the data model.

## Stack
- Next.js 16 (App Router, `src/` directory, Cache Components enabled), React 19, TypeScript 5
- Tailwind CSS 4 with design tokens in `src/app/globals.css`; shadcn/ui components in `src/components/ui`
- Supabase (Postgres, Auth, Storage) through `@supabase/ssr`; clients in `src/lib/supabase/`
- Vitest + Testing Library (`tests/unit`), Playwright (`tests/e2e`)

## Commands
- `npm run dev` - local server on http://localhost:3000
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`
- Run lint, typecheck and tests before saying a task is done, and show the output.

## Rules
- Server Components by default; add "use client" only for interactivity.
- Code that reads cookies or the current user must sit inside a <Suspense> boundary.
- Authorize on the server with `supabase.auth.getClaims()`; never trust `getSession()` on the server.
- Every table has Row Level Security enabled with explicit policies. Schema changes go in `supabase/migrations/`.
- Never read, print or commit `.env*` files except `.env.example`. Never hard-code keys.
- Use semantic design tokens (`bg-primary`, `text-muted-foreground`), never raw colours.
- Validate all user input on the server with zod.
- Workspace data is private: never cache it across users ("use cache" is for public data only).
- Clients send ids and the version they loaded, never positions: the server reads neighbours itself.
- Board logic (moves, positions) lives in pure functions in `src/lib/board/` with unit tests.
- Do not modify tests to make them pass unless the requirement changed; say so explicitly if you do.
- Keep changes small and focused; propose a plan first for anything touching more than three files.
