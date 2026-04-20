# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

HypeSpace is a **loosely-coupled monolithic SaaS** organized as a pnpm monorepo:

- **Frontend** (React SPA) and **backend** (Express REST API) communicate over HTTP/JSON
- **Shared contracts** auto-generated from a single OpenAPI source of truth
- **Single PostgreSQL database** accessed exclusively through Drizzle ORM
- **Cookie-based session auth** with org-scoped authorization middleware
- **No message bus, no microservices, no workers** — all work is request-scoped or inline setInterval scheduling

The architecture optimizes for solo-developer velocity on a 4-day sprint to a resellable v1. Boundaries are enforced through workspace packages rather than network hops.

## Layers

### 1. Presentation (Web)

- **Location:** `artifacts/hypespace/src/`
- **Purpose:** User-facing React 19 SPA
- **Composition:** Vite build, Wouter router, TanStack React Query for server state, shadcn/ui + Tailwind v4 for UI, React Hook Form + Zod for forms, Framer Motion for motion
- **Auth context:** `artifacts/hypespace/src/components/auth-provider.tsx` (session user + `activeOrgId` for admin impersonation)
- **Entry:** `artifacts/hypespace/src/main.tsx` → `App.tsx` (router + providers)

### 2. Presentation (Mobile)

- **Location:** `artifacts/hypespace-mobile/`
- **Purpose:** Capacitor v6 wrapper around the same web build for iOS/Android
- **Origin whitelist:** `capacitor://localhost`, `http://localhost`, `https://localhost` (hardcoded in `artifacts/api-server/src/app.ts`)

### 3. API

- **Location:** `artifacts/api-server/src/`
- **Purpose:** Express 5 REST API mounted at `/api`
- **Composition:**
  - Domain routers in `artifacts/api-server/src/routes/*.ts` aggregated by `routes/index.ts`
  - Cross-cutting middleware in `routes/index.ts` (auth guard, org-membership guard, rate limiting)
  - Business-logic helpers in `artifacts/api-server/src/lib/` (`ai-campaign.ts`, `ai-image.ts`, `email.ts`, `plans.ts`, `scheduler.ts`, `app-url.ts`, `logger.ts`)
  - Session types in `artifacts/api-server/src/types/session.d.ts` (augments `express-session.SessionData`)
- **Entry:** `artifacts/api-server/src/index.ts` → `app.ts`

### 4. Data

- **Location:** `lib/db/src/schema/`
- **Purpose:** Drizzle ORM schema for PostgreSQL 16
- **Tables (one file each):** `users`, `organizations`, `team_members`, `events`, `guests`, `campaigns`, `social_posts`, `integrations`, `reminders`, `sending_domains`, `activity`
- **Client:** single `db` export from `lib/db/src/index.ts` (re-exports all tables + Zod insert schemas)

### 5. API Contract

- **Source of truth:** `lib/api-spec/openapi.yaml`
- **Generated outputs:**
  - `lib/api-zod/src/` — Zod request/response validators used by backend routes
  - `lib/api-client-react/src/` — Auto-generated TanStack React Query hooks and the custom fetcher with `ApiError`/`ResponseParseError` types

## Data Flow

### Read path (frontend → DB → frontend)

```
React component
  ↓ imports useListEvents() from @workspace/api-client-react
  ↓ TanStack Query dispatches fetch GET /api/organizations/:orgId/events
  ↓ (cookie sent with credentials)
Express router (routes/events.ts)
  ↓ requireAuth middleware (routes/index.ts) — checks req.session.userId
  ↓ requireOrgMembership middleware (routes/index.ts) — checks teamMembersTable
  ↓ Zod validates path/query via @workspace/api-zod
  ↓ Drizzle query: db.select().from(eventsTable).where(...)
PostgreSQL returns rows
  ↓ formatEvent() converts timestamps → ISO-8601 and derives counts
  ↓ res.json(formatted)
React Query cache → component re-renders
```

### Write path (mutation + invalidation)

```
useCreateEvent() mutation
  ↓ POST /api/organizations/:orgId/events (JSON body)
Express route
  ↓ requireAuth + requireOrgMembership guards
  ↓ plan quota check (lib/plans.ts — maps plan tier to limits)
  ↓ CreateEventBody.safeParse(req.body)  (from @workspace/api-zod)
  ↓ Drizzle insert with .returning()
  ↓ activityTable insert (audit trail)
  ↓ optional CRM sync (syncRsvpToGHL / syncRsvpToCustomCRM)
  ↓ res.json(formatted)
onSuccess → queryClient.invalidateQueries(["events", orgId])
```

### Email path (campaign send)

```
POST /api/organizations/:orgId/campaigns/:id/send
  ↓ org SMTP config lookup (getOrgSmtpConfig → sendingDomainsTable)
  ↓ fallback to platform SMTP if org has none
  ↓ nodemailer.sendMail per recipient (sequential)
  ↓ tracking pixel URLs injected (/api/track/open/:token, /api/track/click/:token)
  ↓ activityTable insert per send
```

## Key Abstractions

### Formatters (API response shaping)

Convert raw DB rows into API-contract shape: timestamps → ISO-8601 strings, derived counts (guest confirmations), null → sensible defaults. Examples:

- `formatEvent()` in `artifacts/api-server/src/routes/events.ts`
- `formatCampaign()` in `artifacts/api-server/src/routes/campaigns.ts`
- `formatGuest()` in `artifacts/api-server/src/routes/guests.ts`

### Plan quota gate

- **Module:** `artifacts/api-server/src/lib/plans.ts`
- **Responsibility:** Maps org plan tier to resource limits; throws `402 Payment Required` with `{ error, message, limit, plan, current, max, suggestedPlan }` when a creation would exceed the quota
- **Tiers:** `free` (1 event / 20 attendees / 1 user / no campaigns), `starter`, `growth`, `agency` (unlimited events, 2000 attendees/event)

### Activity log

- **Table:** `activityTable` (`lib/db/src/schema/activity.ts`)
- **Shape:** `{ organizationId, type, title, description, createdAt }`
- **Callers:** routes that mutate primary entities insert an activity row for audit/UI recent-activity feeds

### Auth guards (middleware)

All defined inline in `artifacts/api-server/src/routes/index.ts:40-86`:

- `requireAuth` — rejects if `req.session.userId` is unset; open-path allowlist for `/auth/*`, `/healthz`, `/public/*`, `/track/*`, `/plans`, `/admin/*`
- `requireOrgMembership` — for every `/organizations/:orgId/*` path, verifies membership via `teamMembersTable`; returns `403 FORBIDDEN` on miss (closes the P0 IDOR fixed in commit `5dc391a`)

### Rate limiters

- `authLimiter` — 20 req / 15 min on `/auth`
- `aiLimiter` — 10 req / min on `/organizations/:orgId/campaigns/ai-generate*`
- Both in `routes/index.ts` using `express-rate-limit`

### API contract generators

- `lib/api-spec/openapi.yaml` → Zod validators (`@workspace/api-zod`) and React hooks (`@workspace/api-client-react`) regenerated via workspace build
- Backend and frontend both import from the generated packages — contract drift is caught at compile time

## Entry Points

### API Server

- **File:** `artifacts/api-server/src/index.ts`
- **Trigger:** Node process start; binds to `PORT` (default 4000)
- **Responsibilities:** Load `.env`, start Pino logger, call `app.listen()`

### App Bootstrap

- **File:** `artifacts/api-server/src/app.ts`
- **Responsibilities:** Configure CORS (Capacitor native origins + dev localhost), session middleware (MemoryStore — flagged TODO to replace with `connect-pg-simple`), cookie-parser, JSON body parser (10 MB limit), pino-http, static serving of `/campaign-images`, mount `/api` router, JSON 404 + 500 fallthrough handlers

### Frontend SPA

- **File:** `artifacts/hypespace/src/main.tsx`
- **Trigger:** Browser loads `index.html`
- **Responsibilities:** Create `QueryClient`, wrap app in `QueryClientProvider`, `AuthProvider`, `TooltipProvider`, `Toaster`, `WouterRouter`

### Scheduler

- **File:** `artifacts/api-server/src/lib/scheduler.ts`
- **Trigger:** Started from `index.ts` on boot
- **Responsibilities:** Periodic reminder dispatch (setInterval) — no Bull/Redis queue

## Error Handling Contract

| Status | Meaning | Example |
|--------|---------|---------|
| 400 | Zod validation failed | `{ error: parsed.error.message }` |
| 401 | No session | `{ error: "Unauthorized" }` (requireAuth) |
| 402 | Plan quota exceeded | `{ error, message, limit, plan, current, max, suggestedPlan }` |
| 403 | Not a member of org / CSRF | `{ error: "FORBIDDEN", message }` (requireOrgMembership) |
| 404 | Resource missing | `{ error: "Not found" }` |
| 409 | Duplicate email / already accepted | `{ error: "EMAIL_TAKEN" }` |
| 410 | Expired invite token | `{ error: "TOKEN_EXPIRED" }` |
| 429 | Rate-limited | `{ error: "Too many attempts, please try again later." }` |
| 500 | Unhandled error | `{ error: err.message }` via global handler in `app.ts` |

Frontend surfaces errors through the custom `ApiError` class (`lib/api-client-react/src/custom-fetch.ts`) with `.status` and `.data`; React Query mutation `onError` callbacks display toasts via `use-toast.ts`.

## Cross-Cutting Concerns

### Logging

- **Backend:** Pino with `pino-http` middleware, configured in `artifacts/api-server/src/lib/logger.ts`. Pretty-printed in dev, JSON in prod. Header redaction: `authorization`, `cookie`, `set-cookie`
- **Frontend:** `console.error` for exceptional failures only; user-facing via toast

### Authentication

- Session-based using `express-session` + `cookie-parser`
- Cookie flags: `httpOnly: true`, `sameSite: "strict"`, `secure: true` in production, `maxAge: 7 days`
- SameSite=Strict is the CSRF defense — no separate token scheme
- Session storage: **in-memory MemoryStore** (flagged as TODO in `app.ts:86` — must move to `connect-pg-simple` before multi-instance deployment)

### Authorization

- Every `/organizations/:orgId/*` path runs `requireOrgMembership` after `requireAuth`
- Org-scoped resources (events, guests, campaigns, team) inherit tenancy from path param
- Admin routes under `/admin/*` use separate admin-credential gate (not session userId)

### Activity audit

- `activityTable` insert after every significant mutation (guest added, event created, campaign sent, team member invited)
- Surfaced in the dashboard recent-activity feed

### External integrations

- **GoHighLevel:** `syncRsvpToGHL()` in `routes/integrations.ts`
- **HubSpot (generic custom CRM):** `syncRsvpToCustomCRM()`
- **Calendar feeds:** `node-ical` parses public iCalendar URLs (Google/Outlook/Apple) — no OAuth
- **SMTP:** `nodemailer` with per-org custom domain config (`sendingDomainsTable`), fallback to platform credentials

### Mobile parity

- iOS/Android apps are Capacitor shells loading the same SPA build
- Backend CORS explicitly includes Capacitor origins
- No native-specific API endpoints
