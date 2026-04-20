# Directory Structure

**Analysis Date:** 2026-04-20

## Top-Level Layout

```
HypeSpace/
├── artifacts/                    # Workspace apps (entry-point packages)
│   ├── api-server/               # Express 5 REST API
│   ├── hypespace/                # React 19 SPA (web + source for mobile)
│   ├── hypespace-mobile/         # Capacitor v6 wrapper (iOS/Android)
│   └── mockup-sandbox/           # Scratch/prototype space
├── lib/                          # Workspace shared libraries
│   ├── api-spec/                 # OpenAPI source of truth
│   ├── api-zod/                  # Generated Zod validators
│   ├── api-client-react/         # Generated TanStack React Query hooks
│   └── db/                       # Drizzle schema + client
├── .planning/                    # GSD workflow state (phases, plans, intel, UAT)
├── CLAUDE.md                     # Project instructions for Claude
├── PROGRESS-REPORT.md            # Current sprint progress snapshot
├── docker-compose.yml            # Local Postgres 16 via `db` service
├── pnpm-workspace.yaml           # Workspace definitions + dep catalog
├── package.json                  # Root scripts (dev/build/typecheck)
├── pnpm-lock.yaml                # Lockfile
└── tsconfig.base.json            # Shared TS config (strict, isolatedModules)
```

## Backend — `artifacts/api-server/src/`

```
artifacts/api-server/src/
├── app.ts                        # Express app setup (CORS, session, routes)
├── index.ts                      # Entry point — reads PORT, calls app.listen()
├── routes/
│   ├── index.ts                  # Router aggregation + requireAuth + requireOrgMembership
│   ├── admin.ts                  # Admin impersonation (cross-org)
│   ├── auth.ts                   # Login/logout/register/me + session
│   ├── campaigns.ts              # Campaigns CRUD + AI generation + send
│   ├── dashboard.ts              # Recent activity + counts
│   ├── email-provider.ts         # SMTP config test/save
│   ├── events.ts                 # Events CRUD, public /e/:slug, RSVP
│   ├── guests.ts                 # Guests CRUD, CSV/GHL import, RSVP
│   ├── health.ts                 # /health, /healthz
│   ├── integrations.ts           # GHL + HubSpot sync, calendar import
│   ├── organizations.ts          # Org CRUD, switching active org
│   ├── plans.ts                  # Plan catalog
│   ├── reminders.ts              # Scheduled reminder list
│   ├── sending-domains.ts        # Per-org SMTP domain config
│   ├── social.ts                 # Social posts CRUD
│   ├── team.ts                   # Invite, accept, role management
│   └── tracking.ts               # Email open/click tracking pixels (unauth)
├── lib/
│   ├── ai-campaign.ts            # Claude API — campaign copy generation
│   ├── ai-image.ts               # Image generation + public /campaign-images serving
│   ├── app-url.ts                # Base URL helper (APP_BASE_URL or Replit domain)
│   ├── email.ts                  # nodemailer sendEmail() + tracking injection
│   ├── logger.ts                 # Pino logger config
│   ├── plans.ts                  # Plan quota definitions + enforcement
│   └── scheduler.ts              # setInterval reminder dispatcher
└── types/
    └── session.d.ts              # express-session module augmentation (userId, activeOrgId)
```

**Notable:** No dedicated `middlewares/` directory — auth/org guards live inline in `routes/index.ts:40-86`. Keep this in mind when searching for middleware.

## Frontend — `artifacts/hypespace/src/`

```
artifacts/hypespace/src/
├── main.tsx                      # React DOM entry
├── App.tsx                       # Wouter <Switch> route table
├── index.css                     # Tailwind v4 + HSL CSS variables
├── pages/
│   ├── landing.tsx               # Marketing homepage
│   ├── login.tsx / register.tsx
│   ├── dashboard.tsx
│   ├── onboarding.tsx
│   ├── settings.tsx / profile.tsx
│   ├── calendar.tsx              # Multi-event calendar view
│   ├── public-event.tsx          # Public /e/:slug RSVP page
│   ├── accept-invite.tsx         # Team invite acceptance flow
│   ├── not-found.tsx / about.tsx / careers.tsx
│   ├── admin/index.tsx           # Admin console
│   ├── events/
│   │   ├── event-list.tsx
│   │   ├── event-new.tsx
│   │   ├── event-setup.tsx       # Redirected into event-edit
│   │   ├── event-edit.tsx        # Includes AI prompt bar
│   │   └── event-detail.tsx
│   ├── campaigns/
│   │   ├── campaign-list.tsx
│   │   ├── campaign-ai.tsx       # AI generation flow
│   │   └── campaign-edit.tsx     # Includes AI prompt bar
│   ├── social/social-list.tsx
│   └── team/team-list.tsx
├── components/
│   ├── auth-provider.tsx         # Session context + activeOrgId
│   ├── ai-prompt-bar.tsx         # Inline AI edit (recent: quick-260419-apb)
│   ├── ai-describe-button.tsx
│   ├── ai-description-button.tsx
│   ├── ai-improve-button.tsx
│   ├── ai-subject-variants-button.tsx
│   ├── cover-image-picker.tsx
│   ├── csv-import-modal.tsx
│   ├── ghl-import-modal.tsx
│   ├── timezone-picker.tsx
│   ├── campaigns/
│   │   └── campaign-creation-modal.tsx
│   ├── events/
│   │   ├── bulk-email-dialog.tsx
│   │   └── event-creation-modal.tsx
│   ├── layout/
│   │   ├── app-layout.tsx
│   │   ├── navbar.tsx
│   │   └── sidebar.tsx
│   ├── 3d/                       # Three.js/R3F landing visual
│   └── ui/                       # 55 shadcn/ui primitives (button, dialog, form, …)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
└── lib/
    └── utils.ts                  # `cn()` Tailwind class merger
```

## Mobile — `artifacts/hypespace-mobile/`

```
artifacts/hypespace-mobile/
├── android/                      # Capacitor-generated Android project
├── ios/                          # Capacitor-generated iOS project
├── capacitor.config.ts           # Native shell config (androidScheme: "https")
└── package.json
```

## Shared Libraries — `lib/`

```
lib/
├── api-spec/
│   ├── openapi.yaml              # Source of truth for API contract
│   └── package.json
├── api-zod/
│   ├── src/                      # Generated Zod schemas (InsertEvent, CreateCampaignBody, …)
│   └── dist/                     # Built artifact consumed by api-server
├── api-client-react/
│   ├── src/
│   │   ├── custom-fetch.ts       # ApiError + ResponseParseError classes
│   │   └── (generated hooks)     # useListEvents, useCreateCampaign, …
│   └── dist/
└── db/
    ├── src/
    │   ├── index.ts              # db client + table re-exports
    │   └── schema/
    │       ├── activity.ts
    │       ├── campaigns.ts
    │       ├── events.ts
    │       ├── guests.ts
    │       ├── integrations.ts
    │       ├── organizations.ts
    │       ├── reminders.ts
    │       ├── sending_domains.ts
    │       ├── social_posts.ts
    │       ├── team_members.ts
    │       ├── users.ts
    │       └── index.ts          # Re-exports all tables
    ├── drizzle.config.ts
    └── dist/
```

## Planning — `.planning/`

```
.planning/
├── PROJECT.md                    # Sprint charter + locked decisions
├── ROADMAP.md                    # Phase sequencing
├── REQUIREMENTS.md               # Phase requirements (Nyquist)
├── STATE.md                      # Current workflow cursor
├── codebase/                     # (this directory) — codebase maps
├── phases/
│   ├── 01-security-hardening/
│   ├── 02-multi-organization/
│   └── 03-campaign-quality/
├── intel/                        # Codebase intelligence files
└── milestones/                   # Archived completed milestones
```

## Naming Conventions

### Files

| Context | Convention | Example |
|---------|------------|---------|
| Backend routes | `[domain].ts` | `campaigns.ts`, `events.ts` |
| Backend lib | lowercase-dash | `ai-campaign.ts`, `app-url.ts` |
| Frontend pages | kebab-case `.tsx` | `campaign-list.tsx`, `event-edit.tsx` |
| Frontend components | kebab-case `.tsx` | `ai-prompt-bar.tsx`, `cover-image-picker.tsx` |
| Hooks | `use-[name].ts` | `use-mobile.tsx`, `use-toast.ts` |
| DB schema | `[entity].ts` in `schema/` | `users.ts`, `team_members.ts` |
| UI primitives | single-word lowercase | `button.tsx`, `dialog.tsx` |

### Symbols

- **Functions/variables:** `camelCase` (`generateSlug`, `formatCampaign`, `activeOrgId`)
- **Booleans:** `is`/`has`/`can` prefix (`isLoading`, `hasNoBody`, `canSendCampaigns`)
- **Constants:** `UPPER_SNAKE_CASE` when truly constant (`TOAST_LIMIT`, `SESSION_SECRET`)
- **Config objects:** `camelCase` keys (`STATUS_CONFIG`, `TYPE_ICON`)
- **Zod schemas:** `PascalCase` ending in `Schema` or `Body` (`CreateEventBody`, `editSchema`)
- **Interfaces/types:** `PascalCase` (`PlanLimits`, `CoverImagePickerProps`)
- **React component props:** `[ComponentName]Props`
- **DB inferred types:** `typeof table.$inferSelect` / `$inferInsert`

### Import Path Aliases

| Alias | Target | Scope |
|-------|--------|-------|
| `@/` | `artifacts/hypespace/src/` | Frontend only |
| `@assets/` | `attached_assets/` | Frontend only |
| `@workspace/db` | `lib/db/` | All workspaces |
| `@workspace/api-zod` | `lib/api-zod/` | All workspaces |
| `@workspace/api-client-react` | `lib/api-client-react/` | Frontend |

Backend uses workspace-package imports or relative paths — **no `@/` alias on the backend**.

## Key Locations (fast lookup)

| What | Where |
|------|-------|
| Add a new API endpoint | `artifacts/api-server/src/routes/[domain].ts` + register in `routes/index.ts` |
| Add a DB table | `lib/db/src/schema/[name].ts` + export from `schema/index.ts` |
| Add a new page | `artifacts/hypespace/src/pages/[name].tsx` + route in `App.tsx` |
| Add a UI primitive | `artifacts/hypespace/src/components/ui/[name].tsx` (shadcn) |
| Edit API contract | `lib/api-spec/openapi.yaml` → regen `api-zod` + `api-client-react` |
| Tweak CORS/session | `artifacts/api-server/src/app.ts` |
| Tweak auth guards | `artifacts/api-server/src/routes/index.ts:40-86` |
| Tweak plan limits | `artifacts/api-server/src/lib/plans.ts` |
| Tweak email send | `artifacts/api-server/src/lib/email.ts` |
| Env variables | `.env` at repo root (DATABASE_URL, SESSION_SECRET, SMTP_*, APP_BASE_URL) |
