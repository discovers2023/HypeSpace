# HypeSpace

## What This Is

HypeSpace is a full-stack event management SaaS platform for organizations of any size — from solo operators to agencies managing multiple clients. It provides event creation, guest management with RSVP, AI-powered email campaign generation, social media scheduling, team collaboration, and tiered subscription plans. The platform targets a horizontal market: healthcare practices, SMBs, conferences, and event agencies.

## Core Value

Event organizers can create an event, invite guests, and send polished email campaigns — the complete event lifecycle in one platform.

## Requirements

### Validated

- ✓ Event CRUD (create, read, update, delete) — existing
- ✓ Guest management with CSV import — existing
- ✓ AI-powered campaign email generation — existing
- ✓ Campaign create/list/delete — existing
- ✓ Public event pages with RSVP — existing
- ✓ Team member invitations — existing
- ✓ Social media post scheduling — existing
- ✓ Calendar view (month/week/list) — existing
- ✓ Tiered pricing plans (Free/Starter/Growth/Agency) — existing
- ✓ Plan upgrade/downgrade with validation — v1 session
- ✓ Event cancel/delete even after launch — v1 session
- ✓ Campaign HTML editing after AI generation — v1 session

### Active

- [ ] Authentication middleware on all protected routes
- [ ] Fix all remaining P0 security vulnerabilities
- [ ] Multi-organization support (remove hardcoded ORG_ID=1)
- [ ] Image/media upload for campaigns
- [ ] Scheduled email sends (DB column exists, no UI)
- [ ] Campaign analytics (open/click rate tracking)
- [ ] Public event pages filtered to published-only
- [ ] Random RSVP tokens (replace sequential guest.id)
- [ ] CSRF protection for cookie-based sessions
- [ ] Email verification on registration
- [ ] Production deployment readiness (env config, error handling)

### Out of Scope

- Mobile native app — web-first, responsive design sufficient for v1
- Payment processing (Stripe) — plan changes are instant for now; billing integration is v2
- Real-time collaboration — not needed for event management workflow
- White-label / custom domains — v2 feature after initial resale traction
- Video conferencing integration — link-based is sufficient

## Context

- **Stack:** pnpm monorepo, TypeScript everywhere, React+Vite frontend, Express 5 backend, Drizzle ORM, PostgreSQL
- **Current state:** Functional MVP with 42 identified issues (15 P0, 11 P1, 16 P2). 18 commits in the current session fixed 12 security issues and 9 bugs.
- **Existing artifacts:** `.planning/codebase/` (7 docs), `.planning/ISSUES-DASHBOARD.md` (42 issues), `.planning/REVIEW.md` (code review findings), `PROGRESS-REPORT.md`
- **AI generation:** Template-based (not LLM). Produces email HTML with variation. Good enough for v1.
- **Deployment target:** VPS at 187.77.219.84, Docker Compose for Postgres

## Constraints

- **Timeline**: Resellable v1 by Monday April 20, 2026 (~4 days)
- **Tech stack**: Must keep existing stack (TypeScript, React, Express, Drizzle, Postgres) — no rewrites
- **Auth**: Cookie-based sessions already partially implemented — extend, don't replace
- **Budget**: Solo developer + AI — no external services beyond what's already integrated

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep template-based AI generation | Real LLM integration adds complexity, cost, and API key dependency. Templates with variation are sufficient for v1. | — Pending |
| Local disk for image uploads | Simplest to implement in timeline. Can migrate to S3 later. | — Pending |
| Fix security before features | Can't resell a product with IDOR and XSS vulnerabilities | ✓ Good |
| Horizontal market targeting | Maximizes addressable market without vertical lock-in | — Pending |
| Skip Stripe for v1 | Plan changes work instantly. Real billing adds weeks of complexity. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason
2. Requirements validated? Move to Validated with phase reference
3. New requirements emerged? Add to Active
4. Decisions to log? Add to Key Decisions
5. "What This Is" still accurate? Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after initialization*
