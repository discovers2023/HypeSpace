# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

**CRM & Contact Management:**
- GoHighLevel (GHL) - Contact import, sync, and RSVP tag management
  - SDK/Client: Fetch API with custom implementation in `artifacts/api-server/src/routes/integrations.ts`
  - Auth: API key and Location ID stored in integrations table metadata
  - Base URL: `https://services.leadconnectorhq.com`
  - API Version: 2021-07-28 (hardcoded)
  - Features:
    - Fetch contacts by location and tags
    - Search contacts by email (for deduplication)
    - Create new contacts with tags
    - Update contact tags (RSVP status mapping: confirmed/maybe/declined → `studyclub-rsvp-*` tags)
    - Import contacts as event guests with plan-based attendee limits
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 41-97 for contact fetching, 275-326 for contact sync)

**Custom CRM Webhooks:**
- Custom Webhook URL - User-configurable webhook for RSVP sync
  - Auth: Optional Bearer token from integrations metadata
  - Format: JSON POST to user-provided URL
  - Payload: `{ event, guest, rsvpStatus, timestamp, source, contactListId }`
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 409-451, `syncRsvpToCustomCRM`)

**Calendar Integrations:**
- Google Calendar - iCalendar feed integration
  - Format: iCalendar (.ics) URL
  - Auth: Public calendar URL (no API auth required)
  - Client: `node-ical` package for parsing
  - Features: Fetch events by month, filter by date range
  - Color: #4285F4

- Microsoft Outlook Calendar - iCalendar feed integration
  - Format: iCalendar (.ics) URL
  - Auth: Public calendar URL (no API auth required)
  - Client: `node-ical` package
  - Color: #0078D4

- Apple Calendar - iCalendar feed integration
  - Format: iCalendar (.ics) URL
  - Auth: Public calendar URL (no API auth required)
  - Client: `node-ical` package
  - Color: #555555

- Generic iCalendar - Custom calendar feed
  - Format: iCalendar (.ics) URL
  - Auth: Public URL
  - Client: `node-ical` package
  - Color: #6366f1
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 482-574, calendar event fetching)

**Social Media (Planned/Tracked):**
- Instagram - Social post platform support
  - Status: Data model in place (`social_posts` table tracks platform field)
  - Publishing: Not yet implemented (posts tracked with status="draft" or "published")

- TikTok - Social post platform support
  - Status: Data model in place
  - Publishing: Not yet implemented

- Facebook - Social post platform support
  - Status: Data model in place
  - Publishing: Not yet implemented

- Twitter - Social post platform support
  - Status: Data model in place
  - Publishing: Not yet implemented

- LinkedIn - Social post platform support
  - Status: Data model in place
  - Publishing: Not yet implemented

- YouTube - Social post platform support
  - Status: Data model in place
  - Publishing: Not yet implemented
  - Implementation: `artifacts/api-server/src/routes/social.ts` - CRUD operations for social posts, no external API calls yet

**Email Campaign Platforms:**
- Zapier - Webhook capability for external automation
  - Status: Integration framework ready (custom_crm webhook sync can target Zapier)

## Data Storage

**Databases:**
- PostgreSQL 16 (Alpine)
  - Connection: `DATABASE_URL` environment variable (required)
  - Client: `pg` package v8.20.0
  - ORM: Drizzle ORM 0.45.1 with Drizzle Kit 0.31.9 for migrations
  - Schema location: `lib/db/src/schema/` (modular by domain: users, organizations, teams, events, guests, campaigns, social_posts, integrations, reminders, sending_domains, activity)
  - Migration tool: `pnpm run db:push` (Drizzle Kit)
  - Development: Docker Compose PostgreSQL at `localhost:5433`

**File Storage:**
- Local filesystem only - No cloud storage integration
  - Attached assets: `attached_assets/` directory for static files
  - Frontend build output: `artifacts/hypespace/dist/public/`

**Caching:**
- TanStack React Query (client-side) - In-memory query caching
- No server-side cache (Redis, Memcached) configured

## Authentication & Identity

**Auth Provider:**
- Custom - Email/password authentication
  - Implementation: `artifacts/api-server/src/routes/auth.ts`
  - Strategy: Cookie-based session (Express middleware)
  - Password hashing: bcryptjs with 12 salt rounds
  - Routes:
    - `POST /auth/register` - Create user account and organization
    - `POST /auth/login` - Email and password validation
    - `GET /auth/me` - Get current user details
  - No OAuth or third-party identity provider integration

## Monitoring & Observability

**Error Tracking:**
- None - No Sentry, Rollbar, or third-party error tracking service

**Logs:**
- Pino (JSON logging) - Configured for backend
  - Level: Controlled by `LOG_LEVEL` environment variable (default: "info")
  - Format: JSON (structured) in production, pretty-printed in development via `pino-pretty`
  - HTTP requests logged via `pino-http` middleware
  - Implementation: `artifacts/api-server/src/lib/logger.ts`

## CI/CD & Deployment

**Hosting:**
- Replit (primary development environment)
  - Auto-detection: REPLIT_DEV_DOMAIN, REPLIT_DOMAINS environment variables
  - Static files served from frontend build output

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI/CD configuration

**Deployment:**
- Manual or custom (not configured in repository)
- Build process: `pnpm build` (runs typecheck and builds all packages)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/hypespace`)

**Optional env vars (with defaults):**
- `PORT` - API server port (default: 4000 via pnpm scripts)
- `VITE_PORT` - Frontend dev server port (default: 5173)
- `BASE_PATH` - Frontend base URL path (default: "/")
- `API_PROXY_TARGET` - Vite proxy target for /api routes (default: "http://localhost:4000")
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email provider credentials
  - Fallback: Ethereal test account auto-provisioned if not provided
- `SMTP_PORT` - Email port (default: 587)
- `SMTP_FROM_EMAIL` - Sender email address (default: from SMTP_USER or "noreply@hypespace.app")
- `SMTP_FROM_NAME` - Sender display name (default: "HypeSpace")
- `APP_BASE_URL` - Application base URL (auto-detected on Replit if not set)
- `NODE_ENV` - "development" or "production"
- `LOG_LEVEL` - Pino log level (default: "info")
- `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` - Replit-specific domain configuration

**Secrets location:**
- `.env` file at repository root (git-ignored)
- Organization-specific SMTP config stored in `integrations` table with `platform="smtp_provider"`
- GoHighLevel API keys stored in `integrations.metadata` with `platform="gohighlevel"`

## Webhooks & Callbacks

**Incoming:**
- Webhook endpoint for custom CRM RSVP sync
  - Endpoint: User-configured URL (stored in integrations table)
  - Method: POST
  - Payload: Guest RSVP data with event details
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 409-451)

**Outgoing:**
- Email delivery via Nodemailer
  - Method: SMTP relay to configured provider
  - Events: User invitations, campaign sending, test emails
  - Implementation: `artifacts/api-server/src/lib/email.ts` (sendEmail, sendInviteEmail functions)

- RSVP Sync to GoHighLevel (tag updates)
  - Method: PUT to `https://services.leadconnectorhq.com/contacts/{contactId}`
  - Payload: Updated tags array
  - Best-effort (non-blocking) - Failures don't affect RSVP
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 331-359)

- RSVP Sync to Custom Webhook
  - Method: POST to user-configured webhook URL
  - Payload: JSON with guest, rsvpStatus, event title
  - Best-effort (non-blocking)
  - Implementation: `artifacts/api-server/src/routes/integrations.ts` (lines 409-451)

## Integration Data Models

**Integrations Table:**
- Location: `lib/db/src/schema/integrations.ts`
- Columns:
  - `id` (serial) - Primary key
  - `organizationId` (int) - Foreign key to organizations
  - `platform` (text) - Integration type (e.g., "gohighlevel", "google_calendar", "smtp_provider", "custom_crm")
  - `platformType` (text) - Category ("crm", "calendar", "email", etc.)
  - `status` (text) - "connected" or "disconnected"
  - `accountName` (text) - Display name for the connected account
  - `accountId` (text) - External account identifier
  - `metadata` (jsonb) - Platform-specific credentials and config
    - GoHighLevel: `{ apiKey, locationId }`
    - SMTP: `{ host, port, user, pass, fromEmail, fromName }`
    - Calendar: `{ calendarUrl }`
    - Custom CRM: `{ webhookUrl, apiKey, contactListId }`
  - `connectedAt`, `updatedAt` - Timestamps

**Sending Domains Table:**
- Location: `lib/db/src/schema/sending_domains.ts`
- Purpose: Custom email domain configuration for SMTP relay
- Columns:
  - `id` (serial) - Primary key
  - `organizationId` (int) - Foreign key
  - `domain` (text) - Custom domain for emails
  - `fromEmail`, `fromName` - Email address and display name
  - `dnsRecords` (jsonb) - DNS MX, DKIM, SPF records for configuration
  - `status` - "pending", "verifying", "verified", or "failed"
  - `verifiedAt` - Verification timestamp
  - `providerMeta` - Provider-specific metadata (e.g., SES identity ARN, Postmark server ID)
  - `createdAt`, `updatedAt` - Timestamps

## Plan-Based Feature Limits

**API Implementation:**
- Location: `artifacts/api-server/src/lib/plans.ts`
- Plans: "free", "starter", "professional"
- Limits enforced:
  - `attendeesPerEvent` - Max guests per event
  - `eventsPerMonth` - Max events in a rolling month
  - `campaignsPerMonth` - Max campaigns per month
  - `canSendCampaigns` - Boolean flag for campaign sending capability
- Enforcement: GHL contact import caps import size if limit exceeded; campaign sending returns 402 if free plan

---

*Integration audit: 2026-04-15*
