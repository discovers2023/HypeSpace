# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- Backend routes: `[domain].ts` (e.g., `campaigns.ts`, `events.ts`, `integrations.ts`)
- Utility/library files: descriptive lowercase names (e.g., `logger.ts`, `email.ts`, `plans.ts`)
- Frontend pages: kebab-case (e.g., `campaign-list.tsx`, `campaign-edit.tsx`)
- Frontend components: kebab-case (e.g., `cover-image-picker.tsx`, `timezone-picker.tsx`)
- React hooks: `use-[name].ts` (e.g., `use-toast.ts`)
- UI components: lowercase single-word or kebab-case (e.g., `button.tsx`, `dropdown-menu.tsx`)
- Database schemas: `[entity].ts` in `lib/db/src/schema/` (e.g., `events.ts`, `campaigns.ts`)

**Functions:**
- camelCase for all functions (e.g., `generateSlug`, `formatCampaign`, `sendEmail`)
- Async functions are named identically to sync equivalents (no `async` suffix)
- Helper/utility functions prefixed with verb: `get`, `set`, `format`, `parse`, `send`, `validate`, `extract`, `patch`
- Route handlers follow pattern `router.METHOD("/path", async (req, res): Promise<void> => { ... })`

**Variables:**
- camelCase for all variables and constants
- Constants that are truly constant use UPPER_SNAKE_CASE (e.g., `TOAST_LIMIT`, `MAX_SIZE`, `UNLIMITED`)
- Configuration objects use camelCase (e.g., `STATUS_CONFIG`, `TYPE_ICON`, `STOCK_IMAGES`)
- State variables in React use camelCase (e.g., `searchTerm`, `statusFilter`, `isOpen`)
- Boolean variables prefixed with `is`, `has`, or `can` (e.g., `isLoading`, `hasNoBody`, `canSendCampaigns`)

**Types:**
- Zod schemas use PascalCase ending in `Schema` (e.g., `editSchema`, `InsertEvent`, `CreateCampaignBody`)
- Interface names use PascalCase (e.g., `PlanLimits`, `CoverImagePickerProps`, `CustomFetchOptions`)
- Database inferred types: `typeof table.$inferSelect` for rows, `typeof table.$inferInsert` for insert payloads
- React props interface: `[ComponentName]Props` (e.g., `CoverImagePickerProps`)

## Code Style

**Formatting:**
- Prettier v3.8.1 installed; no `.prettierrc` config file (uses defaults)
- Line length: implicit ~80-120 chars (follows Prettier defaults)
- No ESLint or biome configured; relies on TypeScript strict mode
- Imports are auto-formatted and sorted (trailing commas on multi-line)

**Linting:**
- TypeScript strict mode enabled in `tsconfig.base.json`:
  - `noImplicitAny: true`
  - `noImplicitReturns: true`
  - `strictNullChecks: true`
  - `strictBindCallApply: true`
  - `strictPropertyInitialization: true`
  - `useUnknownInCatchVariables: true`
  - `alwaysStrict: true`
  - `noFallthroughCasesInSwitch: true`

**Key TypeScript Settings:**
- `isolatedModules: true` — allows esbuild to safely transpile
- `noUnusedLocals: false` — unused variables not checked (commonly left in code)
- `strictFunctionTypes: false` — allows flexibility with function signatures
- `skipLibCheck: true` — skips type checking of node_modules

## Import Organization

**Order (within files):**
1. External libraries (e.g., `import express from "express"`, `import { useState } from "react"`)
2. Internal workspace packages (e.g., `import { db, campaignsTable } from "@workspace/db"`)
3. Local relative imports (e.g., `import { logger } from "../lib/logger"`, `import { cn } from "@/lib/utils"`)
4. Type-only imports separated logically (e.g., `import type { IRouter }` on same line as other express imports)

**Path Aliases:**
- Frontend: `@/` → `artifacts/hypespace/src/`
- Frontend assets: `@assets/` → `attached_assets/`
- Backend: No aliases; uses relative paths or workspace package names

**Barrel Files:**
- Used selectively in UI components (`components/ui/index.ts` exports all UI primitives)
- Database schema: `lib/db/src/schema/index.ts` re-exports all tables and types
- API client: `lib/api-client-react/src/index.ts` re-exports hooks and utilities

## Error Handling

**Patterns:**

**Backend Routes:**
- Validation errors: `res.status(400).json({ error: parsed.error.message })` after `Zod.safeParse()`
- Not found: `if (!resource) { res.status(404).json({ error: "Resource not found" }); return; }`
- Success with early return on error: `if (!parsed.success) { res.status(400).json(...); return; }`
- All route handlers use `Promise<void>` return type and inline error responses

**Libraries (email.ts):**
- Try/catch with silent fallback: `try { /* logic */ } catch { return null; }` for optional config retrieval
- Uses implicit null return for missing resources
- No exception throwing for expected error cases

**React Components:**
- Query hook errors accessed via `.error` property on query result
- Toast notifications for user-facing errors: `toast({ title: "Error", variant: "destructive" })`
- Validation errors shown inline on form fields via `<FormMessage>`
- File upload errors: validate type/size, show toast on failure
- Early return pattern: `if (error) return <ErrorUI />`

**Frontend API Errors:**
- Custom `ApiError` class in `lib/api-client-react/src/custom-fetch.ts` with `.status`, `.data`, `.message`
- Automatic error message building from response data (checks `title`, `detail`, `message`, `error_description`)
- Network/parse errors thrown as `ResponseParseError` with `.cause`
- No global error boundaries observed (errors handled per-route or per-hook)

## Logging

**Framework:** `pino` with `pino-http` middleware for Express

**Patterns:**
- Centralized logger config in `artifacts/api-server/src/lib/logger.ts`
- Development: Pretty-printed with colors via `pino-pretty`
- Production: JSON format
- Log level configurable via `LOG_LEVEL` env var (default: "info")
- HTTP request/response logging with redaction of sensitive headers: `authorization`, `cookie`, `set-cookie`

**Console logging:**
- Direct `console.log()` used for informational messages (e.g., email sent notifications)
- Format: `📧 Email sent to [email] (messageId: [id])`
- No standardized format; varies by context

## Comments

**When to Comment:**
- JSDoc comments on exported functions with complex signatures or unclear purpose
- Inline comments for regex patterns or non-obvious logic (e.g., slug generation, extraction logic in `campaign-edit.tsx`)
- Section headers for code organization (e.g., `// ─── Schema ───`, `// ─── Component ────`)
- Comments explaining "why" not "what" (implementation details are self-explanatory from code)

**JSDoc/TSDoc:**
- Used sparsely; mostly for utility functions with unclear intent
- Example: Email helper functions have parameter descriptions in object types
- No automated doc generation tool in place

**Example (campaign-edit.tsx line 37-38):**
```typescript
// ─── Regex-based extraction / patching for the AI template ───────────────────
// These patterns are safe to use on both AI-generated AND hand-edited HTML.
```

## Function Design

**Size:** 
- Utility functions: typically 10-50 lines
- Route handlers: 20-100 lines (includes DB query, validation, response formatting)
- React components: 50-300 lines (may include hooks, state, conditional rendering)
- No explicit size limits; smaller is preferred for testability (though no tests exist)

**Parameters:**
- Single object parameter for functions with 2+ arguments (e.g., email `opts` object in `sendEmail()`)
- Type the parameter explicitly with interface/type (e.g., `opts: { toEmail: string; ... }`)
- Database query results destructured in assignments (e.g., `const [campaign] = await db.select(...)`)

**Return Values:**
- Async functions return `Promise<T>` explicitly typed
- Route handlers use `Promise<void>` (responses sent via `res.json()`, `res.status()`)
- Nullable returns use explicit `T | null` (e.g., `getOrgSmtpConfig(): Promise<SmtpConfig | null>`)
- Database queries return arrays or single records via `.returning()`

## Module Design

**Exports:**
- Backend: Named exports for functions, one default export for router (e.g., `export default app`)
- Frontend: Named exports for components and hooks
- Database: Named exports for tables, types, and Zod schemas; single default export for `db` client
- API client: Named exports for hooks and utilities

**Route Modules:**
- Each domain (campaigns, events, etc.) exported as single `router: IRouter`
- Routes mounted in `routes/index.ts`: `app.use("/organizations", organizationsRouter)`, etc.
- All routes follow REST conventions: GET/POST/PUT/DELETE

**React Components:**
- Export default function (the component)
- No re-exports of sub-components unless reused
- Props interface as separate named export (optional, used if props are complex)

**Database Layer:**
- Schema files define table, insert schema, and type exports
- Central `lib/db/src/index.ts` re-exports `db` client, all tables, and utilities
- Drizzle ORM patterns: use `.$dynamic()` for conditional queries, `.$inferSelect` for row types

## Code Patterns

**Conditional Route Handlers:**
```typescript
// Pattern: Validate request body, return early on error
const parsed = CreateEventBody.safeParse(req.body);
if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
```

**Array Parameter Normalization:**
```typescript
// Pattern: Express parses array route params inconsistently
const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
const orgId = parseInt(raw, 10);
```

**Database Formatting:**
```typescript
// Pattern: Format database rows before sending to client
function formatCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    id: c.id,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    // ... other fields
  };
}
```

**Fallback Chain:**
```typescript
// Pattern: Config lookup with fallback (email.ts)
if (orgId) { const orgSmtp = await getOrgSmtpConfig(orgId); if (orgSmtp) return orgSmtp; }
// Fall back to env vars
const host = process.env.SMTP_HOST;
// Fall back to test account
```

**React State Management:**
```typescript
// Pattern: React Query for data fetching + React Hook Form for forms
const { data: campaigns, isLoading } = useListCampaigns(orgId);
const updateCampaign = useUpdateCampaign();
const { toast } = useToast();
const queryClient = useQueryClient();

// Mutation with toast + cache invalidation
updateCampaign.mutate(data, {
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    toast({ title: "Updated" });
  },
});
```

**Form Validation:**
```typescript
// Pattern: React Hook Form + Zod
const form = useForm({ resolver: zodResolver(editSchema) });
form.handleSubmit(async (values) => {
  // values are type-safe
});
```

---

*Convention analysis: 2026-04-15*
