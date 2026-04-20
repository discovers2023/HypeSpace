# Testing

**Analysis Date:** 2026-04-20

## Summary

**No automated test suite exists.** The project has zero test runners, zero unit tests, zero integration tests, zero e2e tests. All verification has been **manual UAT recorded as markdown** under `.planning/phases/*/` during the GSD workflow.

This is an explicit trade-off — the v1 sprint prioritizes shipping a resellable platform by 2026-04-20 over building a test harness. A future phase will likely add Vitest + Playwright once the roadmap stabilizes.

## Evidence

### No test tooling configured

- No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*`, or `.mocharc*` in the repo
- No `test`, `test:watch`, `test:coverage`, or `e2e` scripts in any `package.json` (root, artifacts/*, lib/*)
- No `__tests__/` directories; no `*.test.ts`, `*.spec.ts`, or `*.test.tsx` files in source trees
- No CI workflow under `.github/workflows/` that runs tests
- No test fixtures or mock servers

### Type-check is the only automated gate

Each workspace exposes a `typecheck` script that runs `tsc --noEmit`. This is the only automated correctness check in the build pipeline.

```bash
# From workspace root
pnpm -r typecheck
```

## What substitutes for tests today

### 1. Manual UAT in `.planning/phases/*/`

The GSD workflow records manual user-acceptance tests as checklists with pass/fail evidence. Recent examples:

| Phase | Tests | Result |
|-------|-------|--------|
| `01-security-hardening/01-UAT.md` | 9 manual tests (login lockout, session cookies, bcrypt hashing, CSRF, logout, etc.) | 6 pass, 2 issues (cold-start boot blocker, CSRF docs mismatch) |
| `02-multi-organization/02-UAT.md` | 8 manual tests (org creation, switching, member management, cross-org isolation) | 7 pass, 1 CRITICAL IDOR — since fixed in commit `5dc391a` + documented in `quick-260419-idor/` |

### 2. Zod runtime validation

Every API entry point validates with `safeParse()` before touching the DB. This catches malformed inputs at runtime — not a test replacement, but a live guard.

### 3. TypeScript strict mode

Catches most type-shape regressions at build time. Note the deliberate loosenings in `tsconfig.base.json`:

- `noUnusedLocals: false`
- `strictFunctionTypes: false`
- `skipLibCheck: true`

### 4. OpenAPI-generated contract

`lib/api-spec/openapi.yaml` generates `lib/api-zod/` (validators) and `lib/api-client-react/` (hooks). Contract drift between backend and frontend surfaces as compile errors.

## Workflow for Changes

Since there's no test harness, every change must be verified by:

1. `pnpm typecheck` on affected workspaces
2. Running the dev server (`pnpm dev` at root) and exercising the changed flow in the browser
3. Manual UAT checklist if the change touches auth, multi-tenancy, billing, or campaign sending
4. For frontend changes: follow the golden-path + edge-case protocol from `CLAUDE.md` — start the dev server and click through

## Recommended Future Setup

If/when a test suite is added, the natural fits for this stack are:

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit (backend helpers) | Vitest | Already Vite-based ecosystem; fast; TS-native |
| API integration | Vitest + supertest + testcontainers (pg) | Hit real PostgreSQL via Docker; no mock/prod divergence |
| React components | Vitest + @testing-library/react | Pairs cleanly with the SPA build |
| E2E | Playwright | Cross-browser + mobile (Capacitor shells) |
| Contract | `openapi-generator` + zod contract tests | Verify backend responses match `lib/api-spec/openapi.yaml` |

**Do not mock the database in integration tests.** This project has tight coupling between Drizzle query shape and Postgres semantics (e.g., UNIQUE constraints on `team_members.userId + organizationId`, NOT NULL defaults) — mocks would pass while migrations fail in prod.

## Coverage

Not measured. Not applicable until a test runner exists.

## See Also

- `.planning/phases/01-security-hardening/01-UAT.md`
- `.planning/phases/02-multi-organization/02-UAT.md`
- `.planning/codebase/CONCERNS.md` — lists zero test coverage as a 🟡 warning-grade concern for post-v1
