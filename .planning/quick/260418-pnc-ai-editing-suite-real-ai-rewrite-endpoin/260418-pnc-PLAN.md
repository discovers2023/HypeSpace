---
phase: quick-260418-pnc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/api-spec/openapi.yaml
  - lib/api-zod/src/generated/**
  - lib/api-client-react/src/generated/**
  - artifacts/api-server/src/lib/ai-campaign.ts
  - artifacts/api-server/src/routes/campaigns.ts
  - artifacts/api-server/src/routes/events.ts
  - artifacts/hypespace/src/components/ai-improve-button.tsx
  - artifacts/hypespace/src/components/ai-describe-button.tsx
  - artifacts/hypespace/src/components/ai-subject-variants-button.tsx
  - artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx
  - artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx
  - artifacts/hypespace/src/pages/events/event-setup.tsx
  - artifacts/hypespace/src/pages/events/event-edit.tsx
  - artifacts/hypespace/src/components/events/event-creation-modal.tsx
  - artifacts/hypespace/src/lib/campaign-suggestions.ts (delete)
  - artifacts/hypespace/src/components/campaign-suggestion-list.tsx (delete)
autonomous: true
requirements: [QH-260418-pnc]
must_haves:
  truths:
    - "User can click 'Improve with AI' on a campaign body, type an instruction (or pick a preset chip), and the editor swaps in an LLM-rewritten HTML + subject."
    - "User can click 'Generate with AI' on the event description field and get an LLM-written description filled in."
    - "User can click 'Suggest subject variants' near the campaign subject input and pick one of 5 LLM-generated alternatives."
    - "If the org has no AI provider configured, the same AI_NOT_CONFIGURED toast appears (no silent failure, no template fallback)."
    - "The old regex `applySuggestionToHtml` flow and 'AI Suggestions — click to apply' chips are gone from campaign-ai, campaign-edit, and event-setup."
    - "Codegen produces working `useAiRewriteCampaign`, `useAiDescribeEvent`, `useAiSubjectVariants` React Query hooks."
  artifacts:
    - path: "lib/api-spec/openapi.yaml"
      provides: "3 new endpoints: campaigns/ai-rewrite, campaigns/ai-subject-variants, events/ai-describe + 6 schemas"
    - path: "artifacts/api-server/src/lib/ai-campaign.ts"
      provides: "rewriteHtmlWithAI(), describeEventWithAI(), generateSubjectVariantsWithAI() — all use existing provider dispatch"
    - path: "artifacts/api-server/src/routes/campaigns.ts"
      provides: "POST /campaigns/ai-rewrite + POST /campaigns/ai-subject-variants"
    - path: "artifacts/api-server/src/routes/events.ts"
      provides: "POST /events/ai-describe"
    - path: "artifacts/hypespace/src/components/ai-improve-button.tsx"
      provides: "AI rewrite button + dialog (preset chips + freeform instruction)"
    - path: "artifacts/hypespace/src/components/ai-describe-button.tsx"
      provides: "AI event description button + dialog"
    - path: "artifacts/hypespace/src/components/ai-subject-variants-button.tsx"
      provides: "Subject variants dropdown picker"
  key_links:
    - from: "artifacts/api-server/src/routes/campaigns.ts (ai-rewrite)"
      to: "artifacts/api-server/src/lib/ai-campaign.ts (rewriteHtmlWithAI)"
      via: "direct import — same provider dispatch as generateCampaignWithAI"
      pattern: "rewriteHtmlWithAI"
    - from: "artifacts/hypespace/src/components/ai-improve-button.tsx"
      to: "/api/organizations/:orgId/campaigns/ai-rewrite"
      via: "useAiRewriteCampaign() generated hook"
      pattern: "useAiRewriteCampaign"
    - from: "artifacts/hypespace/src/components/ai-describe-button.tsx"
      to: "/api/organizations/:orgId/events/ai-describe"
      via: "useAiDescribeEvent() generated hook"
      pattern: "useAiDescribeEvent"
---

<objective>
Replace the broken regex-based campaign suggestion buttons with three real LLM-powered editing tools that reuse the org's existing AI provider config:

1. **Rewrite** any campaign body HTML based on a freeform instruction or preset ("Shorter", "More formal", "Add urgency", "More casual").
2. **Generate** event descriptions with AI from the event creation/edit forms.
3. **Suggest** 5 alternative subject lines for a campaign.

Purpose: The existing regex flow only tweaks string templates produced by AI generation — it can't actually edit user-written HTML or respond to instructions like "make it shorter". Solo-dev pre-ship cleanup: dead code goes, real value lands.

Output:
- 3 new API endpoints + 3 generated React Query hooks
- 3 new React components (`AiImproveButton`, `AiDescribeButton`, `AiSubjectVariantsButton`)
- Wired into campaign-ai, campaign-edit, event-setup, event-edit, event-creation-modal
- Deletion of `campaign-suggestions.ts` and `campaign-suggestion-list.tsx`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@artifacts/hypespace/CLAUDE.md
@artifacts/api-server/src/lib/ai-campaign.ts
@artifacts/api-server/src/routes/campaigns.ts
@artifacts/api-server/src/routes/events.ts
@lib/api-spec/openapi.yaml
@lib/api-spec/orval.config.ts
@lib/db/src/schema/organizations.ts
@artifacts/hypespace/src/lib/campaign-suggestions.ts
@artifacts/hypespace/src/components/campaign-suggestion-list.tsx
@artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx
@artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx
@artifacts/hypespace/src/pages/events/event-setup.tsx
@artifacts/hypespace/src/pages/events/event-edit.tsx
@artifacts/hypespace/src/components/events/event-creation-modal.tsx

<interfaces>
<!-- Key contracts the executor needs. Match these EXACTLY — do not invent new shapes. -->

From `artifacts/api-server/src/lib/ai-campaign.ts`:
- `export class AiGenerationError extends Error { provider: string; detail: string }`
- `export function isAiAvailable(config?: AiConfig | null): boolean`
- `export async function generateCampaignWithAI(input: CampaignInput, config?: AiConfig | null): Promise<CampaignOutput>`
- Internal helpers (already exist, REUSE): `parseAiResponse(text)`, `generateWithAnthropic`, `generateWithOpenAICompatible`. Refactor these to accept arbitrary `{ system, user }` prompts so the new helpers can share dispatch (see Task 2).

From `lib/db/src/schema/organizations.ts`:
- `organizationsTable.aiProvider` ("none" | "anthropic" | "gemini" | "openai" | "ollama")
- `organizationsTable.aiApiKey` (text, nullable)
- `organizationsTable.aiModel` (text, nullable)
- `organizationsTable.aiBaseUrl` (text, nullable)

From `artifacts/api-server/src/routes/campaigns.ts` (lines 271–382, the gold-standard pattern to mirror):
- Parse `orgId` from path, run `safeParse` on body, fetch org row, build `orgAiConfig`,
  call `isAiAvailable`, return `400 { error: "AI_NOT_CONFIGURED", message: "..." }` if not configured,
  try/catch around AI call returning `502 { error: "AI_GENERATION_FAILED", provider, detail }`.

From the generated client (already present, examples to mirror):
- `useAiGenerateCampaign()` mutation accepts `{ orgId, data }`, returns `{ subject, htmlContent, textContent, suggestions, heroImageUrl }`.
- New hooks will be auto-generated as: `useAiRewriteCampaign`, `useAiDescribeEvent`, `useAiSubjectVariants` (orval naming based on operationId).

From `lib/api-spec/orval.config.ts`:
- Codegen command: `pnpm --filter @workspace/api-spec codegen`
- Outputs to `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`.
</interfaces>

<existing_pattern_to_mirror>
The endpoint shape, error envelopes, and orgAiConfig construction at `artifacts/api-server/src/routes/campaigns.ts:271-382` are the canonical reference. Copy that structure for ALL three new endpoints. Do not invent new error shapes.
</existing_pattern_to_mirror>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 3 endpoints + 6 schemas to OpenAPI and run codegen</name>
  <files>lib/api-spec/openapi.yaml, lib/api-zod/src/generated/**, lib/api-client-react/src/generated/**</files>
  <action>
    Edit `lib/api-spec/openapi.yaml` and add three operations under `paths:` (place them next to the existing ai-generate operations, around line 685 — after `ai-generate-image`, before `/organizations/{orgId}/social-posts`):

    1. `POST /organizations/{orgId}/campaigns/ai-rewrite` — operationId `aiRewriteCampaign`, tag `campaigns`, body `AiRewriteCampaignBody`, 200 response `AiRewriteCampaignResponse`.
    2. `POST /organizations/{orgId}/campaigns/ai-subject-variants` — operationId `aiSubjectVariantsCampaign`, tag `campaigns`, body `AiSubjectVariantsBody`, 200 response `AiSubjectVariantsResponse`.
    3. `POST /organizations/{orgId}/events/ai-describe` — operationId `aiDescribeEvent`, tag `events`, body `AiDescribeEventBody`, 200 response `AiDescribeEventResponse`.

    All three take `orgId` as integer path parameter (mirror the existing ai-generate parameter block exactly).

    Add the corresponding component schemas under `components.schemas:` (place near the existing `AiGenerateCampaignBody` block around line 1419). Use these EXACT shapes:

    ```yaml
    AiRewriteCampaignBody:
      type: object
      properties:
        html:        { type: string }
        subject:     { type: string }
        instruction: { type: string, description: "Freeform user instruction, e.g. 'make it shorter' or 'add urgency'." }
        eventTitle:  { type: string, nullable: true }
      required: [html, subject, instruction]
    AiRewriteCampaignResponse:
      type: object
      properties:
        html:    { type: string }
        subject: { type: string }
      required: [html, subject]

    AiSubjectVariantsBody:
      type: object
      properties:
        campaignType:   { type: string, enum: [invitation, reminder, followup, announcement, custom] }
        eventTitle:     { type: string }
        tone:           { type: string, nullable: true }
        currentSubject: { type: string, nullable: true }
      required: [campaignType, eventTitle]
    AiSubjectVariantsResponse:
      type: object
      properties:
        variants:
          type: array
          items: { type: string }
      required: [variants]

    AiDescribeEventBody:
      type: object
      properties:
        title:             { type: string }
        type:              { type: string, nullable: true, description: "in-person | online | hybrid" }
        category:          { type: string, nullable: true }
        location:          { type: string, nullable: true }
        additionalContext: { type: string, nullable: true }
      required: [title]
    AiDescribeEventResponse:
      type: object
      properties:
        description: { type: string }
      required: [description]
    ```

    After editing, run codegen from the repo root:
    ```
    pnpm --filter @workspace/api-spec codegen
    ```
    This regenerates `lib/api-zod/src/generated/**` and `lib/api-client-react/src/generated/**`. Both packages re-export everything via `src/index.ts`, so the new `AiRewriteCampaignBody` etc. and `useAiRewriteCampaign` etc. become available immediately.

    Then typecheck both lib packages:
    ```
    pnpm --filter @workspace/api-zod exec tsc --noEmit
    pnpm --filter @workspace/api-client-react exec tsc --noEmit
    ```

    DO NOT hand-edit any file under `generated/` — orval will overwrite.
  </action>
  <verify>
    <automated>pnpm --filter @workspace/api-spec codegen && pnpm --filter @workspace/api-zod exec tsc --noEmit && pnpm --filter @workspace/api-client-react exec tsc --noEmit</automated>
    Also confirm: `grep -l "useAiRewriteCampaign" lib/api-client-react/src/generated` finds the hook, and `grep -l "AiRewriteCampaignBody" lib/api-zod/src/generated` finds the schema.
  </verify>
  <done>OpenAPI has 3 new endpoints + 6 schemas; codegen produces the new hooks/zod schemas; both lib packages typecheck cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add rewrite/describe/subject-variants helpers to ai-campaign.ts (refactor dispatch to be reusable)</name>
  <files>artifacts/api-server/src/lib/ai-campaign.ts</files>
  <action>
    The existing file hard-couples `SYSTEM_PROMPT` + `buildUserPrompt` into `generateWithAnthropic` and `generateWithOpenAICompatible`. Refactor those two functions to accept `{ system: string; user: string; maxTokens?: number }` instead of `(config, input)`, and have `generateCampaignWithAI` build its prompt and call them. This keeps existing behavior intact while exposing reusable dispatch.

    New shape (sketch — DON'T add features, just split):
    ```ts
    interface AiCallArgs { system: string; user: string; maxTokens?: number }

    async function callAnthropic(config: AiConfig, args: AiCallArgs): Promise<string> { ... returns raw text ... }
    async function callOpenAICompatible(config: AiConfig, args: AiCallArgs): Promise<string> { ... }

    async function callAI(config: AiConfig, args: AiCallArgs): Promise<string> {
      switch (config.provider) {
        case "anthropic": return callAnthropic(config, args);
        case "openai": case "gemini": case "ollama": return callOpenAICompatible(config, args);
        default: throw new Error(`Unsupported AI provider: ${config.provider}`);
      }
    }
    ```

    Then update `generateCampaignWithAI` to build its prompt then `parseAiResponse(await callAI(effectiveConfig, { system: SYSTEM_PROMPT, user: buildUserPrompt(input), maxTokens: 4096 }))`. Keep all existing error handling (resolve effectiveConfig, isAiAvailable check pattern, AiGenerationError wrap) — do NOT change exported signatures.

    Add three new exported helpers:

    ```ts
    export interface RewriteInput { html: string; subject: string; instruction: string; eventTitle?: string }
    export interface RewriteOutput { html: string; subject: string }
    export async function rewriteHtmlWithAI(input: RewriteInput, config?: AiConfig | null): Promise<RewriteOutput>

    export interface DescribeEventInput { title: string; type?: string | null; category?: string | null; location?: string | null; additionalContext?: string | null }
    export async function describeEventWithAI(input: DescribeEventInput, config?: AiConfig | null): Promise<{ description: string }>

    export interface SubjectVariantsInput { campaignType: string; eventTitle: string; tone?: string | null; currentSubject?: string | null }
    export async function generateSubjectVariantsWithAI(input: SubjectVariantsInput, config?: AiConfig | null): Promise<{ variants: string[] }>
    ```

    All three:
    1. Resolve effectiveConfig the same way `generateCampaignWithAI` does (org config → fallback to ANTHROPIC_API_KEY env).
    2. Throw `AiGenerationError` if no key (same pattern).
    3. Build a focused system+user prompt (see prompts below), call `callAI(...)`, parse JSON.
    4. Wrap exceptions in `AiGenerationError` (mirror existing try/catch block).

    Prompts — keep these tight, no fluff:

    **rewriteHtmlWithAI** system: `"You are an email-HTML editor. You receive an existing HTML email and a user instruction. Apply the instruction while preserving the table-based 600px layout, inline styles, and any tracking placeholders. Return ONLY raw JSON: {\"html\":\"...\",\"subject\":\"...\"}."`
    user: `"INSTRUCTION:\n${input.instruction}\n\nCURRENT SUBJECT:\n${input.subject}\n\nCURRENT HTML:\n${input.html}\n\nReturn ONLY raw JSON (no markdown fences):\n{\"html\":\"...\",\"subject\":\"...\"}"`

    **describeEventWithAI** system: `"You write concise, specific event descriptions for invitation pages. 2–4 sentences. No clichés. No 'don't miss out', 'unforgettable', 'join us for'. Return ONLY raw JSON: {\"description\":\"...\"}."`
    user: includes title, type, category, location, additionalContext (each on its own line, omit nulls). End with the JSON contract line.

    **generateSubjectVariantsWithAI** system: `"You write email subject lines. Punchy, specific, under 60 characters. Vary style across the 5 variants (curiosity, urgency, benefit, question, statement). No emojis unless the tone is casual. Return ONLY raw JSON: {\"variants\":[\"...\",\"...\",\"...\",\"...\",\"...\"]}."`
    user: includes campaignType, eventTitle, tone, currentSubject (omit nulls). End with the JSON contract.

    Reuse `parseAiResponse`'s fence-stripping logic for the new responses — extract a tiny helper `stripCodeFences(text)` if needed (don't duplicate the strip code into 3 places). Validate parsed shape; if missing required fields, throw "AI response missing required fields" (same pattern as existing).

    For `rewriteHtmlWithAI`, set `maxTokens: 4096`. For describe and subject-variants, set `maxTokens: 1024`.

    DO NOT add new dependencies. DO NOT touch `generateCampaignImage` or `ai-image.ts`.
  </action>
  <verify>
    <automated>pnpm --filter @workspace/api-server exec tsc --noEmit</automated>
    Manual: read the new exports — confirm callAI is the single dispatch path, all four public functions (`generateCampaignWithAI`, `rewriteHtmlWithAI`, `describeEventWithAI`, `generateSubjectVariantsWithAI`) call it.
  </verify>
  <done>Refactor preserves existing behavior, three new exported helpers compile, no new deps added, error envelopes match existing pattern.</done>
</task>

<task type="auto">
  <name>Task 3: Wire 3 new endpoints in campaigns.ts and events.ts</name>
  <files>artifacts/api-server/src/routes/campaigns.ts, artifacts/api-server/src/routes/events.ts</files>
  <action>
    **In `artifacts/api-server/src/routes/campaigns.ts`:**

    Add to the existing `@workspace/api-zod` import block:
    ```ts
    AiRewriteCampaignBody, AiRewriteCampaignResponse,
    AiSubjectVariantsBody, AiSubjectVariantsResponse,
    ```
    Add to the existing `../lib/ai-campaign` import:
    ```ts
    rewriteHtmlWithAI, generateSubjectVariantsWithAI,
    ```

    Append two endpoints AFTER the existing `ai-generate-image` handler (before `export default router;`):

    1. `router.post("/organizations/:orgId/campaigns/ai-rewrite", ...)` — mirror lines 271–382 structure precisely:
       - Parse orgId from path (handle Array case)
       - `AiRewriteCampaignBody.safeParse(req.body)`, return 400 on fail with `{ error: parsed.error.message }`
       - Fetch org row, build `orgAiConfig` (identical to lines 314–323)
       - `isAiAvailable` check → return 400 `{ error: "AI_NOT_CONFIGURED", message: "..." }` (identical text to line 329)
       - try: `const result = await rewriteHtmlWithAI({ html, subject, instruction, eventTitle }, orgAiConfig);`
         then `res.json(AiRewriteCampaignResponse.parse(result));`
       - catch: identical to lines 372–381 but with error code `"AI_REWRITE_FAILED"`.

    2. `router.post("/organizations/:orgId/campaigns/ai-subject-variants", ...)` — same pattern. On success: `res.json(AiSubjectVariantsResponse.parse(result));`. catch error code: `"AI_SUBJECT_VARIANTS_FAILED"`. maxTokens for AI helper is set inside the helper, no need to specify here.

    **In `artifacts/api-server/src/routes/events.ts`:**

    Add to the existing `@workspace/api-zod` import block:
    ```ts
    AiDescribeEventBody, AiDescribeEventResponse,
    ```
    Add new import: `import { isAiAvailable, describeEventWithAI } from "../lib/ai-campaign";`

    Append one endpoint at the END of the file (before `export default router;`):

    `router.post("/organizations/:orgId/events/ai-describe", ...)` — mirror the campaigns/ai-rewrite pattern:
    - Parse orgId
    - `AiDescribeEventBody.safeParse`
    - Fetch org row from `organizationsTable` (use `eq(organizationsTable.id, orgId)`)
    - Build `orgAiConfig` (same shape)
    - `isAiAvailable` → 400 AI_NOT_CONFIGURED
    - try: `const result = await describeEventWithAI({ title, type, category, location, additionalContext }, orgAiConfig);`
      then `res.json(AiDescribeEventResponse.parse(result));`
    - catch: error code `"AI_DESCRIBE_FAILED"`, log, return 502.

    Note: `events.ts` already imports `organizationsTable` from `@workspace/db` (line 2). No new schema imports needed.

    DO NOT add auth middleware overrides — all routes are protected by the global `requireAuth` configured in app/index.ts.
  </action>
  <verify>
    <automated>pnpm --filter @workspace/api-server exec tsc --noEmit</automated>
    Manual smoke (after Task 4 deploys server): `curl -X POST http://localhost:4000/api/organizations/1/campaigns/ai-rewrite -H "Content-Type: application/json" --cookie "session=..." -d '{"html":"&lt;p&gt;hi&lt;/p&gt;","subject":"Hi","instruction":"make it shorter"}'` returns `{ html, subject }` (or `AI_NOT_CONFIGURED` if no provider set).
  </verify>
  <done>Three new POST routes present, mirror existing ai-generate error envelopes, server typechecks, all use isAiAvailable + orgAiConfig pattern from line 314–332.</done>
</task>

<task type="auto">
  <name>Task 4: Build 3 new React components (AiImproveButton, AiDescribeButton, AiSubjectVariantsButton) + delete dead files</name>
  <files>artifacts/hypespace/src/components/ai-improve-button.tsx, artifacts/hypespace/src/components/ai-describe-button.tsx, artifacts/hypespace/src/components/ai-subject-variants-button.tsx, artifacts/hypespace/src/lib/campaign-suggestions.ts (delete), artifacts/hypespace/src/components/campaign-suggestion-list.tsx (delete)</files>
  <action>
    All three components live in `artifacts/hypespace/src/components/`. Match existing shadcn/ui idiom: import Button/Dialog/Input/Textarea/Badge/Loader2 from existing `@/components/ui/*` and `lucide-react`. Use `useToast` from `@/hooks/use-toast` for error toasts. Use `useAuth` from `@/components/auth-provider` to get `activeOrgId`. Match the AI_NOT_CONFIGURED toast pattern from `campaign-ai.tsx` (look at the `toast({ title: ..., description: ..., variant: "destructive" })` calls there).

    **`ai-improve-button.tsx`** — Button that opens a Dialog with:
    - Heading "Improve with AI"
    - 4 preset chips (Button variant="outline" size="sm"): "Shorter", "More formal", "Add urgency", "More casual". Clicking a chip sets the textarea value to that phrase (or appends — keep simple, just set).
    - Textarea for freeform instruction (placeholder "Tell the AI what to change…")
    - Footer: Cancel + "Improve" button. Improve button disabled when textarea empty or `mutation.isPending`.

    Props:
    ```ts
    interface AiImproveButtonProps {
      html: string;
      subject: string;
      eventTitle?: string;
      onApply: (next: { html: string; subject: string }) => void;
      buttonLabel?: string; // default "Improve with AI"
      buttonClassName?: string;
      compact?: boolean;
    }
    ```

    Behavior: on Improve click, call `useAiRewriteCampaign().mutate({ orgId: activeOrgId, data: { html, subject, instruction, eventTitle } }, { onSuccess: (res) => { onApply({ html: res.html, subject: res.subject }); setOpen(false); toast({ title: "Updated with AI" }); }, onError: (e) => toast({ title: "AI rewrite failed", description: e.message, variant: "destructive" }) })`.

    **`ai-describe-button.tsx`** — Smaller button (icon + "Generate with AI"), opens Dialog with:
    - Optional textarea for "Additional context" (e.g. "Highlight the keynote speaker is Dr. X").
    - Footer: Cancel + Generate. Disable Generate when title prop is empty.

    Props:
    ```ts
    interface AiDescribeButtonProps {
      title: string;
      type?: string | null;
      category?: string | null;
      location?: string | null;
      onApply: (description: string) => void;
      buttonLabel?: string; // default "Generate with AI"
      buttonClassName?: string;
      compact?: boolean;
    }
    ```

    Behavior: `useAiDescribeEvent().mutate({ orgId: activeOrgId, data: { title, type, category, location, additionalContext } }, { onSuccess: (res) => { onApply(res.description); setOpen(false); toast({ title: "Description generated" }); }, onError: ... })`.

    If `title` is empty when button clicked, show toast "Add a title first — the AI needs context" (don't open dialog).

    **`ai-subject-variants-button.tsx`** — Small button "Suggest subject lines". Opens a Popover (use `@/components/ui/popover`) showing:
    - Loading spinner while fetching
    - List of 5 variants, each clickable; clicking calls `onPick(variant)` and closes the popover.
    - Empty state if mutation errored — show error inline with a "Try again" button.

    Props:
    ```ts
    interface AiSubjectVariantsButtonProps {
      campaignType: string;
      eventTitle: string;
      tone?: string | null;
      currentSubject?: string | null;
      onPick: (subject: string) => void;
      buttonClassName?: string;
    }
    ```

    Behavior: when popover opens, fire `useAiSubjectVariants().mutate({ orgId, data: { campaignType, eventTitle, tone, currentSubject } })`. Render `mutation.data?.variants` once loaded.

    All three components: handle the AI_NOT_CONFIGURED case — when the server returns 400 with `error: "AI_NOT_CONFIGURED"`, the existing `customFetch` throws an `ApiError` with `data.error === "AI_NOT_CONFIGURED"`. Detect this in `onError` and toast "AI not configured — open Settings → AI to set up a provider." (mirror exact pattern in `campaign-ai.tsx` if one exists; otherwise check `e.message.includes("AI_NOT_CONFIGURED")` or `(e as any).data?.error === "AI_NOT_CONFIGURED"`).

    **Delete:**
    - `artifacts/hypespace/src/lib/campaign-suggestions.ts`
    - `artifacts/hypespace/src/components/campaign-suggestion-list.tsx`

    These files have ZERO callers after Task 5 lands. Delete them in this task — the imports referenced in campaign-ai.tsx, campaign-edit.tsx, event-setup.tsx will be removed in Task 5, so the deletion will be temporarily orphaned (those three files will fail to compile until Task 5). That's expected. Run typecheck only after Task 5 completes.
  </action>
  <verify>
    <automated>ls artifacts/hypespace/src/components/ai-improve-button.tsx artifacts/hypespace/src/components/ai-describe-button.tsx artifacts/hypespace/src/components/ai-subject-variants-button.tsx && ! ls artifacts/hypespace/src/lib/campaign-suggestions.ts 2>/dev/null && ! ls artifacts/hypespace/src/components/campaign-suggestion-list.tsx 2>/dev/null</automated>
    Files exist; deleted files are gone. Typecheck deferred to Task 5.
  </verify>
  <done>3 new components written using existing shadcn/ui primitives + generated hooks, both old files deleted.</done>
</task>

<task type="auto">
  <name>Task 5: Wire components into 5 consumer pages + final typecheck</name>
  <files>artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx, artifacts/hypespace/src/pages/campaigns/campaign-edit.tsx, artifacts/hypespace/src/pages/events/event-setup.tsx, artifacts/hypespace/src/pages/events/event-edit.tsx, artifacts/hypespace/src/components/events/event-creation-modal.tsx</files>
  <action>
    **`campaign-ai.tsx`** (lines ~432–445): Replace the `<CampaignSuggestionList suggestions={...} html={...} onApply={...} />` block (and the surrounding "AI Suggestions — click to apply" header) with `<AiImproveButton html={generatedResult.htmlContent} subject={generatedResult.subject} eventTitle={selectedEvent?.title} onApply={(next) => setGeneratedResult((prev) => prev ? { ...prev, htmlContent: next.html, subject: next.subject } : prev)} />`. Remove the now-unused `import { CampaignSuggestionList } from "@/components/campaign-suggestion-list"` (and any DEFAULT_SUGGESTIONS import). Add `import { AiImproveButton } from "@/components/ai-improve-button"`. Keep the surrounding CardFooter container; just swap the inner content.

    **`campaign-edit.tsx`** (lines ~683–696): Same swap — replace the `<CampaignSuggestionList suggestions={DEFAULT_SUGGESTIONS} html={...} onApply={...} compact />` with `<AiImproveButton compact html={form.watch("htmlContent") ?? ""} subject={form.watch("subject") ?? ""} eventTitle={event?.title} onApply={(next) => { form.setValue("htmlContent", next.html, { shouldDirty: true }); form.setValue("subject", next.subject, { shouldDirty: true }); setBodyIntro(extractBodyIntro(next.html)); }} />`. Remove `CampaignSuggestionList` and `DEFAULT_SUGGESTIONS` imports. Add `AiImproveButton` import. Keep the collapsible wrapper (chevron toggle) — but consider if it still makes sense given there's only one button now; if it feels weird, just inline the AiImproveButton without the toggle (use your judgment, prefer simplicity per Karpathy guideline).

    Also in `campaign-edit.tsx` near the subject field (around line 486): inside the FormItem after the FormControl/Input, add the variants button. Wrap the Input in a flex row with `<AiSubjectVariantsButton campaignType={form.watch("type") ?? "invitation"} eventTitle={event?.title ?? ""} tone={form.watch("tone") ?? null} currentSubject={form.watch("subject") ?? ""} onPick={(s) => form.setValue("subject", s, { shouldDirty: true })} />`. Hide the variants button when `isSent` is true (campaign already sent — don't allow editing).

    **`event-setup.tsx`** (lines ~558–565): Same CampaignSuggestionList swap as campaign-ai.tsx, using the local `generated` state. `<AiImproveButton compact html={generated.htmlContent} subject={generated.subject} eventTitle={event.title} onApply={(next) => setGenerated((prev) => prev ? { ...prev, htmlContent: next.html, subject: next.subject } : prev)} />`. Remove old import, add new import.

    **`event-creation-modal.tsx`** (around line 568, the description FormField): Inside the FormItem, place the AiDescribeButton next to (or just below) the FormLabel. `<AiDescribeButton title={form.watch("title") ?? ""} type={form.watch("type") ?? null} category={form.watch("category") ?? null} location={form.watch("location") ?? null} onApply={(desc) => form.setValue("description", desc, { shouldDirty: true })} compact />`. Place it as a small button on the right side of the label row — match the visual weight of nearby form labels (don't make it dominate).

    **`event-edit.tsx`** (around line 643, the description FormField): Same AiDescribeButton wiring as event-creation-modal.

    After all wiring, run typecheck across the workspace:
    ```
    pnpm --filter hypespace exec tsc --noEmit
    pnpm --filter @workspace/api-server exec tsc --noEmit
    ```

    Both must pass. No remaining references to `CampaignSuggestionList`, `applySuggestionToHtml`, `getSuggestionMeta`, `DEFAULT_SUGGESTIONS`, or `campaign-suggestions` should exist anywhere — confirm with `grep -r "campaign-suggestion" artifacts/hypespace/src/` returning nothing.
  </action>
  <verify>
    <automated>pnpm --filter hypespace exec tsc --noEmit && pnpm --filter @workspace/api-server exec tsc --noEmit && (grep -r "campaign-suggestion" artifacts/hypespace/src/ artifacts/api-server/src/ 2>/dev/null | grep -v node_modules; test $? -eq 1)</automated>
    Manual smoke (run the dev servers): open a campaign, click "Improve with AI", type "make it shorter and add urgency", confirm the editor swaps in shorter HTML. Open event create modal, type a title, click "Generate with AI" on description, confirm a description appears. On a draft campaign, click "Suggest subject lines" — confirm 5 variants appear and clicking one updates the input.
  </verify>
  <done>All 5 consumer pages updated, no dead imports remain, frontend + backend typecheck green, manual smoke for all 3 features confirmed.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @workspace/api-spec codegen` succeeds
- `pnpm --filter @workspace/api-zod exec tsc --noEmit` passes
- `pnpm --filter @workspace/api-client-react exec tsc --noEmit` passes
- `pnpm --filter @workspace/api-server exec tsc --noEmit` passes
- `pnpm --filter hypespace exec tsc --noEmit` passes
- `grep -r "campaign-suggestion" artifacts/` finds nothing (deleted dead code is truly gone)
- Manual smoke for all 3 features (rewrite, describe, subject variants) works against a real org with anthropic/openai/gemini/ollama configured
- AI_NOT_CONFIGURED error path shows the same toast as existing `/ai-generate` flow
</verification>

<success_criteria>
- 3 new endpoints exist and follow the exact error envelope pattern of `/campaigns/ai-generate` (AI_NOT_CONFIGURED at 400, AI_*_FAILED at 502 with provider + detail)
- `ai-campaign.ts` has a single shared `callAI` dispatch reused by 4 public functions; no copy-pasted provider switch
- 3 new React components live in `artifacts/hypespace/src/components/`, use generated React Query hooks, use existing shadcn/ui primitives, and toast on AI_NOT_CONFIGURED
- 5 consumer pages wired (campaign-ai, campaign-edit [×2: rewrite + subject variants], event-setup, event-edit, event-creation-modal)
- `campaign-suggestions.ts` and `campaign-suggestion-list.tsx` are deleted from disk
- Full workspace typecheck is green
- Atomic commits per task (5 commits total) — each task is independently committable
</success_criteria>

<output>
After completion, create `.planning/quick/260418-pnc-ai-editing-suite-real-ai-rewrite-endpoin/260418-pnc-SUMMARY.md` describing:
- Endpoints added (paths, error codes)
- Helper functions added to ai-campaign.ts
- Components added + which pages consume each
- Files deleted
- Manual smoke test results per feature
- Any deviations from the plan (and why)
</output>
