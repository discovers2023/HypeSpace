# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**
- TypeScript ~5.9.2 - Used across all packages (monorepo, frontend, backend, database migrations)
- JavaScript - Runtime execution for Node.js and browser

**Secondary:**
- CSS 4 - Styling via Tailwind CSS v4
- SQL - PostgreSQL dialect via Drizzle ORM
- Swift/Kotlin - Native iOS/Android support via Capacitor (compiled from shared web build)

## Runtime

**Environment:**
- Node.js 18+ - Backend runtime for Express API server, database migrations, build tooling
- Browser (ES2020+) - Frontend runtime via Vite; React 19 target
- iOS 15+ / Android 11+ - Mobile apps via Capacitor v6 wrapper

**Package Manager:**
- pnpm 9.x - Monorepo package manager with workspace support
- Lockfile: `pnpm-lock.yaml` (present at root)

## Frameworks

**Core:**
- React 19.1.0 - Frontend UI framework (web + mobile via Capacitor)
- Express 5 - Backend HTTP server and REST API routing
- Vite 7.3.0 - Frontend build tool and dev server
- Drizzle ORM 0.45.1 - Type-safe SQL query builder for PostgreSQL

**UI & Styling:**
- shadcn/ui (New York variant) - Pre-built Radix UI component library (`@radix-ui/*` v1.x packages)
- Tailwind CSS 4.1.14 - Utility-first CSS framework with Vite plugin
- @tailwindcss/vite 4.1.14 - Build-time CSS processing
- @tailwindcss/typography 0.5.15 - Prose styling for rich text content
- Class Variance Authority 0.7.1 - Component variant management

**Forms & Validation:**
- React Hook Form 7.55.0 - Form state management and submission
- @hookform/resolvers 3.10.0 - Zod resolver for form validation
- Zod 3.25.76 - Schema validation and type inference (used client & server)

**Data & State:**
- TanStack React Query 5.90.21 (@tanstack/react-query) - Client-side data fetching, caching, mutations
- React Context API - Organization/auth context via `AuthProvider`

**Routing:**
- Wouter 3.3.5 - Lightweight client-side router (not React Router)

**Visualization & Animation:**
- Framer Motion 12.23.24 - Animation library
- Recharts 2.15.2 - Charting/visualization library
- Embla Carousel React 8.6.0 - Carousel/slider component
- Lucide React 0.545.0 - Icon library
- React Icons 5.4.0 - Additional icon sets

**Notifications & UX:**
- Sonner 2.0.7 - Toast notifications
- next-themes 0.4.6 - Dark/light mode theme switching via CSS variables

**Utilities:**
- date-fns 3.6.0 - Date manipulation and formatting
- React Day Picker 9.11.1 - Date picker component
- React Resizable Panels 2.1.7 - Resizable panel layout
- Vaul 1.1.2 - Drawer/modal component
- CMDk 1.1.1 - Command palette component
- Input OTP 1.4.2 - OTP input component
- tw-animate-css 1.4.0 - Tailwind animation utilities
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.3.1 - Merge Tailwind CSS classes

**Backend Data Access:**
- Drizzle Kit 0.31.9 - Schema migrations and introspection CLI
- pg 8.20.0 - PostgreSQL client for Node.js
- Drizzle Zod 0.8.3 - Automatic Zod schema generation from Drizzle tables

**Backend Utilities:**
- Pino 9.x - Fast JSON logger for Node.js
- Pino HTTP 10.x - HTTP request logging middleware for Express
- Pino Pretty 13.x - Pretty-print Pino logs in development (transport)
- esbuild-plugin-pino 2.3.3 - Build-time Pino optimization for bundling
- bcryptjs 3.0.3 - Password hashing
- cookie-parser 1.4.7 - Cookie middleware for Express
- CORS 2.x - Cross-origin resource sharing middleware
- express-session 1.19.0 - Session management middleware
- express-rate-limit 8.3.2 - Rate limiting middleware
- csrf-csrf 4.0.3 - CSRF token generation/validation
- node-ical 0.26.0 - iCalendar (.ics) parsing for Google Calendar, Outlook, Apple Calendar feeds
- nodemailer 8.0.5 - SMTP email client (supports custom domains and Ethereal test accounts)
- sanitize-html 2.17.3 - HTML sanitization for security
- thread-stream 3.1.0 - Worker thread stream for Pino logging

**Build & Bundling:**
- esbuild 0.27.3 - Fast JavaScript bundler (ESM format for API server)
- @vitejs/plugin-react 5.0.4 - Vite React plugin with SWC transpilation support
- tsx 4.21.0 - TypeScript execution and module resolution (dev)

**Mobile:**
- @capacitor/cli 6.x - Capacitor CLI for iOS/Android builds
- @capacitor/core 6.x - Capacitor runtime core
- @capacitor/ios 6.x - iOS platform support
- @capacitor/android 6.x - Android platform support

**Development:**
- Prettier 3.8.1 - Code formatter (workspace-level)
- @replit/vite-plugin-cartographer 0.5.1 - Development visualization plugin
- @replit/vite-plugin-dev-banner 0.1.1 - Development banner display
- @replit/vite-plugin-runtime-error-modal 0.0.6 - Runtime error overlay in Replit

## Key Dependencies

**Critical (business logic):**
- `react` 19.1.0 - Application framework
- `express` 5 - HTTP server
- `drizzle-orm` 0.45.1 - Database abstraction
- `zod` 3.25.76 - Runtime validation (forms, API contracts, database schemas)
- `pino` 9.x - Observability and logging
- `nodemailer` 8.0.5 - Email delivery (campaigns, invitations, verification)
- `pg` 8.20.0 - PostgreSQL connectivity

**Core integrations:**
- `@tanstack/react-query` 5.90.21 - Data synchronization and caching
- `bcryptjs` 3.0.3 - Credential protection
- `node-ical` 0.26.0 - Calendar integration (Google, Outlook, Apple iCalendar feeds)

**AI Generation:**
- `@anthropic-ai/sdk` 0.90.0 - Claude API for email campaign generation

## Configuration

**Environment (Root):**
- `.env` file at root with required variables (see Integrations)
- Environment-specific configs:

**Frontend:**
- `artifacts/hypespace/vite.config.ts` - Vite configuration with React, Tailwind, path aliases (`@/`, `@assets/`), API proxy to backend

**Backend:**
- `artifacts/api-server/build.mjs` - esbuild ESM bundler configuration with Pino plugin, external modules list
- `artifacts/api-server/src/lib/logger.ts` - Centralized Pino logger (JSON in prod, pretty-printed in dev)

**Database:**
- `lib/db/drizzle.config.ts` - PostgreSQL dialect configuration for migrations
- `lib/db/src/index.ts` - Connection pool initialization from `DATABASE_URL` env var

**Workspace:**
- `pnpm-workspace.yaml` - Package manager configuration, workspace definitions, dependency catalog
- `tsconfig.base.json` - Shared TypeScript configuration (strict mode enabled, `isolatedModules: true` for esbuild safety)

**Code Formatting:**
- Prettier 3.8.1 configured at root (no `.prettierrc` specifics documented; uses defaults)
- No ESLint or biome configured (formatting-only approach via Prettier)

## Platform Requirements

**Development:**
- Node.js 18+ (TypeScript/tsx support)
- pnpm 9.x
- Docker Compose (for local PostgreSQL 16 via `docker-compose.yml`)
- SMTP credentials or Ethereal test account (email dev fallback)

**Production:**
- Node.js 18+ with 256MB+ memory
- PostgreSQL 16+ database (external or containerized)
- SMTP relay server or cloud email provider credentials
- Optional: Custom SMTP domain configured via sending_domains table

**Mobile (iOS/Android):**
- Xcode 14+ for iOS builds
- Android Studio / SDKs for Android builds
- Capacitor CLI 6+ for deployment

**Deployment Targets:**
- Replit (native support via `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS` env vars)
- Traditional VPS/containers (Node + PostgreSQL)
- Cloud platforms: AWS, Google Cloud, Azure (via standard Node deployment)

---

*Stack analysis: 2026-04-20*
