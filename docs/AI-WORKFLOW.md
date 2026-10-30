# Working with coding agents on CrewDeck

These conventions apply to every change, whoever (or whatever) types the code.

## Before coding
- Start from an issue with acceptance criteria. For anything touching more than three
  files, ask the agent for a plan first (plan mode) and approve it.
- Point the agent at the sources of truth: CLAUDE.md, docs/PRD.md, docs/DECISIONS.md,
  node_modules/next/dist/docs/ and the installed packages' type definitions.

## While coding
- One task per session; `/clear` between unrelated tasks, `/compact` at milestones of a long one.
- Hooks (.claude/settings.json) lint each edited file, refuse migrations without Row Level
  Security, and block destructive commands. They are a safety net, not a review.
- Database changes go through the `/new-migration` skill: tests first.

## Before a pull request
- Run `/ship-check`, then ask the `code-reviewer` subagent for an independent review.
- Read the diff yourself. You are the author of everything you merge.
- Say in the pull request which parts an agent wrote and what you verified.

## Integrations
- MCP servers (.mcp.json): Playwright, to look at pages in a real browser; Supabase in
  read-only mode on the staging project only. Never give an agent production credentials.
- The "Claude review" workflow comments on pull requests; it cannot merge or push.

## Measuring
Track, per month: lead time from first commit to production, deployments, change failure
rate, time to restore, escaped defects and review rework. Compare with the months before
agents, not with impressions.
