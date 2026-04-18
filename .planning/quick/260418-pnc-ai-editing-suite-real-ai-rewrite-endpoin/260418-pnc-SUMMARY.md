---
phase: quick-260418-pnc
plan: 01
subsystem: ai-editing
tags: [ai, campaigns, events, openapi, codegen]
requires:
  - existing org-level AI provider config (organizationsTable.aiProvider/aiApiKey/aiModel/aiBaseUrl)
  - existing isAiAvailable + AiGenerationError patterns in ai-campaign.ts
provides:
  - POST /api/organizations/:orgId/campaigns/ai-rewrite (AI_REWRITE_FAILED on 502)
  - POST /api/organizations/:orgId/campaigns/ai-subject-variants (AI_SUBJECT_VARIANTS_FAILED on 502)
  - POST /api/organizations/:orgId/events/ai-describe (AI_DESCRIBE_FAILED on 502)
  - useAiRewriteCampaign / useAiSubjectVariantsCampaign / useAiDescribeEvent React Query hooks
  - <AiImproveButton/> dialog with preset chips + freeform instruction
  - <AiDescribeButton/> dialog for AI event descriptions
  - <AiSubjectVariantsButton/> popover with 5 picks + regenerate
affects:
  - artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx (replaces "AI Suggestions — click to apply" with AiImproveButton)
  - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx (replaces collapsible suggestions panel + adds AiSubjectVariantsButton next to subject)
  - artifacts/hypespace/src/pages/events/event-setup.tsx (post-generation refine: AiImproveButton)
  - artifacts/hypespace/src/pages/events/event-edit.tsx (replaces template-only AIDescriptionButton with real AiDescribeButton)
  - artifacts/hypespace/src/components/events/event-creation-modal.tsx (AiDescribeButton on description field)
tech-stack:
  added: []
  patterns:
    - "Shared AI dispatch via callAI({system, user, maxTokens}) — generateCampaignWithAI, rewriteHtmlWithAI, describeEventWithAI, generateSubjectVariantsWithAI all use it"
    - "Mirrored AI_NOT_CONFIGURED 400 + AI_*_FAILED 502 envelope from /campaigns/ai-generate"
    - "Frontend uses generated React Query mutation hooks; 'AI_NOT_CONFIGURED' detected in onError via ApiError.data.error"
key-files:
  created:
    - artifacts/hypespace/src/components/ai-improve-button.tsx
    - artifacts/hypespace/src/components/ai-describe-button.tsx
    - artifacts/hypespace/src/components/ai-subject-variants-button.tsx
  modified:
    - lib/api-spec/openapi.yaml (3 ops + 6 schemas)
    - lib/api-zod/src/generated/** (regenerated)
    - lib/api-zod/src/index.ts (reverted to single export to avoid TS2308 ambiguity in composite build)
    - lib/api-client-react/src/generated/** (regenerated)
    - artifacts/api-server/src/lib/ai-campaign.ts (refactor + 3 new exports)
    - artifacts/api-server/src/routes/campaigns.ts (+2 endpoints)
    - artifacts/api-server/src/routes/events.ts (+1 endpoint)
    - artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx
    - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx
    - artifacts/hypespace/src/pages/events/event-setup.tsx
    - artifacts/hypespace/src/pages/events/event-edit.tsx
    - artifacts/hypespace/src/components/events/event-creation-modal.tsx
  deleted:
    - artifacts/hypespace/src/lib/campaign-suggestions.ts
    - artifacts/hypespace/src/components/campaign-suggestion-list.tsx
decisions:
  - "Used operationId-suffixed names from generated api.ts (AiSubjectVariantsCampaignBody) instead of component schema names — orval names them after operationId, and the worktree's api-zod/index.ts only re-exports from api.ts."
  - "Reverted api-zod/src/index.ts back to single export. The dual export `export * from './generated/types'` triggers TS2308 ambiguity errors in composite builds because the same names exist in both api.ts (zod schemas) and types/ (typescript interfaces)."
  - "campaign-edit.tsx subject variants button uses campaign.name as eventTitle fallback (campaign-edit doesn't load the underlying event)."
  - "Replaced existing template-based AIDescriptionButton in event-edit.tsx with the new real-AI AiDescribeButton — the template flow was the same dead pattern as campaign-suggestions."
  - "campaign-edit.tsx 'Refine with AI' is a flat button row (no collapsible chevron). Per Karpathy: when only one button exists, the toggle is overkill."
metrics:
  duration: ~50 minutes
  completed: 2026-04-18T18:54:46Z
  tasks_completed: 5
  commits:
    - 26a8371 feat(quick-260418-pnc): add 3 AI editing endpoints + regenerate API client
    - 373c869 refactor(quick-260418-pnc): extract callAI dispatch + add 3 new AI helpers
    - 594725a feat(quick-260418-pnc): wire 3 new AI endpoints in campaigns + events routes
    - f894f51 feat(quick-260418-pnc): add 3 AI editing UI components, delete suggestion regex flow
    - 2123e13 feat(quick-260418-pnc): wire AI editing components into 5 consumer pages
---

# Quick 260418-pnc: AI Editing Suite Summary

Three real LLM-powered editing tools — Improve (rewrite HTML), Describe (event description), and Suggest Subject Variants — replacing the dead regex-template suggestion flow.

## Endpoints Added

| Method | Path                                                       | Body schema (zod)               | Success | Errors                                                                    |
| ------ | ---------------------------------------------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------- |
| POST   | `/api/organizations/:orgId/campaigns/ai-rewrite`           | `AiRewriteCampaignBody`         | `{ html, subject }` | 400 `AI_NOT_CONFIGURED`, 502 `AI_REWRITE_FAILED`           |
| POST   | `/api/organizations/:orgId/campaigns/ai-subject-variants`  | `AiSubjectVariantsCampaignBody` | `{ variants: string[] }` | 400 `AI_NOT_CONFIGURED`, 502 `AI_SUBJECT_VARIANTS_FAILED` |
| POST   | `/api/organizations/:orgId/events/ai-describe`             | `AiDescribeEventBody`           | `{ description }` | 400 `AI_NOT_CONFIGURED`, 502 `AI_DESCRIBE_FAILED`             |

All three mirror the canonical `/campaigns/ai-generate` envelope (orgAiConfig built from `organizationsTable.aiProvider/aiApiKey/aiModel/aiBaseUrl`, `isAiAvailable` gate, try/catch with `provider`/`detail` on failure).

## Helper Functions Added (artifacts/api-server/src/lib/ai-campaign.ts)

| Export                                | Inputs                                                                              | Output              | maxTokens |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- | --------- |
| `rewriteHtmlWithAI(input, config?)`   | `{ html, subject, instruction, eventTitle? }`                                       | `{ html, subject }` | 4096      |
| `describeEventWithAI(input, config?)` | `{ title, type?, category?, location?, additionalContext? }`                        | `{ description }`   | 1024      |
| `generateSubjectVariantsWithAI(...)`  | `{ campaignType, eventTitle, tone?, currentSubject? }`                              | `{ variants[] }`    | 1024      |

The provider switch is shared via a single private `callAI(config, { system, user, maxTokens })` function. The four public exports (`generateCampaignWithAI` + the three above) all dispatch through it. `parseAiResponse` was split — JSON validation specific to `CampaignOutput` stays put; fence-stripping moved to a private `stripCodeFences()` reused by all four.

## Components Added (artifacts/hypespace/src/components/)

| Component                                  | Trigger                                | Mutation hook                       | Consumer pages                                     |
| ------------------------------------------ | -------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `<AiImproveButton/>`                       | Dialog with 4 preset chips + textarea  | `useAiRewriteCampaign`              | campaign-ai, campaign-edit, event-setup            |
| `<AiDescribeButton/>`                      | Dialog with optional context textarea  | `useAiDescribeEvent`                | event-creation-modal, event-edit                   |
| `<AiSubjectVariantsButton/>`               | Popover with 5 picks + regenerate      | `useAiSubjectVariantsCampaign`      | campaign-edit                                      |

All three handle `AI_NOT_CONFIGURED` by detecting `error.data?.error === "AI_NOT_CONFIGURED"` in `onError` and toasting a redirect message ("Open Settings → AI to set up a provider.").

## Files Deleted

- `artifacts/hypespace/src/lib/campaign-suggestions.ts` (regex template flow)
- `artifacts/hypespace/src/components/campaign-suggestion-list.tsx` (chip UI)

## Manual Smoke Test Results

**Not performed** — the executor agent cannot drive a browser. Smoke testing must be performed by the user post-merge:

1. **Improve with AI:** Open any campaign → click "Improve with AI" → type "make it shorter and add urgency" → confirm editor swaps in shorter HTML + new subject.
2. **Generate with AI (event description):** Open event create modal → type a title → click "Generate with AI" next to Description → confirm a 2-4 sentence description appears.
3. **Suggest subject lines:** On a draft campaign-edit page → click "Suggest subject lines" near the subject input → confirm 5 variants appear → click one → confirm subject input updates.
4. **AI_NOT_CONFIGURED path:** With an org that has `aiProvider = "none"`, trigger any of the three actions → confirm toast says "AI not configured — Open Settings → AI to set up a provider."

The dev server may need a restart to pick up the new routes and regenerated hooks (`pnpm dev` from repo root).

## Deviations from Plan

### [Rule 1 - Bug] OpenAPI schema/operation name collision in api-zod

**Found during:** Task 3 typecheck.

**Issue:** Plan specified body schemas named `AiSubjectVariantsBody`/`AiSubjectVariantsResponse`. orval generated `AiSubjectVariantsCampaignBody`/`AiSubjectVariantsCampaignResponse` from the operationId `aiSubjectVariantsCampaign`, then ALSO wrote `AiSubjectVariantsBody`/`AiSubjectVariantsResponse` as TypeScript interfaces in `types/`. The dual `export * from "./generated/api"; export * from "./generated/types";` in api-zod/src/index.ts produces TS2308 ambiguity (same name from two paths) which fails `composite: true` builds — meaning the api-server's references-based typecheck cannot read the regenerated types.

**Fix (Rule 1, no architectural change):**
1. Reverted `lib/api-zod/src/index.ts` back to its original single line (`export * from "./generated/api";`).
2. Updated route handlers to use the operationId-suffixed names from api.ts: `AiSubjectVariantsCampaignBody.safeParse(...)` and `res.json(AiSubjectVariantsCampaignResponse.parse(result))`.

This matches how the existing `AiGenerateCampaignBody` works (the body schema and operationId-derived schema happen to have identical names there because the operation is `aiGenerateCampaign` and the schema is `AiGenerateCampaignBody`).

**Files modified:** `lib/api-zod/src/index.ts`, `artifacts/api-server/src/routes/campaigns.ts`. **Commit:** `594725a`.

### [Rule 2 - Add critical functionality] Replace template-based AIDescriptionButton in event-edit.tsx

**Found during:** Task 5.

**Issue:** Plan called for adding `AiDescribeButton` to event-edit.tsx description field. event-edit.tsx already had a similar template-based `AIDescriptionButton` (regex/string templates, not real AI) — same dead pattern as `campaign-suggestions.ts`. Leaving both would have given users two competing buttons.

**Fix:** Replaced the existing `AIDescriptionButton` import + call with the new `AiDescribeButton` (real LLM via `/events/ai-describe`). The old `ai-description-button.tsx` file still exists (referenced by `event-new.tsx` which wasn't in this plan's scope) — flagged for cleanup in a follow-up.

**Files modified:** `artifacts/hypespace/src/pages/events/event-edit.tsx`. **Commit:** `2123e13`.

### [Karpathy - Surgical clean-up] Removed showSuggestions state from campaign-edit.tsx

The plan permitted optionally inlining the AiImproveButton without the collapsible toggle. Chose to do so (single button → no need for chevron toggle). Removed orphaned `showSuggestions` state and `ChevronDown`/`ChevronUp` imports made unused by my changes. No additional code touched beyond what my changes orphaned.

## Deferred Items / Follow-ups

- `artifacts/hypespace/src/components/ai-description-button.tsx` is now only used by `artifacts/hypespace/src/pages/events/event-new.tsx` (template-based fallback). When event-new.tsx is touched next, the same swap should land there and this file can be deleted.
- Pre-existing TS errors in `artifacts/api-server/src/routes/admin.ts` (3 errors about `Session.isAdmin`/`impersonating`) are out-of-scope per executor constraints. Documented; not fixed.
- Pre-existing TS errors in many frontend files (3D components missing `@react-three/*` deps; campaign-edit.tsx/event-detail.tsx using `{ enabled }` shorthand without `queryKey`; dashboard/event-detail referencing missing properties on generated types). All pre-existed at the worktree base commit `07ba58d`. None introduced by this plan.

## Verification Status

| Check                                                                | Result        |
| -------------------------------------------------------------------- | ------------- |
| `npx orval --config lib/api-spec/orval.config.ts` succeeds           | PASS          |
| api-zod composite build (`tsc --build --force`)                      | PASS (after index.ts fix) |
| api-client-react composite build                                     | PASS          |
| api-server `tsc --noEmit`                                            | PASS for new code (3 pre-existing admin.ts errors)         |
| frontend `tsc --noEmit` for new components + wired pages             | PASS for new code (only pre-existing errors remain)        |
| `grep -r "campaign-suggestion" artifacts/`                           | 0 hits        |
| `grep -r "applySuggestionToHtml\|getSuggestionMeta\|DEFAULT_SUGGESTIONS" artifacts/` | 0 hits |

## Self-Check: PASSED

All commits verified in git log; all created files exist on disk; deleted files confirmed gone.
