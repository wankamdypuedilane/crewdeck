# CrewDeck

Companion project of *Mastering AI-Assisted Full-Stack Application Development*
(WANKAM Dypue Dilane Junior, 2026). A team workspace with shared Kanban boards,
built with Next.js 16, Supabase, Tailwind CSS 4 and dnd-kit.

> Tidewater Studio and CrewDeck are fictional. This code is for learning: review
> it before using any part of it in production.

## Milestones
Each chapter's result is a branch: `ch13-end` (Kanban), `ch14-end` (documents).

```bash
git switch --detach ch13-end
```

## Getting started
```bash
npm install
cp .env.example .env.local   # then fill in YOUR_SUPABASE_URL and YOUR_SUPABASE_PUBLISHABLE_KEY
npx supabase start           # local Supabase (Docker required)
npx supabase db reset        # applies supabase/migrations
npm run dev
```

Without Supabase, `/design/board` shows the board with sample data (moves kept in memory)
and `/design/documents` shows the documents page (uploads kept in memory).

## Tests
```bash
npm run lint && npm run typecheck
npm test                 # unit and component tests (Vitest)
npm run test:db          # RLS and constraints against PostgreSQL (DATABASE_URL)
npm run test:e2e         # Playwright
```

## Licence
MIT. See LICENSE.
