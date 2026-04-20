# Roadmap: HypeSpace

## Overview

HypeSpace is a working MVP with identified security vulnerabilities, a hardcoded single-org assumption, and missing campaign delivery features. This roadmap closes all P0 security holes first, then removes the multi-org blocker, then ships campaign scheduling and analytics — delivering a resellable v1 by Monday April 20, 2026.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security Hardening** - Close all P0 security vulnerabilities before any other work
- [ ] **Phase 2: Multi-Organization** - Remove hardcoded ORG_ID=1 and enable real multi-tenancy
- [ ] **Phase 3: Campaign & Quality** - Deliver campaign scheduling/analytics and ship-ready code quality

## Phase Details

### Phase 1: Security Hardening
**Goal**: The platform is safe to put in front of paying customers — no IDOR, no XSS, no session hijacking, no data leakage across orgs
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. An unauthenticated request to any /api/organizations/* route is rejected with 401
  2. A newly registered user cannot log in until they click their verification email link
  3. Submitting a mutation from an external origin without a valid CSRF token is rejected
  4. An RSVP link contains a random token (not a sequential integer guest ID) that cannot be guessed
  5. A public event page only shows published events — drafts and cancelled events return 404
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Random RSVP tokens (SEC-04) + published-only public events (SEC-05)
- [x] 01-02-PLAN.md — Session middleware + auth guard on all /organizations/* routes + CSRF protection (SEC-01, SEC-03)
- [x] 01-03-PLAN.md — Email verification on registration, login blocks unverified accounts (SEC-02)

### Phase 2: Multi-Organization
**Goal**: Users who belong to one or more organizations see and operate on the correct org — no hardcoded defaults, no cross-org data leakage
**Depends on**: Phase 1
**Requirements**: ORG-01, ORG-02, ORG-03
**Success Criteria** (what must be TRUE):
  1. After login, the frontend reads the active org from the session — not a hardcoded constant
  2. A user belonging to two orgs sees an org switcher in the navbar and can change active org
  3. Every API call includes the current org from session context, not a client-side override
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Enhance /auth/me to return user's orgs list and activeOrgId from team_members (ORG-01, ORG-03)
- [ ] 02-02-PLAN.md — Fix auth-provider to load orgs from server; replace all ORG_ID=1 with useAuth(); add org switcher to sidebar (ORG-01, ORG-02, ORG-03)

### Phase 3: Campaign & Quality
**Goal**: Organizers can schedule campaigns to send at a future time and see open/click analytics; the codebase ships clean with no TypeScript errors and consistent error handling
**Depends on**: Phase 2
**Requirements**: CAMP-01, CAMP-02, CAMP-03, CAMP-04, QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. User can pick a future date/time when creating or editing a campaign and save it as scheduled
  2. A scheduled campaign sends automatically at the specified time without manual intervention
  3. The campaign detail page shows an open rate derived from a tracking pixel embedded in sent emails
  4. The campaign detail page shows a click rate derived from redirect links wrapping all URLs in sent emails
  5. The app compiles with zero TypeScript errors and all API errors display a consistent, actionable toast message
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Schedule send UI (datetime picker + Schedule button) + server scheduler loop (CAMP-01, CAMP-02)
- [x] 03-02-PLAN.md — Tracking pixel + click redirect endpoints + HTML injection at send time (CAMP-03, CAMP-04)
- [ ] 03-03-PLAN.md — Fix all TypeScript errors, normalize API error shapes, verify frontend toasts (QUAL-01, QUAL-02, QUAL-03)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 3/3 | Complete | 2026-04-15 |
| 2. Multi-Organization | 1/2 | In Progress|  |
| 3. Campaign & Quality | 1/3 | In Progress | - |

### Phase 03.1: Security cleanup — C2 session store, C3 calendar SSRF, C4 residual IDOR audit (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 3
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 03.1 to break down)
