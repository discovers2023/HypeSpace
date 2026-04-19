---
phase: quick-260419-apb
plan: 01
subsystem: ai-editing
tags: [ai, campaigns, events, ux, discoverability]
requires:
  - existing /api/organizations/:orgId/campaigns/ai-rewrite endpoint (from 260418-pnc)
  - existing /api/organizations/:orgId/events/ai-describe endpoint (from 260418-pnc)
provides:
  - AiPromptBar component (always-visible inline AI input with preset chips)
  - prompt bar wired at top of campaign-edit.tsx (calls /ai-rewrite, updates htmlContent + subject)
  - prompt bar wired at top of event-edit.tsx (calls /ai-describe, updates description)
affects:
  - artifacts/hypespace/src/components/ai-prompt-bar.tsx (created)
  - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx (import + hook + handler + UI insertion)
  - artifacts/hypespace/src/pages/events/event-edit.tsx (import + hook + handler + UI insertion)
key-files:
  created:
    - artifacts/hypespace/src/components/ai-prompt-bar.tsx
  modified:
    - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx
    - artifacts/hypespace/src/pages/events/event-edit.tsx
decisions:
  - "Kept existing dialog-based AiImproveButton + AiDescribeButton + AiSubjectVariantsButton — non-breaking addition"
  - "Events prompt bar reuses /ai-describe with the user's instruction as additionalContext (no new endpoint for tomorrow's deadline)"
  - "Generic AiPromptBar component — parent wires mutation; single component serves both pages"
  - "Enter-to-submit (shift+enter for newline not needed — input, not textarea)"
  - "Manual editing preserved — mutation only updates target fields with shouldDirty:true; user can edit before or after"
---

# Quick 260419-apb: Inline AI Prompt Bar Summary

**One-liner:** Surfaces the already-built AI editing behind a persistent always-visible prompt bar at the top of the campaign-edit and event-edit pages, next to the existing dialog buttons.

## What was done

### Added: `<AiPromptBar/>` component
Generic component: placeholder text, optional preset chips, pending state, onSubmit callback. Parent handles the mutation.

### Wired into campaign-edit.tsx
- Imports `useAiRewriteCampaign` and `AiPromptBar`
- `handleAiPrompt(instruction)` calls `/ai-rewrite` with current HTML + subject + instruction
- On success: updates `htmlContent` and `subject` (shouldDirty:true) + re-extracts visual fields (bodyIntro, ctaLabel)
- Renders at the top of the LEFT editor panel, above the Form, only when `!isSent`
- Presets: "Make it shorter", "Add urgency", "More formal", "More casual"

### Wired into event-edit.tsx
- Imports `useAiDescribeEvent` and `AiPromptBar`
- `handleAiPrompt(instruction)` validates title, then calls `/ai-describe` with title + type + category + location + `additionalContext: instruction`
- On success: updates `description` (shouldDirty:true). Other fields (title, date, location, etc.) stay manually editable
- Renders just before the Section tabs, above the form card
- Presets: "Make it shorter", "More professional", "Highlight networking", "Add a call to action"

## Scope preserved
- Existing `<AiImproveButton/>`, `<AiDescribeButton/>`, `<AiSubjectVariantsButton/>` untouched — still available for dialog-style use
- All manual editing flows unchanged

## Typecheck
- `ai-prompt-bar.tsx` — clean (0 errors)
- `campaign-edit.tsx` new code at lines ~165 and ~480 — clean; pre-existing errors at 100/112/294/308 untouched (QUAL-01 backlog)
- `event-edit.tsx` new code — clean

## Smoke test
- Vite compiles all three files (200 OK on HMR endpoints)
- `/api/organizations/1/campaigns/ai-rewrite` reachable (returns 502 only because test Anthropic key has zero credit balance — endpoint shape is correct; existing issue not introduced here)
- `/api/organizations/1/events/ai-describe` reachable (same)

## Not done (scope preserved for deadline)
- Event prompt bar only rewrites `description` — does not touch title/date/location/etc. Expanding to multi-field edits would require a new backend endpoint; not in scope for tomorrow's ship.
- No automated browser UAT (no Playwright MCP available in this session).
