# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```
/root/Claude-projects/HypeSpace/
├── artifacts/                     # Deployable applications
│   ├── api-server/               # Express.js backend API
│   ├── hypespace/                # React + Vite frontend application
│   └── mockup-sandbox/           # Unused/reference artifact
├── lib/                          # Shared libraries
│   ├── api-spec/                 # OpenAPI specification (source of truth)
│   ├── api-client-react/         # Auto-generated React Query hooks
│   ├── api-zod/                  # Auto-generated Zod validators
│   └── db/                       # Drizzle ORM schema definitions
├── .planning/                    # GSD planning artifacts
│   └── codebase/                # Codebase analysis documents
├── docker-compose.yml            # Local PostgreSQL development
├── pnpm-workspace.yaml          # Monorepo configuration
└── package.json                  # Root workspace manifest
```

## Directory Purposes

**artifacts/api-server/**
- Purpose: Express.js REST API server
- Contains: Route handlers, business logic, middleware, utilities
- Key files: `src/index.ts` (entry), `src/app.ts` (Express setup), `src/routes/*.ts` (domain routers)
- Built to: `dist/index.mjs` (esbuild)

**artifacts/hypespace/**
- Purpose: React + Vite SPA for event management UI
- Contains: Pages, components, hooks, styles, assets
- Key files: `src/main.tsx` (entry), `src/App.tsx` (router), `src/pages/*.tsx` (page components)
- Built to: `dist/public/` (Vite)

**lib/api-spec/**
- Purpose: OpenAPI 3.0 specification (single source of truth for API contract)
- Contains: `openapi.yaml` (full API definition), `orval.config.ts` (code generation config)
- Regenerates: `../api-client-react/src/generated/` and `../api-zod/src/generated/`
- Never edit generated files; always update openapi.yaml first

**lib/api-client-react/**
- Purpose: Auto-generated React Query hooks for frontend API consumption
- Contains: React Query hooks, schema types, custom fetch wrapper
- Key files: `src/generated/api.ts` (hooks), `src/generated/api.schemas.ts` (types), `src/custom-fetch.ts` (request interceptor)
- Usage: `import { useListEvents, useCreateEvent } from "@workspace/api-client-react"`

**lib/api-zod/**
- Purpose: Auto-generated Zod validators for backend validation
- Contains: Zod schema definitions, TypeScript type definitions
- Key files: `src/generated/api.ts` (validators), `src/generated/types/*.ts` (individual type files)
- Usage: `import { CreateEventBody, ListEventsResponse } from "@workspace/api-zod"`

**lib/db/**
- Purpose: Drizzle ORM schema definitions and database utilities
- Contains: Schema definitions split by domain, connection setup
- Key files:
  - `src/index.ts` — Exports `db` (Drizzle client) and `pool` (PostgreSQL pool)
  - `src/schema/index.ts` — Re-exports all schema tables
  - `src/schema/users.ts` — User accounts
  - `src/schema/organizations.ts` — Org workspaces
  - `src/schema/events.ts` — Event definitions
  - `src/schema/guests.ts` — Guest RSVPs
  - `src/schema/campaigns.ts` — Email campaigns
  - `src/schema/social_posts.ts` — Social media posts
  - `src/schema/team_members.ts` — Org team members
  - `src/schema/sending_domains.ts` — Custom SMTP domains
  - `src/schema/integrations.ts` — Third-party integration credentials
  - `src/schema/reminders.ts` — Event reminders/notifications
  - `src/schema/activity.ts` — Audit/activity log

## Key File Locations

**Frontend Entry & Routing:**
- `artifacts/hypespace/src/main.tsx` — React root render
- `artifacts/hypespace/src/App.tsx` — Wouter router with all routes

**Frontend Pages (Route Handlers):**
- `artifacts/hypespace/src/pages/dashboard.tsx` — Main dashboard
- `artifacts/hypespace/src/pages/events/event-list.tsx` — Event listing/management
- `artifacts/hypespace/src/pages/events/event-detail.tsx` — Event details view
- `artifacts/hypespace/src/pages/events/event-edit.tsx` — Event editor
- `artifacts/hypespace/src/pages/campaigns/campaign-list.tsx` — Campaign listing
- `artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx` — Campaign editor
- `artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx` — AI suggestions for campaigns
- `artifacts/hypespace/src/pages/social/social-list.tsx` — Social post management
- `artifacts/hypespace/src/pages/team/team-list.tsx` — Team member management
- `artifacts/hypespace/src/pages/settings.tsx` — Organization settings
- `artifacts/hypespace/src/pages/calendar.tsx` — Calendar view of events
- `artifacts/hypespace/src/pages/public-event.tsx` — Public event landing page (read-only)

**Frontend UI Components:**
- `artifacts/hypespace/src/components/ui/` — shadcn/ui primitive components (button, input, dialog, etc.)
- `artifacts/hypespace/src/components/layout/app-layout.tsx` — Main app wrapper with sidebar/navbar
- `artifacts/hypespace/src/components/layout/sidebar.tsx` — Navigation sidebar
- `artifacts/hypespace/src/components/layout/navbar.tsx` — Top navigation bar
- `artifacts/hypespace/src/components/events/event-creation-modal.tsx` — Reusable event creation form
- `artifacts/hypespace/src/components/events/bulk-email-dialog.tsx` — Bulk email to guests
- `artifacts/hypespace/src/components/campaigns/campaign-creation-modal.tsx` — Reusable campaign creation form

**Frontend Utilities:**
- `artifacts/hypespace/src/lib/utils.ts` — `cn()` utility for Tailwind class merging
- `artifacts/hypespace/src/lib/campaign-suggestions.ts` — HTML building blocks for AI campaign suggestions
- `artifacts/hypespace/src/components/auth-provider.tsx` — Authentication context and user/org state
- `artifacts/hypespace/src/hooks/use-toast.ts` — Toast notification hook
- `artifacts/hypespace/src/hooks/use-mobile.tsx` — Mobile breakpoint detection

**Frontend Styling:**
- `artifacts/hypespace/src/index.css` — Tailwind CSS v4 theme configuration with HSL CSS variables

**Backend Entry & Setup:**
- `artifacts/api-server/src/index.ts` — Server entry point (PORT check, listen)
- `artifacts/api-server/src/app.ts` — Express app creation and middleware setup
- `artifacts/api-server/src/routes/index.ts` — Route aggregation

**Backend Routes (Domain-Organized):**
- `artifacts/api-server/src/routes/auth.ts` — Login, register, auth/me
- `artifacts/api-server/src/routes/organizations.ts` — Organization management
- `artifacts/api-server/src/routes/team.ts` — Team member invitations
- `artifacts/api-server/src/routes/events.ts` — Event CRUD + guest counts
- `artifacts/api-server/src/routes/guests.ts` — Guest CRUD + plan limits
- `artifacts/api-server/src/routes/campaigns.ts` — Campaign CRUD + AI generation + send
- `artifacts/api-server/src/routes/social.ts` — Social post creation/publishing
- `artifacts/api-server/src/routes/dashboard.ts` — Aggregated dashboard stats
- `artifacts/api-server/src/routes/reminders.ts` — Event reminder scheduling
- `artifacts/api-server/src/routes/integrations.ts` — Third-party sync (GoHighLevel, HubSpot, etc.)
- `artifacts/api-server/src/routes/sending-domains.ts` — Custom email domain configuration
- `artifacts/api-server/src/routes/health.ts` — Health check endpoint
- `artifacts/api-server/src/routes/email-provider.ts` — Email service provider settings
- `artifacts/api-server/src/routes/plans.ts` — Plan and pricing information

**Backend Utilities:**
- `artifacts/api-server/src/lib/logger.ts` — Pino logger instance
- `artifacts/api-server/src/lib/plans.ts` — Plan tier definitions and limit validation
- `artifacts/api-server/src/lib/email.ts` — Nodemailer email sending abstraction
- `artifacts/api-server/src/lib/app-url.ts` — Application URL generation (domain-aware)

## Naming Conventions

**Files:**
- Pages: kebab-case with domain prefix (e.g., `event-list.tsx`, `campaign-edit.tsx`)
- Components: PascalCase in directories (e.g., `EventCreationModal` → `event-creation-modal.tsx`)
- Routes: kebab-case matching domain (e.g., `events.ts`, `sending-domains.ts`)
- Utilities: kebab-case with `use-` prefix for hooks (e.g., `use-toast.ts`)
- Schemas: plural nouns (e.g., `users.ts`, `events.ts`, `social_posts.ts`)

**Directories:**
- Pages: kebab-case, grouped by feature domain (e.g., `pages/events/`, `pages/campaigns/`)
- Components: kebab-case, grouped by concern (e.g., `components/ui/`, `components/layout/`)
- Routes: single file per domain (e.g., `routes/events.ts`, not `routes/events/index.ts`)

**Functions & Variables:**
- camelCase for all functions, variables, constants
- Type names: PascalCase
- Zod schemas: PascalCase (e.g., `CreateEventBody`)

**Database:**
- Tables: camelCase with `Table` suffix (e.g., `eventsTable`, `guestsTable`)
- Columns: snake_case in SQL (mapped by Drizzle)
- Dates: `timestamp` type with timezone, defaultNow(), updatedAt tracking
- IDs: serial primary key or uuid for public identifiers

## Where to Add New Code

**New Page/Feature:**
- Page component: `artifacts/hypespace/src/pages/{feature}/{page-name}.tsx`
- Add route in `artifacts/hypespace/src/App.tsx` inside `<Switch>`
- If feature has forms/dialogs, create reusable modal in `artifacts/hypespace/src/components/{feature}/`

**New API Endpoint:**
1. Update `lib/api-spec/openapi.yaml` with endpoint definition
2. Run Orval: generates hooks in `api-client-react/src/generated/` and validators in `api-zod/src/generated/`
3. Create route handler in `artifacts/api-server/src/routes/{domain}.ts`
4. Register router in `artifacts/api-server/src/routes/index.ts`
5. Use auto-generated Zod validators in handler for input/output validation

**New Database Table:**
1. Create schema file: `lib/db/src/schema/{entity}.ts` (or add to existing domain file)
2. Define table with Drizzle, export insert schema for migrations
3. Add to `lib/db/src/schema/index.ts` exports
4. Run `pnpm drizzle-kit push` in `lib/db/` to apply to PostgreSQL
5. Use in backend routes via `import { db, {entity}Table } from "@workspace/db"`

**New Component:**
- Shared across pages: `artifacts/hypespace/src/components/{concern}/`
- Domain-specific: `artifacts/hypespace/src/components/{feature}/{component-name}.tsx`
- Primitive UI: Use shadcn/ui from `components/ui/`

**New Utility/Hook:**
- Frontend utility: `artifacts/hypespace/src/lib/{utility-name}.ts`
- Frontend hook: `artifacts/hypespace/src/hooks/use-{hook-name}.ts` or `use-{hook-name}.tsx`
- Backend utility: `artifacts/api-server/src/lib/{utility-name}.ts`

## Special Directories

**artifacts/hypespace/public/**
- Purpose: Static assets served at root (favicon, robots.txt, etc.)
- Generated: No
- Committed: Yes

**artifacts/api-server/dist/**
- Purpose: Compiled JavaScript output from esbuild
- Generated: Yes (`pnpm build`)
- Committed: No

**artifacts/hypespace/dist/**
- Purpose: Built SPA output from Vite
- Generated: Yes (`pnpm build`)
- Committed: No

**lib/api-client-react/src/generated/** & **lib/api-zod/src/generated/**
- Purpose: Code generated by Orval from OpenAPI schema
- Generated: Yes (via Orval from `lib/api-spec/openapi.yaml`)
- Committed: Yes (auto-generated but committed for reproducibility)
- Never edit directly; regenerate by updating openapi.yaml and running Orval

**node_modules/**
- Purpose: Installed dependencies (pnpm)
- Generated: Yes (`pnpm install`)
- Committed: No (lockfile: `pnpm-lock.yaml` is committed)

**.planning/codebase/**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by /gsd-map-codebase)
- Committed: Yes

---

*Structure analysis: 2026-04-15*
