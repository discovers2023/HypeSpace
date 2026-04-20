---
id: 260420-ozg
title: Fix team invite password overwrite (C1)
status: complete
date: 2026-04-20
commit: 0f756a1
---

# Quick Task 260420-ozg — Summary

## What shipped

Closed C1 from `.planning/codebase/CONCERNS.md`: `POST /invite/:token/accept` no longer rewrites an existing user's `passwordHash`. The invite-accept handler now branches on the existing `"invited"` sentinel:

- **New user** (`user.passwordHash === "invited"`): require `password` (length ≥ 8), hash with bcrypt cost 12, update `usersTable.passwordHash`.
- **Pre-existing user** (any other `passwordHash`): skip the user update entirely. Ignore any `password` field in the body. Activate membership regardless.

Membership activation (`status` → `active`, `joinedAt` → now, `inviteToken` → null) runs unconditionally for both branches — same as before.

## Files changed

- `artifacts/api-server/src/routes/team.ts` — 21 insertions, 10 deletions. Reorganized `POST /invite/:token/accept` handler (lines ~134-170).

## Commit

`0f756a1` — `fix(security): stop password overwrite on invite accept (C1)`

## Verification

- `pnpm --filter @workspace/api-server typecheck` — no new errors. (3 pre-existing `admin.ts` errors for `session.isAdmin` / `session.impersonating` are untouched and unrelated.)
- Manual UAT steps are documented in the plan under "Manual UAT". No automated tests exist (see `.planning/codebase/TESTING.md`).

## Why the fix is safe

The `"invited"` sentinel is set at invite-creation time (`artifacts/api-server/src/routes/team.ts:72-79`) whenever a new `usersTable` row is created specifically for an invite. Existing users are never assigned the sentinel. `GET /invite/:token` already surfaces `isNewUser: user.passwordHash === "invited"` to the frontend, so the accept-invite UI hides the password field for pre-existing users. The backend gate is defense-in-depth against a hostile client.

## Follow-ups (not in this quick task)

- **C2** (memory-backed session store) and **C3** (calendar SSRF) from `CONCERNS.md` remain open. Consider bundling into a short "security-cleanup" insert-phase before v1 ship.
- Add an integration test for this flow once a test harness is introduced (tracked as W1 in `CONCERNS.md`).
