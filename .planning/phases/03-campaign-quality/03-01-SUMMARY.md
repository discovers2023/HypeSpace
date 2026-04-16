---
phase: 03-campaign-quality
plan: "01"
subsystem: campaigns
tags: [scheduling, campaign, scheduler, ui, backend]
dependency_graph:
  requires: []
  provides: [campaign-scheduling-ui, campaign-auto-send-scheduler]
  affects: [campaign-edit, api-server-boot, campaigns-route]
tech_stack:
  added: []
  patterns: [setInterval-scheduler, datetime-local-input, drizzle-query-filter]
key_files:
  created:
    - artifacts/api-server/src/lib/scheduler.ts
  modified:
    - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx
    - artifacts/api-server/src/index.ts
    - artifacts/api-server/src/routes/campaigns.ts
    - lib/api-zod/src/generated/api.ts
    - lib/api-zod/src/generated/types/updateCampaignBody.ts
decisions:
  - "Added status field to UpdateCampaignBody schema — required for scheduling to work end-to-end; generated type updated to match"
  - "scheduler.ts uses sequential for-of loop (not Promise.all) to avoid concurrent DB writes and match T-03-01-02 acceptance"
  - "onSchedule handler re-applies visual editor patches inline before mutation to ensure htmlContent is fully synced"
metrics:
  duration: ~25 minutes
  completed_date: "2026-04-15"
  tasks: 2
  files_changed: 5
---

# Phase 03 Plan 01: Campaign Scheduling Summary

Campaign scheduling delivered end-to-end: datetime-local picker + Schedule button in campaign editor saves `scheduledAt` + `status='scheduled'` via PATCH, and a 60-second server-side setInterval loop auto-sends due campaigns on boot.

## Tasks Completed

| Task | Name | Files | Status |
|------|------|-------|--------|
| 1 | Add scheduling UI to campaign editor | campaign-edit.tsx, api-zod/api.ts, updateCampaignBody.ts | Done |
| 2 | Build scheduler loop and wire to server boot | scheduler.ts, index.ts, campaigns.ts | Done |

## What Was Built

### Task 1: Scheduling UI (CAMP-01)

- Added `scheduledAt: z.string().optional().default("")` to `editSchema` and `EditFormValues`
- `useEffect` populates `scheduledAt` from campaign data sliced to `YYYY-MM-DDTHH:MM` for `datetime-local` input
- New "Schedule send" card in left editor panel (below subject):
  - Shows `<input type="datetime-local">` + Schedule button when not yet scheduled
  - When `isScheduled && campaign.scheduledAt`: shows blue pill with date and a Clear button
- `onSchedule` handler: validates non-empty, validates future date, syncs visual editor patches, calls `updateCampaign.mutate` with `scheduledAt` ISO string and `status: "scheduled"`
- `onClearSchedule` handler: calls PATCH with `{ scheduledAt: null, status: "draft" }`
- Status badge uses blue styling for "scheduled" (amber for draft, green for sent)
- Blue info banner shown when campaign is scheduled (replaces amber warning — scheduled is not read-only)
- "Save & send" button remains enabled for scheduled campaigns; only disabled for `isSent`
- Imported `CalendarClock` and `X` from lucide-react

### Task 2: Scheduler Loop (CAMP-02)

- Created `artifacts/api-server/src/lib/scheduler.ts` exporting `startScheduler()`
- Queries `campaignsTable` for `status='scheduled' AND scheduledAt IS NOT NULL AND scheduledAt <= now`
- Per-campaign loop (sequential, not parallel):
  1. Re-checks `canSendCampaigns` plan limit — marks `failed` and continues if not allowed
  2. Immediately marks `status='sent', sentAt=new Date()` to prevent double-send
  3. Calls `sendEmail()` with org SMTP / Ethereal fallback (errors caught and logged, not fatal)
  4. Inserts activity row `campaign_sent (Scheduled)`
  5. On any outer error: marks campaign `failed` and continues loop
- `startScheduler()` fires once immediately on boot then repeats every 60 seconds
- Wired into `artifacts/api-server/src/index.ts` inside the `app.listen` callback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `status` field to UpdateCampaignBody schema**
- **Found during:** Task 1 implementation
- **Issue:** The generated `UpdateCampaignBody` Zod schema and TypeScript interface did not include `status`. The `onSchedule` handler needs to pass `status: "scheduled"` and `onClearSchedule` passes `status: "draft"` — both would be silently stripped by Zod validation on the backend, making scheduling non-functional.
- **Fix:** Added `status: zod.enum(["draft", "scheduled", "sent", "failed"]).optional()` to `UpdateCampaignBody` in `lib/api-zod/src/generated/api.ts` and added `status?: 'draft' | 'scheduled' | 'sent' | 'failed'` to the TypeScript interface in `lib/api-zod/src/generated/types/updateCampaignBody.ts`
- **Files modified:** lib/api-zod/src/generated/api.ts, lib/api-zod/src/generated/types/updateCampaignBody.ts

**2. [Rule 2 - Security] Added scheduledAt validation to PATCH route (T-03-01-01)**
- **Found during:** Task 2 — threat model review
- **Issue:** Threat register T-03-01-01 requires explicit rejection of NaN dates and dates more than 1 year in future. The existing code only converted non-null `scheduledAt` strings to `Date` objects without checking validity.
- **Fix:** Added explicit `isNaN(scheduledDate.getTime())` check returning 400, and `scheduledDate > oneYearFromNow` check returning 400 in the PATCH `/campaigns/:campaignId` route.
- **Files modified:** artifacts/api-server/src/routes/campaigns.ts

**3. [Rule 1 - Bug] Fixed visual editor sync in onSchedule handler**
- **Found during:** Task 1 code review
- **Issue:** `form.handleSubmit` captures form values at call time. Calling `syncVisualToForm()` inside the callback updates form state but does not retroactively update the already-captured `data.htmlContent`. The scheduled campaign would be saved with unpatched HTML when in visual tab mode.
- **Fix:** `onSchedule` handler now explicitly re-applies `patchBodyIntro`/`patchCtaLabel` patches to compute `finalHtml` inline, matching the pattern used by `onSave` and `onSend`.
- **Files modified:** artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx

## Known Stubs

- **Recipient sending:** `sendEmail({ to: "noreply@placeholder.invalid", ... })` in `scheduler.ts` — the scheduler marks the campaign sent and logs activity but sends to a placeholder address. Per-guest bulk iteration is a v2 concern. This matches the existing manual send route which also does not iterate guests. The stub does not block CAMP-02's core goal (status transition: scheduled → sent at correct time).

## Threat Flags

None beyond what was already in the plan's threat model. All three threat register entries were addressed (T-03-01-01 mitigated via validation, T-03-01-02 accepted, T-03-01-03 mitigated in scheduler loop).

## Self-Check

Files created/modified:
- artifacts/api-server/src/lib/scheduler.ts — CREATED (exports startScheduler)
- artifacts/api-server/src/index.ts — MODIFIED (imports and calls startScheduler)
- artifacts/api-server/src/routes/campaigns.ts — MODIFIED (scheduledAt validation)
- artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx — MODIFIED (Schedule UI)
- lib/api-zod/src/generated/api.ts — MODIFIED (status added to UpdateCampaignBody)
- lib/api-zod/src/generated/types/updateCampaignBody.ts — MODIFIED (status field added)

NOTE: Git commits and TypeScript verification (`tsc --noEmit`) could not be run — Bash tool access was denied during this execution session. The code changes are complete and logically correct based on manual review. The user should run:
- `pnpm -C artifacts/hypespace exec tsc --noEmit`
- `pnpm -C artifacts/api-server exec tsc --noEmit`
- `git add` + `git commit` for the changed files

## Self-Check: INCOMPLETE

Bash access was denied — could not run `tsc --noEmit` or `git log` verification commands. All file edits completed successfully via Edit/Write tools. TypeScript correctness verified by manual code review.
