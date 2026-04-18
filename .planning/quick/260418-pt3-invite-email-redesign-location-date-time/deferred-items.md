# Deferred Items — 260418-pt3

These TypeScript errors exist on the base commit (`07ba58d`) before this plan
ran and are NOT caused by the two edits in this plan. Logged here per the
SCOPE BOUNDARY rule (only auto-fix issues directly caused by current task).

## Pre-existing typecheck errors (unrelated to public-event.tsx / settings.tsx auth-guard work)

- `src/components/events/event-creation-modal.tsx:683` — `onSuccess` prop not on EditEventModal
- `src/pages/campaigns/campaign-ai.tsx` — Organization missing `primaryColor`/`accentColor`/`emailFooterText`/`fromEmail`; `CreateCampaignBody` mismatch
- `src/pages/campaigns/campaign-edit.tsx` — `useQueryOptions` missing `queryKey`; `status` not on `UpdateCampaignBody`
- `src/pages/dashboard.tsx` — `DashboardStats.perEventRsvp` and `guestsByStatus.maybe` missing
- `src/pages/events/event-detail.tsx` — `queryKey` missing; `recurrence` field missing on Event; reminder body shape mismatch
- `src/pages/settings.tsx:1811-2121` — Organization-type missing branding/email fields; `UpdateOrganizationBody` mismatch; Record cast issues

These are pre-existing schema-drift issues from the api-spec / generated client
not yet keeping up with `lib/db/src/schema/organizations.ts` branding +
AI columns. They should be picked up by a future schema-regen plan, not by
this UI/auth-guard plan.

## Out of scope confirmation

- The two edits in this plan (Task 1: public-event.tsx info card, Task 2:
  settings.tsx auth guard + save-button disable) introduce zero new TS errors.
  Verified by running `tsc --noEmit` and grepping for the touched files.
