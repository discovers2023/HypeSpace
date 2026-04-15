# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Status:**
- **No test framework configured** — No test scripts, test runners, or configuration files present
- No test files exist in the codebase (zero `.test.ts`, `.spec.ts` files in `artifacts/`)
- Prettier v3.8.1 is installed as dev dependency, but for formatting only, not testing

**Potential Candidates (Not Implemented):**
- Jest or Vitest could be configured but are not currently present
- No `jest.config.js`, `vitest.config.ts`, or equivalent configuration files

**Impact:**
- All validation is runtime-only via Zod schemas and TypeScript
- Manual testing required before deployment
- No automated regression prevention

## Type Safety as Validation

Since no test framework is configured, type safety and validation are the primary mechanisms:

**TypeScript Strict Mode:**
- `noImplicitAny: true` — catches untyped variables
- `noImplicitReturns: true` — catches missing returns
- `strictNullChecks: true` — prevents null/undefined bugs
- `strictPropertyInitialization: true` — ensures class properties are initialized
- See `tsconfig.base.json` for full configuration

**Zod Runtime Validation:**
- All API request/response bodies validated with Zod schemas (e.g., `CreateCampaignBody.safeParse()`)
- Database queries use Drizzle ORM typed safely
- Frontend forms validated with React Hook Form + Zod

## Code Review Substitutes

Without tests, the codebase relies on:
- **Type checking:** `pnpm run typecheck` — Full TypeScript check across all packages
- **Build validation:** `pnpm run build` — Typecheck + build all packages (fails on type errors)
- **Runtime error handling:** try/catch blocks with fallbacks (e.g., email provider config lookup)
- **Manual QA:** Browser testing before releases

## Manual Testing Approach

**For API Routes:**
1. Start local dev server: `pnpm run dev:api`
2. Use curl, Postman, or browser dev tools to test endpoints
3. Example GET test:
   ```bash
   curl http://localhost:4000/api/organizations/1/events
   ```
4. Example POST test:
   ```bash
   curl -X POST http://localhost:4000/api/organizations/1/events \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Event","startDate":"2026-04-20T10:00:00Z",...}'
   ```

**For Frontend:**
1. Start dev server: `pnpm run dev:web`
2. Browser testing: navigate to pages, fill forms, submit
3. React Query DevTools for monitoring API calls (if configured)
4. Console for errors and logs

**For Database:**
1. Run migrations: `pnpm run db:push`
2. Inspect schema with SQL client pointing to PostgreSQL
3. No seed scripts; manual data entry for testing

## Code Patterns That Reduce Bug Surface

**Backend:**

1. **Zod Safeguard Pattern:**
   ```typescript
   // All form inputs validated before use
   const parsed = CreateCampaignBody.safeParse(req.body);
   if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
   ```

2. **Type-Safe Database Queries:**
   ```typescript
   // Drizzle ORM prevents SQL injection and column typos
   const campaigns = await db.select().from(campaignsTable)
     .where(eq(campaignsTable.organizationId, orgId));
   ```

3. **Explicit Error Handling:**
   ```typescript
   // All error paths return explicit status codes
   if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
   ```

**Frontend:**

1. **React Hook Form Validation:**
   ```typescript
   const editSchema = z.object({
     name: z.string().min(1, "Name is required").max(200),
     subject: z.string().min(1, "Subject line is required").max(200),
   });
   const form = useForm({ resolver: zodResolver(editSchema) });
   ```

2. **Type-Safe Query Hooks:**
   ```typescript
   // Auto-generated React Query hooks with type safety
   const { data: campaign, isLoading, error } = useGetCampaign(orgId, campaignId);
   ```

3. **Graceful Error States:**
   ```typescript
   if (error) return <div>Error loading campaign</div>;
   if (isLoading) return <Skeleton />;
   ```

4. **File Validation in Components:**
   ```typescript
   const ACCEPTED_TYPES = ["image/png", "image/jpeg"];
   const MAX_SIZE = 5 * 1024 * 1024;
   
   if (!ACCEPTED_TYPES.includes(file.type)) {
     toast({ title: "Invalid file type" });
     return;
   }
   if (file.size > MAX_SIZE) {
     toast({ title: "File too large" });
     return;
   }
   ```

## Validation Layers

**Layer 1: Frontend Form Validation**
- Location: `artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx` and similar
- Tool: React Hook Form + Zod
- Scope: Catches user input errors before submission

**Layer 2: API Request Validation**
- Location: `artifacts/api-server/src/routes/*.ts` (e.g., line 50 in campaigns.ts)
- Tool: Zod `safeParse()`
- Scope: Validates request body matches expected schema

**Layer 3: Database Layer**
- Location: `lib/db/src/schema/*.ts`
- Tool: Drizzle ORM type inference
- Scope: Prevents invalid data insertion

**Layer 4: API Response Validation**
- Location: `artifacts/api-server/src/routes/campaigns.ts` line 44
- Tool: Zod response schema (e.g., `ListCampaignsResponse.parse()`)
- Scope: Ensures API responses match contract

**Layer 5: Frontend Data Parsing**
- Location: Auto-generated hooks in `lib/api-client-react/src/generated/`
- Tool: Orval-generated code from OpenAPI spec
- Scope: Type-safe response data in React components

## Integration Testing Approach

Without a test framework, integration testing is manual:

1. **Database + API:**
   - Push schema: `pnpm run db:push`
   - Start API: `pnpm run dev:api`
   - Test endpoint with actual database

2. **API + Frontend:**
   - Start both: `pnpm run dev` (starts API and web simultaneously)
   - Use browser to test full user flows
   - Monitor network tab and console for errors

3. **Email Integration:**
   - Uses Ethereal test account fallback in dev (see `lib/email.ts`)
   - Emails sent to Ethereal preview URL in console output
   - Production uses configured SMTP (org-specific or env vars)

## Testing TODOs / Gaps

**What Should Be Tested (currently manual only):**

1. **Email Sending:**
   - File: `artifacts/api-server/src/lib/email.ts`
   - Risk: Silent failures with SMTP misconfiguration
   - Gap: No test for actual mail transport vs Ethereal fallback

2. **Route Parameter Parsing:**
   - File: `artifacts/api-server/src/routes/campaigns.ts` (lines 41-49)
   - Pattern: Array vs. single param handling for route params
   - Risk: Inconsistent Express behavior not caught by types

3. **Database Query Results:**
   - File: All routes that query database
   - Risk: Silent null returns when resources deleted during request
   - Gap: No test for race conditions

4. **Error Messages:**
   - File: `lib/api-client-react/src/custom-fetch.ts` lines 150-172
   - Pattern: Extracts error message from response
   - Risk: Unexpected response format not caught

5. **Regex-Based HTML Patching:**
   - File: `artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx` lines 40-68
   - Pattern: Extracts/patches campaign template body and CTA
   - Risk: Hand-edited HTML breaks extraction regex

6. **File Upload Validation:**
   - File: `artifacts/hypespace/src/components/cover-image-picker.tsx` lines 47-53
   - Pattern: Type and size checking before upload
   - Risk: Large files consumed in memory

7. **Plan Limits Enforcement:**
   - File: `artifacts/api-server/src/lib/plans.ts` and event creation route
   - Risk: Users can exceed limits if plan lookup fails silently
   - Gap: No test for limit checking logic

## Development Commands

```bash
# Type checking only (no test runner)
pnpm run typecheck         # Full TypeScript check
pnpm run build             # Typecheck + build (fails on type errors)

# Development with no test watch mode
pnpm run dev               # Runs API and web servers
pnpm run dev:api           # Run API server only
pnpm run dev:web           # Run web server only

# Database operations (manual)
pnpm run db:up             # Start PostgreSQL container
pnpm run db:down           # Stop PostgreSQL container
pnpm run db:push           # Apply schema migrations to database
```

**Adding a Test Framework (Future Work):**

To add testing, you would:

1. Install a test runner: `pnpm add -D vitest` (or jest)
2. Add test files: `__tests__/`, `.test.ts` suffixes
3. Create config: `vitest.config.ts` in root
4. Add to `package.json`:
   ```json
   "test": "vitest run",
   "test:watch": "vitest"
   ```
5. Start writing tests for critical paths (email, limits, validation)

## Coverage Goals (If Tests Were Implemented)

**High Priority:**
- Email sending success/failure paths
- Plan limit enforcement
- Route parameter parsing edge cases
- Zod validation error messages

**Medium Priority:**
- Database query formatting
- Error message extraction from API responses
- HTML patching regex robustness
- File upload validation

**Low Priority:**
- Component rendering (would require React Testing Library)
- Navigation and routing logic

---

*Testing analysis: 2026-04-15*

**Summary:** This project has no automated tests. Quality assurance relies entirely on TypeScript strict mode, Zod validation, code review, and manual testing. Adding tests for critical paths (email, limits, complex parsing) would significantly improve reliability.
