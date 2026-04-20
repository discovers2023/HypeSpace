# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**Contact Management (CRM):**
- **GoHighLevel (GHL)** - Lead/contact management and RSVP tagging
  - SDK/Client: Native fetch with `Authorization: Bearer` headers
  - Base URL: `https://services.leadconnectorhq.com`
  - API Version: `2021-07-28`
  - Auth: `GHL_API_KEY` stored in `integrations.metadata.apiKey`
  - Location ID: Required in `integrations.metadata.locationId`
  - Functions: Contact import preview, bulk import, RSVP tag sync
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 10-402)
  - RSVP tag mapping: `confirmed` → `studyclub-rsvp-yes`, `maybe` → `studyclub-rsvp-maybe`, `declined` → `studyclub-rsvp-no`

- **Custom CRM (Webhook)** - Webhook-based RSVP sync to user's own CRM
  - SDK/Client: Native fetch POST
  - Auth: Optional Bearer token in `integrations.metadata.apiKey`
  - Webhook URL: `integrations.metadata.webhookUrl`
  - Payload: `{ event, guest, rsvpStatus, timestamp, source: "hypespace", contactListId? }`
  - Best-effort delivery (non-fatal on failure)
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 410-452)

**AI Email Generation:**
- **Anthropic Claude API** - Email campaign content generation
  - SDK/Client: `@anthropic-ai/sdk` v0.90.0
  - Auth: `ANTHROPIC_API_KEY` env var
  - Use: Campaign subject, HTML/text content, and suggestions (email campaigns only)
  - Model: Not specified in code (defaults to Claude's current)
  - File: `artifacts/api-server/src/lib/ai-campaign.ts`

**Calendar Integration:**
- **Google Calendar (iCalendar)** - Event list import
  - SDK/Client: `node-ical` v0.26.0
  - Auth: Public iCalendar feed URL (no auth required)
  - Calendar URL: `integrations.metadata.calendarUrl`
  - Source type: `google` (for filtering)
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 483-524)

- **Microsoft Outlook (iCalendar)** - Event list import
  - SDK/Client: `node-ical` v0.26.0
  - Auth: Public iCalendar feed URL
  - Calendar URL: `integrations.metadata.calendarUrl`
  - Source type: `outlook` (for filtering)
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 483-524)

- **Apple Calendar (iCalendar)** - Event list import
  - SDK/Client: `node-ical` v0.26.0
  - Auth: Public iCalendar feed URL
  - Calendar URL: `integrations.metadata.calendarUrl`
  - Source type: `apple` (for filtering)
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 483-524)

- **Generic iCalendar** - Custom .ics feeds
  - SDK/Client: `node-ical` v0.26.0
  - Auth: Public feed URL
  - Calendar URL: `integrations.metadata.calendarUrl`
  - Source type: `ical` (generic)
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 483-524)

## Data Storage

**Databases:**
- **PostgreSQL 16** (primary)
  - Connection: `DATABASE_URL` env var (required)
  - Client: `pg` v8.20.0 (native Node.js driver)
  - ORM: Drizzle ORM v0.45.1
  - Pool: Single connection pool in `lib/db/src/index.ts`
  - Tables: users, organizations, team_members, events, guests, campaigns, social_posts, reminders, sending_domains, integrations, activity
  - Locale: PostgreSQL 16-Alpine in Docker (via `docker-compose.yml`)

**File Storage:**
- **Local filesystem only** - No cloud storage integrated
  - Cover images: Stored as URLs in `events.coverImageUrl` (external CDN expected)
  - Social media content: Stored as URLs in `social_posts.postUrl`
  - Email templates: Stored as HTML text in `campaigns.htmlContent`

**Caching:**
- **Client-side:** TanStack React Query (memory) - `queryClient.invalidateQueries()` for mutations
- **Server-side:** None (stateless Express server)

## Authentication & Identity

**Auth Provider:**
- **Custom cookie-based sessions** - In-progress implementation
  - Current state: Hardcoded `userId = 1` in development (`artifacts/api-server/src/routes/auth.ts` line 15)
  - Sessions middleware: `express-session` v1.19.0
  - Cookie parser: `cookie-parser` v1.4.7
  - Session secret: `SESSION_SECRET` env var (required for production)
  - Password hashing: bcryptjs v3.0.3 (bcrypt)
  - Email verification: Required before login (`emailVerified` column)

- **CSRF Protection:** `csrf-csrf` v4.0.3 middleware (implemented)
  - CSRF tokens generated per session
  - File: `artifacts/api-server/src/routes/auth.ts`

- **Organization Scoping:** All routes require `orgId` path parameter
  - Org membership enforced via `teamMembersTable`
  - Auth context: `AuthProvider` in `artifacts/hypespace/src/components/auth-provider.tsx`
  - Admin impersonation: `startImpersonation()` / `stopImpersonation()` for testing

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, etc.)

**Logs:**
- **Pino v9.x** - Structured JSON logging
  - Configuration: `artifacts/api-server/src/lib/logger.ts`
  - Development: Pretty-printed with colors (pino-pretty transport)
  - Production: JSON format for log aggregation
  - Log level: Configurable via `LOG_LEVEL` env var (default: "info")
  - HTTP middleware: `pino-http` v10.x with request ID, method, URL, status code
  - Sensitive headers redacted: `authorization`, `cookie`, `set-cookie`
  - Console logs: Direct `console.log()` for email notifications and GHL/CRM sync messages

## CI/CD & Deployment

**Hosting:**
- **Replit** (primary dev/demo target)
  - Domain detection: `REPLIT_DOMAINS` (production) or `REPLIT_DEV_DOMAIN` (dev)
  - Auto-detection in `artifacts/api-server/src/lib/app-url.ts`
  - Vite plugins: Cartographer (visualization), DevBanner, RuntimeErrorModal

- **Supports standard Node.js hosting** - AWS, Google Cloud, Azure, traditional VPS
  - Docker Compose provided for local PostgreSQL development

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, etc.)

## Environment Configuration

**Required env vars (production):**
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:pass@host:port/database`)
- `ANTHROPIC_API_KEY` - Claude API key for email generation
- `SESSION_SECRET` - Session encryption key (min 32 chars)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email relay or custom SMTP provider
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` - Email sender identity

**Optional env vars:**
- `PORT` - API server port (default: 4000 when not in Replit)
- `BASE_PATH` - Frontend base URL path (default: `/`)
- `VITE_PORT` - Frontend dev server port (default: 5173)
- `API_PROXY_TARGET` - Backend URL for Vite proxy (default: `http://localhost:4000`)
- `APP_BASE_URL`, `APP_URL` - Full application URL (auto-detected from Replit domains)
- `NODE_ENV` - "development" or "production" (affects logging, plugins)
- `LOG_LEVEL` - Pino log level (default: "info")
- `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` - Auto-detected Replit hostnames
- `ALLOWED_ORIGINS` - CORS allowed origins
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - Seed/bootstrap credentials (not fully implemented)

**Secrets location:**
- `.env` file at project root (NOT in git; `.gitignore` present)
- Database credentials in `DATABASE_URL`
- API keys in `ANTHROPIC_API_KEY`
- SMTP credentials in `SMTP_*` vars
- Session secret in `SESSION_SECRET`

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook receivers in routes)

**Outgoing:**
- **Custom CRM webhook** - RSVP sync endpoint
  - Triggered: On guest RSVP status change
  - Method: POST to `integrations.metadata.webhookUrl`
  - Payload: `{ event, guest, rsvpStatus, timestamp, source, contactListId? }`
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 410-452)
  - Best-effort (non-fatal on failure)

- **GoHighLevel API** - RSVP tag updates
  - Not a webhook; direct API calls to GHL on RSVP change
  - Tag-based sync for RSVP status tracking
  - File: `artifacts/api-server/src/routes/integrations.ts` (lines 365-402)

## Integration Management

**Storage:**
- `integrations` table in PostgreSQL
  - Columns: `id`, `organizationId`, `platform`, `platformType`, `status`, `accountName`, `accountId`, `metadata` (JSONB), `connectedAt`, `updatedAt`
  - File: `lib/db/src/schema/integrations.ts`

**Endpoints:**
- `GET /organizations/:orgId/integrations` - List connected integrations
- `POST /organizations/:orgId/integrations` - Connect a new integration (platform, metadata)
- `DELETE /organizations/:orgId/integrations/:platform` - Disconnect integration

**GHL-specific endpoints:**
- `POST /organizations/:orgId/integrations/gohighlevel/preview` - Fetch contacts from GHL (for preview)
- `POST /organizations/:orgId/integrations/gohighlevel/import` - Bulk import GHL contacts as event guests
  - Enforces plan attendee limits (capped import on quota exceeded)
  - Returns: `{ imported, skipped, total, planCapped }`

**Calendar-specific endpoints:**
- `GET /organizations/:orgId/calendar/events?year=YYYY&month=MM` - Fetch events from all connected calendars
  - Returns: `{ events, errors }` (errors on a per-platform basis)

---

*Integration audit: 2026-04-20*
