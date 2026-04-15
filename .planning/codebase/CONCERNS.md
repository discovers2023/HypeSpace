# Codebase Concerns

**Analysis Date:** 2026-04-15

## Critical Issues

### Hardcoded Organization ID Throughout Frontend

**Problem:** Every frontend page hardcodes `ORG_ID = 1`, bypassing the authentication context entirely. This means:
- All users see data from organization 1 regardless of login
- The `useAuth()` hook's `activeOrgId` is ignored completely
- Multi-tenant isolation is broken in production

**Files:** 
- `artifacts/hypespace/src/pages/calendar.tsx:27`
- `artifacts/hypespace/src/pages/campaigns/campaign-list.tsx`
- `artifacts/hypespace/src/pages/events/event-setup.tsx`
- `artifacts/hypespace/src/pages/events/event-edit.tsx`
- `artifacts/hypespace/src/pages/events/event-list.tsx`
- `artifacts/hypespace/src/pages/events/event-detail.tsx`
- `artifacts/hypespace/src/components/campaigns/campaign-creation-modal.tsx`
- `artifacts/hypespace/src/components/events/event-creation-modal.tsx`

**Impact:** Data leakage, complete loss of multi-tenant security model. Users can see and modify other organizations' data.

**Fix Approach:** Replace all `const ORG_ID = 1` with `const { activeOrgId } = useAuth()` and use that value throughout. This requires:
1. Wrap all pages with `<AuthProvider>`
2. Update all API calls to use `activeOrgId` instead of hardcoded `1`
3. Add proper error handling for unauthorized access (401/403)
4. Test that users can only access their own org data

---

### Incomplete Authentication System

**Problem:** Backend auth is partially implemented but not integrated with frontend:
- Backend hardcodes `userId = 1` in `auth/me` endpoint regardless of session
- Frontend defaults `activeOrgId = 1` with comment "before proper login flow is ready"
- No actual session/JWT validation on protected routes
- CORS allows all origins (`cors()` with no config)

**Files:**
- `artifacts/api-server/src/routes/auth.ts:15` (hardcoded userId)
- `artifacts/hypespace/src/components/auth-provider.tsx:34-35` (hardcoded activeOrgId)
- `artifacts/api-server/src/app.ts:28` (open CORS)

**Impact:** Any user can impersonate any organization by changing the URL parameter. Production is completely unguarded.

**Fix Approach:**
1. Implement session/JWT middleware on backend (check existing session in Express)
2. Return actual userId from auth context to frontend
3. Restrict CORS to known origins via `process.env.ALLOWED_ORIGINS`
4. Add role-based access control (RBAC) checks on all API routes
5. Test with multiple users/organizations

---

### Database Cascade Delete Issues

**Problem:** Foreign key relationships lack cascade delete rules. Event deletion includes manual cascades but is error-prone:

```typescript
// artifacts/api-server/src/routes/events.ts - manual cascades
await db.delete(guestsTable).where(eq(guestsTable.eventId, eventId));
await db.delete(remindersTable).where(eq(remindersTable.eventId, eventId));
await db.delete(campaignsTable).where(eq(campaignsTable.eventId, eventId));
await db.delete(socialPostsTable).where(eq(socialPostsTable.eventId, eventId));
```

**Files:**
- `lib/db/src/schema/events.ts` - no onDelete CASCADE
- `lib/db/src/schema/guests.ts:9` - foreign key without cascade
- `lib/db/src/schema/campaigns.ts:10` - foreign key without cascade
- `lib/db/src/schema/reminders.ts` - similar issue
- `artifacts/api-server/src/routes/events.ts` - manual cleanup prone to omission

**Impact:** 
- If a new related table is added and developer forgets to add cascade delete, orphaned records accumulate
- Manual approach is fragile; deleting one-time breaks if any cascade is missed
- Harder to reason about data consistency

**Fix Approach:**
1. Add `onDelete: "cascade"` to all child foreign keys in schema files:
   ```typescript
   eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" })
   ```
2. Remove manual cascade delete code from routes (rely on DB constraints)
3. Test that deleting an event cascades to all children in one transaction

---

## Data Integrity

### N+1 Query in Event Formatting

**Problem:** `formatEvent()` called in loop without batch loading causes N+1 queries:

```typescript
// artifacts/api-server/src/routes/events.ts:37-39
const confirmed = await db.select().from(guestsTable)
  .where(and(eq(guestsTable.eventId, event.id), eq(guestsTable.status, "confirmed")));
```

Called once per event in list. If you have 100 events, this runs 100+ extra queries.

**Files:** `artifacts/api-server/src/routes/events.ts:29-63`

**Impact:** Slow event list page, poor database performance at scale

**Fix Approach:**
1. In `GET /organizations/:orgId/events`, batch load all guest counts with a single query:
   ```typescript
   const guestCounts = await db.select({
     eventId: guestsTable.eventId,
     totalCount: count(),
     confirmedCount: countDistinct(guestsTable.id).where(eq(guestsTable.status, "confirmed"))
   }).from(guestsTable).groupBy(guestsTable.eventId)
   ```
2. Build a Map for O(1) lookup
3. Use that map in `formatEvent()` instead of querying per-event

---

### Background Promise Without Error Handling

**Problem:** CRM sync fires async without awaiting or handling errors:

```typescript
// artifacts/api-server/src/routes/guests.ts:143-146
Promise.all([
  syncRsvpToGHL(orgId, guestContact, parsed.data.status),
  syncRsvpToCustomCRM(orgId, guestContact, parsed.data.status, eventTitle),
]).catch(() => {});  // Silently swallows all errors
```

**Files:** `artifacts/api-server/src/routes/guests.ts:143-146`

**Impact:** 
- CRM syncs fail silently; user never knows
- Guest's RSVP updates in HypeSpace but not in their CRM
- No logging of integration failures for debugging

**Fix Approach:**
1. Add proper error logging:
   ```typescript
   }).catch((err) => {
     req.log.error({ err, orgId }, "Failed to sync RSVP to CRM");
   });
   ```
2. Consider adding a `sync_failed` activity log entry
3. Implement retry mechanism with exponential backoff for critical syncs

---

## Type Safety

### Widespread Use of `any` Type

**Problem:** Frontend components use `as any` casts to suppress TypeScript errors instead of fixing types:

**Files:**
- `artifacts/hypespace/src/pages/team/team-list.tsx:84, 87, 106` - destructuring responses
- `artifacts/hypespace/src/pages/calendar.tsx:138, 150, 158, 439, 485` - event mapping
- `artifacts/hypespace/src/pages/events/event-detail.tsx` - guest handling
- `artifacts/hypespace/src/pages/events/event-setup.tsx:187, 369-373` - campaign type coercion

**Impact:** Lose type safety where it matters most (data transformation), no compile-time checks for API response shape changes

**Fix Approach:**
1. Use Zod types generated from API schemas instead of casting
2. Create proper TypeScript interfaces for transformed data
3. Enable `noImplicitAny: true` in `tsconfig.json`
4. Run `tsc --noEmit` in CI/CD to catch these

---

### Untyped Error Handling

**Problem:** Error handling uses loose `err: any` patterns:

```typescript
// artifacts/hypespace/src/pages/accept-invite.tsx:85
catch (err: any) { }

// artifacts/api-server/src/routes/email-provider.ts:205
catch (err: any) { }

// artifacts/api-server/src/routes/integrations.ts:171, 256, 562
catch (err: any) { }
```

**Files:** Multiple routes, components

**Impact:** Can't reliably check error type or access properties; brittle error messages

**Fix Approach:**
1. Always type errors properly: `catch (err: unknown)`
2. Implement type guards:
   ```typescript
   if (err instanceof Error) {
     req.log.error(err.message);
   } else {
     req.log.error("Unknown error", err);
   }
   ```

---

## Security

### Metadata Stores Secrets Without Encryption

**Problem:** Integration credentials (API keys, passwords) stored in plaintext in `integrations.metadata`:

```typescript
// artifacts/api-server/src/routes/email-provider.ts:41-51
res.json({
  passSet: !!m.pass,  // field exists but still stored plaintext
})
```

**Files:** 
- `artifacts/api-server/src/routes/email-provider.ts:93-94`
- Settings page stores: `accessToken`, `password`, API keys directly

**Impact:** Database breach exposes all third-party API credentials, allowing attacker to impersonate users to CRMs/email providers

**Fix Approach:**
1. Encrypt metadata before storing: use `bcryptjs` or AWS KMS
2. Add decryption middleware that only decrypts when needed
3. Never return decrypted secrets in API responses (only show "***" or "Set" status)
4. Audit when credentials are accessed (logging)

---

### Open CORS Configuration

**Problem:** CORS configured with no restrictions:

```typescript
// artifacts/api-server/src/app.ts:28
app.use(cors());  // Allow all origins
```

**Files:** `artifacts/api-server/src/app.ts:28`

**Impact:** API is accessible from any website (cross-site request forgery, data exfiltration)

**Fix Approach:**
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
}));
```

---

### Email Validation Too Loose

**Problem:** Email regex is simplistic and allows invalid addresses:

```typescript
// artifacts/api-server/src/routes/auth.ts:9
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
```

This passes: `a@b.c`, `test@@example.com`, etc.

**Files:** `artifacts/api-server/src/routes/auth.ts:9-11`

**Impact:** Registration accepts invalid emails; later failures in email sending

**Fix Approach:** Use RFC 5322 compliant validator:
```typescript
const emailSchema = z.string().email("Invalid email");
```

---

## Missing Error Handling

### Unvalidated parseInt Results

**Problem:** `parseInt()` calls don't validate the result is a valid number:

```typescript
// artifacts/api-server/src/routes/email-provider.ts:20
const port = Number(m.port ?? 587);  // No isNaN check
```

If metadata corruption occurs or a non-numeric string is sent, SMTP connections silently fail.

**Files:** Multiple route files with similar patterns

**Impact:** Silent failures; logs don't indicate why SMTP is broken

**Fix Approach:**
```typescript
const port = Number(m.port ?? 587);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid SMTP port: ${m.port}`);
}
```

---

### Missing Batch Operation Validation

**Problem:** Bulk email endpoint has no upper limit check before opening file handles:

```typescript
// artifacts/api-server/src/routes/events.ts:329-332
if (guests.length > 500) {
  res.status(400).json({ error: "Too many recipients..." });
  return;
}

for (const guest of guests) {
  await sendEmail(...);  // Sequential, no concurrency control
}
```

**Files:** `artifacts/api-server/src/routes/events.ts:348-366`

**Impact:** 500 sequential email sends = very slow; no timeout protection; could block for minutes

**Fix Approach:**
1. Add concurrency limit: `p-limit` or similar
2. Add timeout per email: `Promise.race([sendEmail(), timeout(30s)])`
3. Implement batching: send 50 at a time, pause 1s between batches
4. Stream results to client instead of waiting for all

---

## Testing

### Zero Test Coverage

**Problem:** No test files exist in the codebase.

```bash
find artifacts lib scripts -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null
# Returns nothing
```

**Files:** N/A

**Impact:** 
- No regression detection on critical paths (auth, CRM sync, email sending)
- Risky refactoring (e.g., fixing hardcoded IDs)
- No automated CI checks

**Fix Approach:**
1. Set up testing framework: `vitest` or `jest`
2. Start with integration tests for critical flows:
   - Event creation → guest invitation → RSVP → CRM sync
   - Campaign send (without actually sending emails)
   - User org isolation
3. Add unit tests for:
   - Plan limit validation
   - Email template personalization
   - CRM field mapping

---

## Fragile Areas

### Calendar Integration Tightly Coupled to Metadata Shape

**Problem:** Calendar event fetching assumes specific metadata structure without validation:

```typescript
// artifacts/api-server/src/routes/integrations.ts:551
const calendarUrl = meta.calendarUrl;
if (!calendarUrl) return;  // Silent skip if missing
```

If metadata structure changes or is corrupted, calendar silently fails with no error in UI.

**Files:** `artifacts/api-server/src/routes/integrations.ts:523-574`

**Impact:** User integrations break silently; no feedback they need to reconnect

**Fix Approach:**
1. Define schemas for each integration's metadata:
   ```typescript
   const googleCalendarMetadataSchema = z.object({
     calendarUrl: z.string().url(),
     refreshToken: z.string(),
   });
   ```
2. Validate on read and write
3. Return errors to client instead of silently skipping

---

### Event Launch Flow Has Multiple Failure Points

**Problem:** `POST /organizations/:orgId/events/:eventId/launch` does 6+ sequential operations with no transaction:

```typescript
// artifacts/api-server/src/routes/events.ts:180-278
1. Fetch event (can fail)
2. Fetch guests (can fail)
3. Fetch campaign (can fail)
4. Send emails in loop (partial failure possible)
5. Update campaign.status (can fail)
6. Create social post (can fail)
7. Update event.status (can fail)
```

If step 4 (email) partially succeeds then step 5 fails, event is marked launched but campaign never marked sent.

**Files:** `artifacts/api-server/src/routes/events.ts:180-278`

**Impact:** Inconsistent state; launched events with unsent campaigns; orphaned email records

**Fix Approach:**
1. Use database transaction wrapper around entire launch flow
2. Move email sending to background job queue (Bull, etc.) AFTER transaction commits
3. Implement idempotency key to prevent double-launches
4. Add rollback logic for failure scenarios

---

### Public RSVP Page Returns Event Without Validation

**Problem:** Public event endpoint returns full event data without checking it exists:

```typescript
// artifacts/api-server/src/routes/events.ts
router.get("/public/events/:slug", async (req, res) => {
  // No status check - returns draft events publicly
  // No organization privacy check
});
```

**Files:** `artifacts/api-server/src/routes/events.ts` (public endpoint)

**Impact:** 
- Draft events exposed publicly before launch
- No rate limiting on public endpoints (enumeration attack)

**Fix Approach:**
1. Only return events with `status: "published"`
2. Add rate limiting to public endpoints (50 req/min per IP)
3. Add `published_at` check (don't return future events)

---

## Performance Bottlenecks

### Email Sending Is Sequential and Unquoted

**Problem:** Bulk email sends happen synchronously in a loop without retry, timeout, or batching:

```typescript
// artifacts/api-server/src/routes/events.ts:348-370
for (const guest of guests) {
  // Sequential send - blocks thread
  // No timeout
  // If one fails, no retry
}
```

**Files:** `artifacts/api-server/src/routes/events.ts:348-370`

**Impact:** 
- 500 emails = 5+ minutes (if 600ms per send)
- Request timeout (>30s kills the connection)
- User gets no feedback on progress
- No visibility into which emails sent/failed

**Fix Approach:**
1. Move to background job (Bull/BullMQ with Redis)
2. Implement concurrent sending (10-20 at a time with rate limiting per SMTP provider)
3. Return a `jobId` immediately, let UI poll for progress
4. Store send attempts in DB for retry logic

---

### Calendar Event Parsing Has No Pagination

**Problem:** iCal parser loads all events for a month without batching:

```typescript
// artifacts/api-server/src/routes/integrations.ts:500-520
return filtered
  .map((c: any): NormalizedGhlContact => { ... })
  .filter((c) => c.email);
```

If calendar has 10k events in a month, all loaded into memory.

**Files:** `artifacts/api-server/src/routes/integrations.ts:500-520`

**Impact:** Memory exhaustion on large calendars, slow rendering of calendar view

**Fix Approach:**
1. Implement pagination: fetch events in 100-event chunks
2. Cache recent month's events with TTL (30 min)
3. Implement client-side filtering instead of server-side

---

## Scaling Limits

### No Database Query Limits

**Problem:** List endpoints have no pagination:

```typescript
// artifacts/api-server/src/routes/events.ts:68-71
const events = await query;
const result = await Promise.all(events.map(formatEvent));  // N+1 AND no limit
```

If org has 10k events, all loaded into memory and formatted.

**Files:** All list endpoints in routes/

**Impact:** 
- OOM on large organizations
- Slow API responses
- Bad UX (loading spinner forever)

**Fix Approach:**
1. Add pagination to all list endpoints:
   ```typescript
   const limit = Math.min(parseInt(req.query.limit) || 20, 100);
   const offset = parseInt(req.query.offset) || 0;
   const events = await query.limit(limit).offset(offset);
   ```
2. Return total count for client pagination UI
3. Add sorting support (`?sort=createdAt:desc`)

---

### No Rate Limiting on API

**Problem:** No rate limiting on any endpoint. Auth endpoints are brute-force-able:

**Files:** `artifacts/api-server/src/app.ts`

**Impact:**
- Password brute force: test 1M passwords on registration/login
- DoS: send 10k requests/sec to any endpoint
- Email brute force: enumerate valid emails

**Fix Approach:**
1. Add `express-rate-limit` middleware:
   ```typescript
   const loginLimit = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5,
     skip: (req) => req.user?.isAdmin,
   });
   router.post("/auth/login", loginLimit, ...);
   ```
2. Separate limits for auth (strict), public endpoints (moderate), API (permissive)

---

## Technical Debt

### TODO Comment Indicates Incomplete Feature

**Problem:** Preview path excluded from Replit artifact but marked TODO:

```toml
# artifacts/api-server/.replit-artifact/artifact.toml:2
previewPath = "/api" # TODO - should be excluded from preview in the first place
```

**Files:** `artifacts/api-server/.replit-artifact/artifact.toml:2`

**Impact:** Unclear if this is a blocking issue or cosmetic

**Fix Approach:** Either implement the fix or remove the TODO

---

### Hardcoded Placeholder in Settings

**Problem:** Settings page shows placeholder hint for sensitive field:

```typescript
// artifacts/hypespace/src/pages/settings.tsx:218
{ key: "publicKey", label: "Site ID (Public Key)", type: "text", placeholder: "XXXXXX", required: true }
```

This is fine as a placeholder but suggests the actual field definitions might be incomplete.

**Files:** `artifacts/hypespace/src/pages/settings.tsx:218`

**Impact:** Low - just unclear API integration completeness

---

## Known Issues

### Event Slug Generation Race Condition

**Problem:** Slug generation uses random suffix but doesn't handle collision:

```typescript
// artifacts/api-server/src/routes/events.ts:19-26
function generateSlug(title: string): string {
  const base = title.toLowerCase()...
  const suffix = Math.random().toString(36).slice(2, 8);  // 6 chars = 36^6 = 2.2B combinations
  return `${base}-${suffix}`;
}
```

While collision is statistically unlikely (2.2B possibilities), if two events are created simultaneously with same title, could conflict.

**Files:** `artifacts/api-server/src/routes/events.ts:19-26`

**Impact:** Very low - would require same title + millisecond timing

**Fix Approach:** Use database unique constraint to detect collision and retry:
```typescript
for (let i = 0; i < 10; i++) {
  try {
    return (await db.insert(eventsTable).values({ slug, ... })).id;
  } catch (e) {
    if (e.code === "23505") slug = generateSlug(title);  // Unique violation, retry
    else throw e;
  }
}
```

---

### Auth Context Initialization Race

**Problem:** Auth query fetches user data but components may render before completion:

```typescript
// artifacts/hypespace/src/components/auth-provider.tsx:42-55
const { data: authData, isLoading } = useQuery({
  queryKey: ["auth_status"],
  queryFn: async () => { fetch("/api/user") },
  retry: false,
});
```

If component uses `useAuth()` before query completes, gets stale default org ID of 1.

**Files:** `artifacts/hypespace/src/components/auth-provider.tsx`

**Impact:** Race condition where user briefly sees org 1 data before their actual org loads

**Fix Approach:**
1. Wrap all page routes with a suspense boundary
2. Return loading skeleton until `isLoading` is false
3. Or use React Router's `defer()` to preload auth before rendering

---

## Dependency Risks

### No Vulnerable Dependency Scanning

**Problem:** No `npm audit` or `snyk` in CI/CD. Large dependency tree (pnpm monorepo) likely contains vulnerable packages.

**Files:** N/A (CI/CD not configured)

**Impact:** Vulnerable dependencies in production (e.g., old lodash, moment.js, etc.)

**Fix Approach:**
1. Add `npm audit` / `pnpm audit` to CI
2. Set up Dependabot for automated PRs
3. Review new dependencies in `pnpm-lock.yaml` (258KB = large surface area)

---

## Missing Features

### No Webhook Support for Event Lifecycle

**Problem:** Events are published but external systems have no way to know. Requires polling.

**Files:** N/A (feature not implemented)

**Impact:** 
- CRM integrations can't detect event status changes in real-time
- Polling adds latency and load

**Fix Approach:**
1. Add `webhooks` table with registered endpoints
2. Trigger webhooks on `event:published`, `event:cancelled`, `rsvp:received`
3. Implement retry logic with exponential backoff
4. Add webhook verification (HMAC signature)

---

### No Audit Logging

**Problem:** Activity log exists but only tracks major actions, not details like:
- Who changed what field
- When credentials were accessed
- Which guests were imported from where

**Files:** `lib/db/src/schema/activity.ts` exists but is minimal

**Impact:** 
- Can't debug data inconsistencies
- Security audits incomplete
- User support can't trace user actions

**Fix Approach:**
1. Expand activity logging to include field-level changes
2. Log all credential access (reads, not writes)
3. Implement retention policy (30-90 days)
4. Add query API for filtering audit logs

---

## Summary of Blockers for Production

**MUST FIX BEFORE LAUNCH:**

1. **Remove hardcoded ORG_ID** - Multi-tenant security is completely broken (Priority: CRITICAL)
2. **Implement real authentication** - Backend hardcodes userId=1, no session validation (Priority: CRITICAL)
3. **Add cascade delete to schema** - Manual cascades are fragile (Priority: HIGH)
4. **Fix CORS** - Allow all origins exposes API (Priority: HIGH)
5. **Encrypt integration credentials** - Database breach exposes API keys (Priority: HIGH)
6. **Add pagination** - Unguarded memory exhaustion risk (Priority: HIGH)
7. **Rate limit auth endpoints** - Brute force exposure (Priority: MEDIUM)
8. **Move email sending to background job** - Blocks requests, timeouts (Priority: MEDIUM)

**Should fix before scaling:**

9. Fix N+1 query in event formatting
10. Add transaction wrapper to event launch flow
11. Add comprehensive test coverage
12. Implement webhook support
13. Add rate limiting to all endpoints
14. Improve error handling throughout

---

*Concerns audit: 2026-04-15*
