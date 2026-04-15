# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Multi-tier monorepo with separated frontend/backend tiers and shared schema/API definition layer.

**Key Characteristics:**
- Monorepo structure using pnpm workspaces with artifacts and lib packages
- Loosely-coupled frontend (React + Vite) and backend (Express.js) via REST API
- Shared API contracts using OpenAPI schema, auto-generated into Zod validators and React Query hooks
- Cookie-based session authentication (hardcoded organization ID for development)
- Plan-based feature access and resource quotas (free/starter/growth/agency tiers)

## Layers

**Presentation Layer (Frontend):**
- Purpose: User-facing React interface for event management, campaigns, guests, team
- Location: `artifacts/hypespace/src/`
- Contains: React components, pages, hooks, UI library integration (shadcn/ui), forms
- Depends on: TanStack React Query hooks from `@workspace/api-client-react`, Wouter router, Tailwind CSS styling
- Used by: End users via browser

**API Layer (Backend):**
- Purpose: REST API serving event/guest/campaign/team management endpoints
- Location: `artifacts/api-server/src/`
- Contains: Express route handlers, input/output validation using Zod, business logic
- Depends on: Drizzle ORM for database access, Zod schemas from `@workspace/api-zod`
- Used by: Frontend via HTTP requests

**Data Access Layer:**
- Purpose: Database schema definition and ORM abstraction
- Location: `lib/db/src/schema/`
- Contains: Drizzle ORM table definitions split by domain (users, events, guests, campaigns, social_posts, reminders, integrations, etc.)
- Depends on: PostgreSQL, drizzle-orm
- Used by: Backend routes for all database operations

**Contract Definition Layer:**
- Purpose: API specification and type generation
- Location: `lib/api-spec/openapi.yaml` (source of truth)
- Contains: OpenAPI 3.0 specification
- Generated outputs:
  - `lib/api-client-react/src/generated/` — React Query hooks + schema types (via Orval)
  - `lib/api-zod/src/generated/` — Zod validators + TypeScript types (via Orval)
- Used by: Backend validates incoming requests, frontend consumes auto-generated hooks

## Data Flow

**Event Creation Flow:**

1. User fills form in `artifacts/hypespace/src/pages/events/event-new.tsx`
2. React Hook Form + Zod validates input locally
3. `useCreateEvent()` hook from `@workspace/api-client-react` makes POST to `/api/organizations/:orgId/events`
4. Express handler in `artifacts/api-server/src/routes/events.ts` validates with `CreateEventBody.safeParse()`
5. Handler checks plan limits via `getPlan()` and `assertWithinLimit()`
6. Drizzle ORM inserts into `eventsTable` in PostgreSQL
7. Response formatted and returned (dates ISO-stringified, counts calculated)
8. React Query caches response, UI updates via component re-render

**Campaign Send Flow:**

1. User creates/edits campaign in modal, then clicks "Send"
2. Frontend calls `useSendCampaign()` with campaign ID
3. Backend handler in `artifacts/api-server/src/routes/campaigns.ts` validates campaign
4. Queries `guestsTable` for event's guests
5. Uses `sendEmail()` from `artifacts/api-server/src/lib/email.ts` (Nodemailer) to send to each guest
6. Updates campaign status and metrics (sent count, open rate placeholder)
7. Inserts activity log entry into `activityTable`
8. Returns success response

**State Management:**

- Frontend: TanStack React Query for server state (caching, invalidation via `queryClient.invalidateQueries()`)
- Authentication: Context-based provider at `artifacts/hypespace/src/components/auth-provider.tsx` (currently hardcoded org ID = 1)
- Frontend organization context: AuthProvider tracks `activeOrgId` for impersonation support (admin feature)
- Backend: No persistent session state (stateless), validates based on org/user ID from request

## Key Abstractions

**API Response Formatting:**

Functions like `formatEvent()` and `formatCampaign()` abstract database-to-JSON transformation:
- Converts PostgreSQL timestamps to ISO-8601 strings
- Calculates derived fields (guest counts, confirmation percentages)
- Normalizes nulls and enums to API contract

Examples:
- `artifacts/api-server/src/routes/events.ts` lines 29-62
- `artifacts/api-server/src/routes/campaigns.ts` lines 20-37

**Plan-Based Access Control:**

`artifacts/api-server/src/lib/plans.ts` defines tier limits (events, attendees per event, team size):
- Free: 1 event, 20 attendees, 1 user, no campaigns
- Starter: 3 events, 100 attendees, 3 users, campaigns enabled
- Growth: 15 events, 500 attendees, 10 users
- Agency: unlimited events/users, 2000 attendees per event

Used in handlers via `assertWithinLimit()` to enforce quotas before INSERT operations.

**Auto-Generated API Client:**

Orval tool (`lib/api-spec/orval.config.ts`) generates:
- React Query hooks from OpenAPI schema → `useListEvents()`, `useCreateEvent()`, etc.
- Zod validators for request/response bodies → `CreateEventBody.safeParse()`

Workflow:
1. Update OpenAPI schema in `lib/api-spec/openapi.yaml`
2. Run Orval to regenerate hooks/validators
3. Both frontend and backend consume same types

## Entry Points

**Backend Server:**
- Location: `artifacts/api-server/src/index.ts`
- Triggers: Node.js process startup (PORT env var required)
- Responsibilities: Parse environment, create Express app, bind to port with pino logging

**Frontend App:**
- Location: `artifacts/hypespace/src/main.tsx`
- Triggers: Browser page load (Vite dev/prod build)
- Responsibilities: Render React root, set up providers (QueryClientProvider, AuthProvider, TooltipProvider, Wouter router)

**Express App Setup:**
- Location: `artifacts/api-server/src/app.ts`
- Triggers: Import in index.ts
- Responsibilities: Configure middleware (CORS, JSON parsing, pino logging), mount router at `/api`

**Route Registration:**
- Location: `artifacts/api-server/src/routes/index.ts`
- Triggers: Import in app.ts
- Responsibilities: Aggregate all domain routers (auth, events, guests, campaigns, etc.)

## Error Handling

**Strategy:** HTTP status codes + JSON error payloads for API, toast notifications for frontend

**Backend Patterns:**

- **400 Bad Request:** Zod validation failure → `{ error: parsed.error.message }`
- **401 Unauthorized:** Missing/invalid user
- **402 Payment Required:** Plan limit exceeded (custom for quotas) → includes `{ error, message, limit, plan, current, max, suggestedPlan }`
- **404 Not Found:** Resource doesn't exist
- **409 Conflict:** Email already taken during registration

Examples:
- `artifacts/api-server/src/routes/auth.ts` lines 32-36 (validation)
- `artifacts/api-server/src/routes/guests.ts` lines 64-66 (plan limit error)

**Frontend Patterns:**

- Queries use React Query error states (`isError`, `error` property)
- `useToast()` hook used for user notifications: `toast.error("Failed to send campaign")`
- Mutations use `onError` callbacks to display error messages

## Cross-Cutting Concerns

**Logging:**
- Backend: Pino logger (`artifacts/api-server/src/lib/logger.ts`) with pino-http middleware
- HTTP requests auto-logged with request ID, method, URL, response status code
- Structured JSON logs for production observability

**Validation:**
- Request bodies: Zod schemas from `@workspace/api-zod` via `safeParse()` before processing
- Frontend forms: React Hook Form + Zod for local validation before submission
- Both layers validate independently (defense in depth)

**Authentication:**
- Currently: Hardcoded user ID = 1 in backend (`artifacts/api-server/src/routes/auth.ts` line 15)
- Cookie-based session intent (infrastructure present but not fully implemented)
- Organization scoping: All operations include `orgId` parameter in route path
- Impersonation: AuthProvider supports `startImpersonation()` / `stopImpersonation()` for admin testing

**Activity Logging:**
- Key operations (guest added, event created, campaign sent) insert into `activityTable`
- Used for audit trail and recent activity UI display
- Format: `{ organizationId, type, title, description, createdAt }`
- Examples in `artifacts/api-server/src/routes/events.ts`, `guests.ts`, `campaigns.ts`

**Integrations:**
- GoHighLevel sync: `syncRsvpToGHL()` in `artifacts/api-server/src/routes/integrations.ts`
- HubSpot contact sync: `syncRsvpToCustomCRM()`
- Email provider configuration: Custom SMTP domains via `sendingDomainsTable`
- Social posting: `socialPostsTable` stores scheduled/published posts across platforms
- Reminders: Background task infrastructure (table exists, execution pattern TBD)

---

*Architecture analysis: 2026-04-15*
