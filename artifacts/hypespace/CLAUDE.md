# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HypeSpace is a full-stack TypeScript event management platform with email campaigns, social media posting, team management, and guest RSVP. It lives in a pnpm monorepo.

## Commands

```bash
# Frontend (from this directory: artifacts/hypespace)
pnpm dev              # Start Vite dev server (requires PORT and BASE_PATH env vars)
pnpm build            # Production build (output: dist/public)
pnpm typecheck        # TypeScript type checking (tsc --noEmit)

# Database (from lib/db)
pnpm drizzle-kit push  # Push schema changes to PostgreSQL
pnpm drizzle-kit generate  # Generate migration files
```

There are no test scripts configured in this project.

## Architecture

### Monorepo Layout

- `artifacts/hypespace/` — React frontend (Vite + Wouter router)
- `artifacts/api-server/` — Express.js v5 backend API
- `lib/db/` — Drizzle ORM schema and database utilities (PostgreSQL)
- `lib/api-client-react/` — Auto-generated React Query hooks for API consumption

### Frontend (artifacts/hypespace/src)

- **Router**: Wouter (not React Router). Routes defined in `App.tsx` via `<Switch>/<Route>`.
- **UI components**: shadcn/ui (New York style) in `components/ui/`. Config in `components.json`.
- **Styling**: Tailwind CSS v4 with HSL CSS variables for theming in `index.css`.
- **Data fetching**: Auto-generated TanStack React Query hooks from `@workspace/api-client-react`. Mutations invalidate via `queryClient.invalidateQueries()`.
- **Forms**: React Hook Form + Zod validation.
- **Path aliases**: `@/` → `src/`, `@assets/` → attached assets directory.

### Backend (artifacts/api-server/src)

- Express routes under `/api` — organized by domain: `auth`, `events`, `guests`, `campaigns`, `social`, `team`, `integrations`, `dashboard`, `sending-domains`, `reminders`.
- Cookie-based session authentication.
- All API routes are proxied from the Vite dev server (`/api` → `http://localhost:4000`).

### Database (lib/db/src/schema)

Drizzle ORM with PostgreSQL. Schema files split by domain: `users`, `organizations`, `team_members`, `events`, `guests`, `campaigns`, `social_posts`, `integrations`, `reminders`, `sending_domains`, `activity`.

### Key Data Flow

Frontend pages import auto-generated hooks (e.g., `useListEvents()`, `useDeleteEvent()`) from `@workspace/api-client-react` → hooks call Express API → Express routes use Drizzle ORM → PostgreSQL.

## Environment Variables

- `PORT` — Dev server port (required)
- `BASE_PATH` — Base URL path for Vite (required)
- `DATABASE_URL` — PostgreSQL connection string (required for backend/db)
- `API_PROXY_TARGET` — Backend URL for Vite proxy (default: `http://localhost:4000`)

## Integrations

The platform supports GoHighLevel (contact import), HubSpot (contact sync), Zapier, and social platforms (Instagram, TikTok, Facebook, Twitter, LinkedIn, YouTube). Custom email domains via SMTP are configurable through sending domains.
