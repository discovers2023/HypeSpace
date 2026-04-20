---
id: 260420-ozg
title: Fix team invite password overwrite (C1)
mode: quick
status: ready
date: 2026-04-20
---

# Quick Task 260420-ozg: Fix team invite password overwrite (C1)

## Problem

`POST /invite/:token/accept` at `artifacts/api-server/src/routes/team.ts:152-155` unconditionally writes a new `passwordHash` onto `usersTable` for `member.userId`. If the invited email already belongs to a registered HypeSpace user (who is being invited to a *second* org), accepting the invite silently overwrites their existing password — locking them out of their original account.

This is account-takeover / data-loss severity. Flagged as **C1** in `.planning/codebase/CONCERNS.md`.

## Fix

A sentinel already exists: when a brand-new user is created for an invite, `passwordHash` is set to the string `"invited"` (line 76). The existing user is *real* iff `passwordHash !== "invited"`.

Backend fix:

1. In `POST /invite/:token/accept`, load the user BEFORE hashing anything.
2. If `user.passwordHash === "invited"` → the user was created by this invite; require + hash the new password; update `usersTable.passwordHash`.
3. Else → the user is pre-existing; **do not touch `passwordHash`**; still activate membership. The supplied `password` field is ignored (the user keeps their existing login).
4. If the user is pre-existing and they did NOT supply a password → that's fine, just activate membership.
5. If the user is new and they did NOT supply a valid password → keep the existing 400 `INVALID_INPUT`.

The frontend already has the signal it needs: `GET /invite/:token` returns `isNewUser: user.passwordHash === "invited"` (line 130), so the accept-invite page can show/hide the password fields. Backend change is defense-in-depth.

## Tasks

### T1 — Gate the password update on the sentinel

**Files:** `artifacts/api-server/src/routes/team.ts`

**Action:**
- Load the user first in `/invite/:token/accept` (before bcrypt).
- Branch:
  - `if (user.passwordHash === "invited")`: require `password` (length ≥ 8 → existing 400 path), hash it, run the existing `UPDATE usersTable SET passwordHash = ... WHERE id = user.id`.
  - `else`: skip the user update entirely. Do NOT hash. Ignore any `password` field in the body.
- Keep the membership activation (`teamMembersTable` update to `status:"active", joinedAt:..., inviteToken:null`) unconditional — it's the same for both branches.
- Response shape stays the same: `{ id, email, name }` from the loaded user.

**Verify:**
- `pnpm --filter @workspace/api-server typecheck` passes.
- Diff of `team.ts` shows the two-branch structure and no unconditional `.set({ passwordHash })` for pre-existing users.

**Done when:**
- An existing user invited to a second org retains their original password after accepting.
- A brand-new invitee still sets a password and can log in with it.

## must_haves

### Truths
- Pre-existing user's `passwordHash` is NEVER rewritten by the invite-accept flow.
- Sentinel `"invited"` remains the new-user marker (unchanged behavior).
- `teamMembersTable` activation (status/joinedAt/inviteToken) runs for both new and existing users.
- Input validation (`password.length >= 8`) only fires when the user is actually new.

### Artifacts
- `artifacts/api-server/src/routes/team.ts` — modified `/invite/:token/accept` handler.

### Key Links
- `artifacts/api-server/src/routes/team.ts:72-79` — sentinel creation site (read-only, no change)
- `artifacts/api-server/src/routes/team.ts:130` — `GET /invite/:token` returns `isNewUser` (read-only, no change)
- `artifacts/api-server/src/routes/team.ts:135-162` — `POST /invite/:token/accept` (site of change)

## Manual UAT (no automated tests available)

1. **New user path:** invite a brand-new email → accept with a password → log in with that password. ✅
2. **Existing user path:** invite an email that is already a registered user in a different org → accept the invite (frontend should not even show a password field) → log in to the original account with the original password — still works. ✅
3. **Existing user path, hostile:** simulate with curl: POST to `/invite/:token/accept` with `{"password": "attacker123"}` for a token belonging to a real user → server activates membership BUT `passwordHash` in DB is unchanged. ✅
4. **Expired token:** behavior unchanged, returns 410. ✅
5. **Already accepted:** behavior unchanged, returns 409. ✅
