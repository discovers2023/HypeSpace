# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript ~5.9.2 - Used across all packages (monorepo, frontend, backend, database)
- JavaScript - Runtime execution

**Secondary:**
- CSS 4 - Styling via Tailwind CSS v4
- SQL - PostgreSQL dialect via Drizzle ORM

## Runtime

**Environment:**
- Node.js - Backend runtime for Express API server
- Browser (ES2020+) - Frontend runtime via Vite

**Package Manager:**
- pnpm 9.x - Monorepo package manager with workspace support
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- React 19.1.0 - Frontend UI framework
- Express 5 - Backend HTTP server and routing
- Vite 7.3.0 - Frontend build tool and dev server

**UI Components:**
- shadcn/ui (New York variant) - Pre-built Radix UI component library (`@radix-ui/*` v1.x packages)
- Tailwind CSS 4.1.14 - Utility-first CSS framework with Vite plugin
- Class Variance Authority 0.7.1 - Component variant management

**Styling:**
- Tailwind CSS 4.1.14 - Configured with HSL CSS variables for theming in `artifacts/hypespace/src/index.css`
- @tailwindcss/vite 4.1.14 - Build-time CSS processing
- @tailwindcss/typography 0.5.15 - Prose styling for rich text content

**Forms & Validation:**
- React Hook Form 7.55.0 - Form state management and submission
- @hookform/resolvers 3.10.0 - Zod resolver for form validation
- Zod 3.25.76 - Schema validation and type inference

**Data Fetching:**
- TanStack React Query 5.90.21 (@tanstack/react-query) - Client-side caching, fetching, and mutation management

**Routing:**
- Wouter 3.3.5 - Lightweight client-side router (not React Router)

**UI Utilities:**
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

**Database:**
- Drizzle ORM 0.45.1 - Type-safe SQL query builder and ORM
- Drizzle Kit 0.31.9 - Schema migrations and introspection CLI
- Drizzle Zod 0.8.3 - Automatic Zod schema generation from Drizzle tables
- pg 8.20.0 - PostgreSQL client for Node.js
- PostgreSQL 16 (Alpine) - Database server

**API & Serialization:**
- Zod 3.25.76 - Runtime validation and type inference for API contracts (custom `@workspace/api-zod` package)

**Email:**
- Nodemailer 8.0.5 - SMTP email client (supports both custom SMTP and Ethereal test accounts)

**Authentication & Security:**
- bcryptjs 3.0.3 - Password hashing
- Cookie Parser 1.4.7 - Cookie middleware for Express
- CORS 2.x - Cross-origin resource sharing middleware

**Calendar Integration:**
- node-ical 0.26.0 - iCalendar (.ics) parsing for Google Calendar, Outlook, Apple Calendar feeds

**Logging:**
- Pino 9.x - Fast JSON logger for Node.js
- Pino HTTP 10.x - HTTP request logging middleware for Express
- Pino Pretty 13.x - Pretty-print Pino logs in development
- esbuild-plugin-pino 2.3.3 - Build-time Pino optimization for bundling

**Build & Dev Tools:**
- esbuild 0.27.3 - Fast JavaScript bundler (used for API server build)
- @vitejs/plugin-react 5.0.4 - Vite React plugin with SWC support
- tsx 4.21.0 - TypeScript execution and module resolution
- Thread-stream 3.1.0 - Worker thread stream for Pino
- Prettier 3.8.1 - Code formatter (workspace-level)

**Replit-Specific Tools:**
- @replit/vite-plugin-cartographer 0.5.1 - Development visualization plugin
- @replit/vite-plugin-dev-banner 0.1.1 - Development banner display
- @replit/vite-plugin-runtime-error-modal 0.0.6 - Runtime error overlay in Replit

## Key Dependencies

**Critical:**
- `react` 19.1.0 - Application framework
- `express` 5 - HTTP server
- `drizzle-orm` 0.45.1 - Database abstraction
- `zod` 3.25.76 - Runtime validation (used in frontend forms, backend routes, and API contracts)
- `pino` 9.x - Observability
- `nodemailer` 8.0.5 - Email delivery (critical for campaign/invitation emails)
- `pg` 8.20.0 - PostgreSQL connectivity

**Infrastructure:**
- `@tanstack/react-query` 5.90.21 - Data synchronization and caching
- `bcryptjs` 3.0.3 - Credential protection
- `node-ical` 0.26.0 - Calendar integration (Google, Outlook, Apple)
- `framer-motion` 12.23.24 - Animation engine

## Configuration

**Environment:**
- `.env` file at root with DATABASE_URL, SMTP credentials, optional APP_BASE_URL, API_PROXY_TARGET
- Environment-specific configs:
  - `DATABASE_URL` - PostgreSQL connection string (required)
  - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` - Email provider config (optional, falls back to Ethereal test account)
  - `APP_BASE_URL` - Application URL for generating links (optional, auto-detected on Replit)
  - `NODE_ENV` - "development" or "production"
  - `PORT` - API server port (default via pnpm scripts)
  - `LOG_LEVEL` - Pino log level (default: "info")
  - `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` - Replit-specific domain detection

**Build:**
- `artifacts/hypespace/vite.config.ts` - Frontend Vite configuration with React, Tailwind, path aliases, API proxy
- `artifacts/api-server/build.mjs` - esbuild ESM bundler configuration with Pino plugin, external modules list
- `lib/db/drizzle.config.ts` - PostgreSQL dialect configuration for migrations
- `tsconfig.base.json` - Shared TypeScript configuration for workspace
- `pnpm-workspace.yaml` - Workspace package definitions and dependency catalog

**Linting & Formatting:**
- Prettier 3.8.1 configured at root level (no `.prettierrc` specifics documented)
- No ESLint configuration detected (formatting-only approach)

## Platform Requirements

**Development:**
- Node.js 16+ (TypeScript/tsx support)
- pnpm 9.x
- Docker Compose (for local PostgreSQL via `docker-compose.yml`)
- PostgreSQL 16 connection (via Docker or external service)
- Environment variables: `DATABASE_URL` (required), `PORT`, `BASE_PATH` (for frontend dev)

**Production:**
- Node.js 18+ recommended
- PostgreSQL 16+ database
- SMTP server or email provider credentials (or Ethereal for testing)
- Docker or container runtime (optional, not configured in repo)

**Optional:**
- Replit (environment auto-detection available for `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS`)
- Custom SMTP provider with relay support (nodemailer supports any SMTP)
- Calendar integration requires public iCalendar feed URLs (no auth required for read-only)
- GoHighLevel API key and Location ID for contact import integration

---

*Stack analysis: 2026-04-15*
