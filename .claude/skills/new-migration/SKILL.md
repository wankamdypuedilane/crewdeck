---
name: new-migration
description: Create a Supabase migration for CrewDeck the project's way (new timestamped file, Row Level Security, policies, database tests first). Use whenever the database schema must change.
---

Create a database migration for: $ARGUMENTS

Follow these steps in order and show me the plan after step 2.

1. Read docs/DECISIONS.md and the latest files in supabase/migrations/ to reuse naming and
   helper functions (private.is_member, private.has_role).
2. Write the database tests first in tests/db/, for each role: anonymous visitor, member,
   non-member, owner. Run `npm run test:db` and confirm they fail for the right reason.
3. Create a new file supabase/migrations/<UTC timestamp YYYYMMDDHHMMSS>_<snake_case_name>.sql.
   Never edit a migration that is already on main.
4. In the same file: `alter table ... enable row level security;` for every new table,
   explicit policies per operation, `revoke` of privileges that no policy should grant,
   functions with `set search_path = ''`, execute rights revoked from `public`.
5. Run `npm run test:db` until green, then `npm run lint`, `npm run typecheck`, `npm test`.
6. Summarize: the file name, each policy in one sentence, and the tests that prove them.
