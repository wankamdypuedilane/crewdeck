# CrewDeck — Product requirements

CrewDeck is a team workspace built by Tidewater Studio (fictional) for small
creative and software teams of 3 to 30 people.

## Users
- **Owner**: creates the workspace, adds members, manages roles.
- **Admin**: creates and organizes boards.
- **Member**: creates, edits, moves and deletes tasks.

## Version 1 scope
1. Accounts: sign-up with e-mail and password, e-mail confirmation, password reset.
2. Workspaces: create, list; the creator becomes the owner.
3. Members: the owner adds existing CrewDeck users by e-mail as admin or member.
4. Boards: owners and admins create boards; each board starts with To do, In progress, Done.
5. Tasks: create in a column; edit title, description, assignee (a member), due date; delete.
6. Moving tasks: drag and drop with mouse, touch and keyboard, plus a "Move to" menu.
7. Concurrency: two people editing or moving the same task never silently overwrite each other.
8. Real-time: changes by teammates appear without reloading.
9. Work-in-progress limits are displayed when a column exceeds its limit.
10. Documents (chapter 14): private project files with time-limited download links.

## Non-goals for version 1
Invitations to people without an account, comments, notifications, billing.

## Quality requirements
- Members never see data from a workspace they do not belong to (tested in the database).
- Keyboard and screen reader users can do everything mouse users can.
- A move appears instantly; failures are reported and the board is corrected.
