<!-- GSD:project-start source:PROJECT.md -->
## Project

**HypeSpace**

HypeSpace is a full-stack event management SaaS platform for organizations of any size — from solo operators to agencies managing multiple clients. It provides event creation, guest management with RSVP, AI-powered email campaign generation, social media scheduling, team collaboration, and tiered subscription plans. The platform targets a horizontal market: healthcare practices, SMBs, conferences, and event agencies.

**Core Value:** Event organizers can create an event, invite guests, and send polished email campaigns — the complete event lifecycle in one platform.

### Constraints

- **Timeline**: Resellable v1 by Monday April 20, 2026 (~4 days)
- **Tech stack**: Must keep existing stack (TypeScript, React, Express, Drizzle, Postgres) — no rewrites
- **Auth**: Cookie-based sessions already partially implemented — extend, don't replace
- **Budget**: Solo developer + AI — no external services beyond what's already integrated
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.2 - Used across all packages (monorepo, frontend, backend, database)
- JavaScript - Runtime execution
- CSS 4 - Styling via Tailwind CSS v4
- SQL - PostgreSQL dialect via Drizzle ORM
## Runtime
- Node.js - Backend runtime for Express API server
- Browser (ES2020+) - Frontend runtime via Vite
- pnpm 9.x - Monorepo package manager with workspace support
- Lockfile: `pnpm-lock.yaml` (present)
## Frameworks
- React 19.1.0 - Frontend UI framework
- Express 5 - Backend HTTP server and routing
- Vite 7.3.0 - Frontend build tool and dev server
- shadcn/ui (New York variant) - Pre-built Radix UI component library (`@radix-ui/*` v1.x packages)
- Tailwind CSS 4.1.14 - Utility-first CSS framework with Vite plugin
- Class Variance Authority 0.7.1 - Component variant management
- Tailwind CSS 4.1.14 - Configured with HSL CSS variables for theming in `artifacts/hypespace/src/index.css`
- @tailwindcss/vite 4.1.14 - Build-time CSS processing
- @tailwindcss/typography 0.5.15 - Prose styling for rich text content
- React Hook Form 7.55.0 - Form state management and submission
- @hookform/resolvers 3.10.0 - Zod resolver for form validation
- Zod 3.25.76 - Schema validation and type inference
- TanStack React Query 5.90.21 (@tanstack/react-query) - Client-side caching, fetching, and mutation management
- Wouter 3.3.5 - Lightweight client-side router (not React Router)
- Lucide React 0.545.0 - Icon library
- React Icons 5.4.0 - Additional icon sets
- Framer Motion 12.23.24 - Animation library
- Embla Carousel React 8.6.0 - Carousel/slider component
- Recharts 2.15.2 - Charting/visualization library
- Sonner 2.0.7 - Toast notifications
- next-themes 0.4.6 - Theme switching (dark/light mode)
- Date-fns 3.6.0 - Date manipulation utilities
- React Day Picker 9.11.1 - Date picker component
- React Resizable Panels 2.1.7 - Resizable panel layout
- Vaul 1.1.2 - Drawer component
- CMDk 1.1.1 - Command palette component
- Input OTP 1.4.2 - OTP input component
- tw-animate-css 1.4.0 - Tailwind animation utilities
- Drizzle ORM 0.45.1 - Type-safe SQL query builder and ORM
- Drizzle Kit 0.31.9 - Schema migrations and introspection CLI
- Drizzle Zod 0.8.3 - Automatic Zod schema generation from Drizzle tables
- pg 8.20.0 - PostgreSQL client for Node.js
- PostgreSQL 16 (Alpine) - Database server
- Zod 3.25.76 - Runtime validation and type inference for API contracts (custom `@workspace/api-zod` package)
- Nodemailer 8.0.5 - SMTP email client (supports both custom SMTP and Ethereal test accounts)
- bcryptjs 3.0.3 - Password hashing
- Cookie Parser 1.4.7 - Cookie middleware for Express
- CORS 2.x - Cross-origin resource sharing middleware
- node-ical 0.26.0 - iCalendar (.ics) parsing for Google Calendar, Outlook, Apple Calendar feeds
- Pino 9.x - Fast JSON logger for Node.js
- Pino HTTP 10.x - HTTP request logging middleware for Express
- Pino Pretty 13.x - Pretty-print Pino logs in development
- esbuild-plugin-pino 2.3.3 - Build-time Pino optimization for bundling
- esbuild 0.27.3 - Fast JavaScript bundler (used for API server build)
- @vitejs/plugin-react 5.0.4 - Vite React plugin with SWC support
- tsx 4.21.0 - TypeScript execution and module resolution
- Thread-stream 3.1.0 - Worker thread stream for Pino
- Prettier 3.8.1 - Code formatter (workspace-level)
- @replit/vite-plugin-cartographer 0.5.1 - Development visualization plugin
- @replit/vite-plugin-dev-banner 0.1.1 - Development banner display
- @replit/vite-plugin-runtime-error-modal 0.0.6 - Runtime error overlay in Replit
## Key Dependencies
- `react` 19.1.0 - Application framework
- `express` 5 - HTTP server
- `drizzle-orm` 0.45.1 - Database abstraction
- `zod` 3.25.76 - Runtime validation (used in frontend forms, backend routes, and API contracts)
- `pino` 9.x - Observability
- `nodemailer` 8.0.5 - Email delivery (critical for campaign/invitation emails)
- `pg` 8.20.0 - PostgreSQL connectivity
- `@tanstack/react-query` 5.90.21 - Data synchronization and caching
- `bcryptjs` 3.0.3 - Credential protection
- `node-ical` 0.26.0 - Calendar integration (Google, Outlook, Apple)
- `framer-motion` 12.23.24 - Animation engine
## Configuration
- `.env` file at root with DATABASE_URL, SMTP credentials, optional APP_BASE_URL, API_PROXY_TARGET
- Environment-specific configs:
- `artifacts/hypespace/vite.config.ts` - Frontend Vite configuration with React, Tailwind, path aliases, API proxy
- `artifacts/api-server/build.mjs` - esbuild ESM bundler configuration with Pino plugin, external modules list
- `lib/db/drizzle.config.ts` - PostgreSQL dialect configuration for migrations
- `tsconfig.base.json` - Shared TypeScript configuration for workspace
- `pnpm-workspace.yaml` - Workspace package definitions and dependency catalog
- Prettier 3.8.1 configured at root level (no `.prettierrc` specifics documented)
- No ESLint configuration detected (formatting-only approach)
## Platform Requirements
- Node.js 16+ (TypeScript/tsx support)
- pnpm 9.x
- Docker Compose (for local PostgreSQL via `docker-compose.yml`)
- PostgreSQL 16 connection (via Docker or external service)
- Environment variables: `DATABASE_URL` (required), `PORT`, `BASE_PATH` (for frontend dev)
- Node.js 18+ recommended
- PostgreSQL 16+ database
- SMTP server or email provider credentials (or Ethereal for testing)
- Docker or container runtime (optional, not configured in repo)
- Replit (environment auto-detection available for `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS`)
- Custom SMTP provider with relay support (nodemailer supports any SMTP)
- Calendar integration requires public iCalendar feed URLs (no auth required for read-only)
- GoHighLevel API key and Location ID for contact import integration
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Backend routes: `[domain].ts` (e.g., `campaigns.ts`, `events.ts`, `integrations.ts`)
- Utility/library files: descriptive lowercase names (e.g., `logger.ts`, `email.ts`, `plans.ts`)
- Frontend pages: kebab-case (e.g., `campaign-list.tsx`, `campaign-edit.tsx`)
- Frontend components: kebab-case (e.g., `cover-image-picker.tsx`, `timezone-picker.tsx`)
- React hooks: `use-[name].ts` (e.g., `use-toast.ts`)
- UI components: lowercase single-word or kebab-case (e.g., `button.tsx`, `dropdown-menu.tsx`)
- Database schemas: `[entity].ts` in `lib/db/src/schema/` (e.g., `events.ts`, `campaigns.ts`)
- camelCase for all functions (e.g., `generateSlug`, `formatCampaign`, `sendEmail`)
- Async functions are named identically to sync equivalents (no `async` suffix)
- Helper/utility functions prefixed with verb: `get`, `set`, `format`, `parse`, `send`, `validate`, `extract`, `patch`
- Route handlers follow pattern `router.METHOD("/path", async (req, res): Promise<void> => { ... })`
- camelCase for all variables and constants
- Constants that are truly constant use UPPER_SNAKE_CASE (e.g., `TOAST_LIMIT`, `MAX_SIZE`, `UNLIMITED`)
- Configuration objects use camelCase (e.g., `STATUS_CONFIG`, `TYPE_ICON`, `STOCK_IMAGES`)
- State variables in React use camelCase (e.g., `searchTerm`, `statusFilter`, `isOpen`)
- Boolean variables prefixed with `is`, `has`, or `can` (e.g., `isLoading`, `hasNoBody`, `canSendCampaigns`)
- Zod schemas use PascalCase ending in `Schema` (e.g., `editSchema`, `InsertEvent`, `CreateCampaignBody`)
- Interface names use PascalCase (e.g., `PlanLimits`, `CoverImagePickerProps`, `CustomFetchOptions`)
- Database inferred types: `typeof table.$inferSelect` for rows, `typeof table.$inferInsert` for insert payloads
- React props interface: `[ComponentName]Props` (e.g., `CoverImagePickerProps`)
## Code Style
- Prettier v3.8.1 installed; no `.prettierrc` config file (uses defaults)
- Line length: implicit ~80-120 chars (follows Prettier defaults)
- No ESLint or biome configured; relies on TypeScript strict mode
- Imports are auto-formatted and sorted (trailing commas on multi-line)
- TypeScript strict mode enabled in `tsconfig.base.json`:
- `isolatedModules: true` — allows esbuild to safely transpile
- `noUnusedLocals: false` — unused variables not checked (commonly left in code)
- `strictFunctionTypes: false` — allows flexibility with function signatures
- `skipLibCheck: true` — skips type checking of node_modules
## Import Organization
- Frontend: `@/` → `artifacts/hypespace/src/`
- Frontend assets: `@assets/` → `attached_assets/`
- Backend: No aliases; uses relative paths or workspace package names
- Used selectively in UI components (`components/ui/index.ts` exports all UI primitives)
- Database schema: `lib/db/src/schema/index.ts` re-exports all tables and types
- API client: `lib/api-client-react/src/index.ts` re-exports hooks and utilities
## Error Handling
- Validation errors: `res.status(400).json({ error: parsed.error.message })` after `Zod.safeParse()`
- Not found: `if (!resource) { res.status(404).json({ error: "Resource not found" }); return; }`
- Success with early return on error: `if (!parsed.success) { res.status(400).json(...); return; }`
- All route handlers use `Promise<void>` return type and inline error responses
- Try/catch with silent fallback: `try { /* logic */ } catch { return null; }` for optional config retrieval
- Uses implicit null return for missing resources
- No exception throwing for expected error cases
- Query hook errors accessed via `.error` property on query result
- Toast notifications for user-facing errors: `toast({ title: "Error", variant: "destructive" })`
- Validation errors shown inline on form fields via `<FormMessage>`
- File upload errors: validate type/size, show toast on failure
- Early return pattern: `if (error) return <ErrorUI />`
- Custom `ApiError` class in `lib/api-client-react/src/custom-fetch.ts` with `.status`, `.data`, `.message`
- Automatic error message building from response data (checks `title`, `detail`, `message`, `error_description`)
- Network/parse errors thrown as `ResponseParseError` with `.cause`
- No global error boundaries observed (errors handled per-route or per-hook)
## Logging
- Centralized logger config in `artifacts/api-server/src/lib/logger.ts`
- Development: Pretty-printed with colors via `pino-pretty`
- Production: JSON format
- Log level configurable via `LOG_LEVEL` env var (default: "info")
- HTTP request/response logging with redaction of sensitive headers: `authorization`, `cookie`, `set-cookie`
- Direct `console.log()` used for informational messages (e.g., email sent notifications)
- Format: `📧 Email sent to [email] (messageId: [id])`
- No standardized format; varies by context
## Comments
- JSDoc comments on exported functions with complex signatures or unclear purpose
- Inline comments for regex patterns or non-obvious logic (e.g., slug generation, extraction logic in `campaign-edit.tsx`)
- Section headers for code organization (e.g., `// ─── Schema ───`, `// ─── Component ────`)
- Comments explaining "why" not "what" (implementation details are self-explanatory from code)
- Used sparsely; mostly for utility functions with unclear intent
- Example: Email helper functions have parameter descriptions in object types
- No automated doc generation tool in place
## Function Design
- Utility functions: typically 10-50 lines
- Route handlers: 20-100 lines (includes DB query, validation, response formatting)
- React components: 50-300 lines (may include hooks, state, conditional rendering)
- No explicit size limits; smaller is preferred for testability (though no tests exist)
- Single object parameter for functions with 2+ arguments (e.g., email `opts` object in `sendEmail()`)
- Type the parameter explicitly with interface/type (e.g., `opts: { toEmail: string; ... }`)
- Database query results destructured in assignments (e.g., `const [campaign] = await db.select(...)`)
- Async functions return `Promise<T>` explicitly typed
- Route handlers use `Promise<void>` (responses sent via `res.json()`, `res.status()`)
- Nullable returns use explicit `T | null` (e.g., `getOrgSmtpConfig(): Promise<SmtpConfig | null>`)
- Database queries return arrays or single records via `.returning()`
## Module Design
- Backend: Named exports for functions, one default export for router (e.g., `export default app`)
- Frontend: Named exports for components and hooks
- Database: Named exports for tables, types, and Zod schemas; single default export for `db` client
- API client: Named exports for hooks and utilities
- Each domain (campaigns, events, etc.) exported as single `router: IRouter`
- Routes mounted in `routes/index.ts`: `app.use("/organizations", organizationsRouter)`, etc.
- All routes follow REST conventions: GET/POST/PUT/DELETE
- Export default function (the component)
- No re-exports of sub-components unless reused
- Props interface as separate named export (optional, used if props are complex)
- Schema files define table, insert schema, and type exports
- Central `lib/db/src/index.ts` re-exports `db` client, all tables, and utilities
- Drizzle ORM patterns: use `.$dynamic()` for conditional queries, `.$inferSelect` for row types
## Code Patterns
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Monorepo structure using pnpm workspaces with artifacts and lib packages
- Loosely-coupled frontend (React + Vite) and backend (Express.js) via REST API
- Shared API contracts using OpenAPI schema, auto-generated into Zod validators and React Query hooks
- Cookie-based session authentication (hardcoded organization ID for development)
- Plan-based feature access and resource quotas (free/starter/growth/agency tiers)
## Layers
- Purpose: User-facing React interface for event management, campaigns, guests, team
- Location: `artifacts/hypespace/src/`
- Contains: React components, pages, hooks, UI library integration (shadcn/ui), forms
- Depends on: TanStack React Query hooks from `@workspace/api-client-react`, Wouter router, Tailwind CSS styling
- Used by: End users via browser
- Purpose: REST API serving event/guest/campaign/team management endpoints
- Location: `artifacts/api-server/src/`
- Contains: Express route handlers, input/output validation using Zod, business logic
- Depends on: Drizzle ORM for database access, Zod schemas from `@workspace/api-zod`
- Used by: Frontend via HTTP requests
- Purpose: Database schema definition and ORM abstraction
- Location: `lib/db/src/schema/`
- Contains: Drizzle ORM table definitions split by domain (users, events, guests, campaigns, social_posts, reminders, integrations, etc.)
- Depends on: PostgreSQL, drizzle-orm
- Used by: Backend routes for all database operations
- Purpose: API specification and type generation
- Location: `lib/api-spec/openapi.yaml` (source of truth)
- Contains: OpenAPI 3.0 specification
- Generated outputs:
- Used by: Backend validates incoming requests, frontend consumes auto-generated hooks
## Data Flow
- Frontend: TanStack React Query for server state (caching, invalidation via `queryClient.invalidateQueries()`)
- Authentication: Context-based provider at `artifacts/hypespace/src/components/auth-provider.tsx` (currently hardcoded org ID = 1)
- Frontend organization context: AuthProvider tracks `activeOrgId` for impersonation support (admin feature)
- Backend: No persistent session state (stateless), validates based on org/user ID from request
## Key Abstractions
- Converts PostgreSQL timestamps to ISO-8601 strings
- Calculates derived fields (guest counts, confirmation percentages)
- Normalizes nulls and enums to API contract
- `artifacts/api-server/src/routes/events.ts` lines 29-62
- `artifacts/api-server/src/routes/campaigns.ts` lines 20-37
- Free: 1 event, 20 attendees, 1 user, no campaigns
- Starter: 3 events, 100 attendees, 3 users, campaigns enabled
- Growth: 15 events, 500 attendees, 10 users
- Agency: unlimited events/users, 2000 attendees per event
- React Query hooks from OpenAPI schema → `useListEvents()`, `useCreateEvent()`, etc.
- Zod validators for request/response bodies → `CreateEventBody.safeParse()`
## Entry Points
- Location: `artifacts/api-server/src/index.ts`
- Triggers: Node.js process startup (PORT env var required)
- Responsibilities: Parse environment, create Express app, bind to port with pino logging
- Location: `artifacts/hypespace/src/main.tsx`
- Triggers: Browser page load (Vite dev/prod build)
- Responsibilities: Render React root, set up providers (QueryClientProvider, AuthProvider, TooltipProvider, Wouter router)
- Location: `artifacts/api-server/src/app.ts`
- Triggers: Import in index.ts
- Responsibilities: Configure middleware (CORS, JSON parsing, pino logging), mount router at `/api`
- Location: `artifacts/api-server/src/routes/index.ts`
- Triggers: Import in app.ts
- Responsibilities: Aggregate all domain routers (auth, events, guests, campaigns, etc.)
## Error Handling
- **400 Bad Request:** Zod validation failure → `{ error: parsed.error.message }`
- **401 Unauthorized:** Missing/invalid user
- **402 Payment Required:** Plan limit exceeded (custom for quotas) → includes `{ error, message, limit, plan, current, max, suggestedPlan }`
- **404 Not Found:** Resource doesn't exist
- **409 Conflict:** Email already taken during registration
- `artifacts/api-server/src/routes/auth.ts` lines 32-36 (validation)
- `artifacts/api-server/src/routes/guests.ts` lines 64-66 (plan limit error)
- Queries use React Query error states (`isError`, `error` property)
- `useToast()` hook used for user notifications: `toast.error("Failed to send campaign")`
- Mutations use `onError` callbacks to display error messages
## Cross-Cutting Concerns
- Backend: Pino logger (`artifacts/api-server/src/lib/logger.ts`) with pino-http middleware
- HTTP requests auto-logged with request ID, method, URL, response status code
- Structured JSON logs for production observability
- Request bodies: Zod schemas from `@workspace/api-zod` via `safeParse()` before processing
- Frontend forms: React Hook Form + Zod for local validation before submission
- Both layers validate independently (defense in depth)
- Currently: Hardcoded user ID = 1 in backend (`artifacts/api-server/src/routes/auth.ts` line 15)
- Cookie-based session intent (infrastructure present but not fully implemented)
- Organization scoping: All operations include `orgId` parameter in route path
- Impersonation: AuthProvider supports `startImpersonation()` / `stopImpersonation()` for admin testing
- Key operations (guest added, event created, campaign sent) insert into `activityTable`
- Used for audit trail and recent activity UI display
- Format: `{ organizationId, type, title, description, createdAt }`
- Examples in `artifacts/api-server/src/routes/events.ts`, `guests.ts`, `campaigns.ts`
- GoHighLevel sync: `syncRsvpToGHL()` in `artifacts/api-server/src/routes/integrations.ts`
- HubSpot contact sync: `syncRsvpToCustomCRM()`
- Email provider configuration: Custom SMTP domains via `sendingDomainsTable`
- Social posting: `socialPostsTable` stores scheduled/published posts across platforms
- Reminders: Background task infrastructure (table exists, execution pattern TBD)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
