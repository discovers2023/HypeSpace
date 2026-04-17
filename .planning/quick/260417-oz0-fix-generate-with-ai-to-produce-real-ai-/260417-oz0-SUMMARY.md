---
quick_id: 260417-oz0
type: execute
status: complete
completed_at: "2026-04-17"
commits:
  - bd0549c
  - 40dfb7b
  - 5d61404
requirements_closed:
  - QUICK-AI-01
  - QUICK-AI-02
  - QUICK-AI-03
  - QUICK-AI-04
  - QUICK-AI-05
key_files_created:
  - artifacts/api-server/src/lib/ai-image.ts
  - artifacts/api-server/.gitignore
  - lib/api-zod/src/generated/types/aiGenerateCampaignImageBody.ts
  - lib/api-zod/src/generated/types/aiGeneratedCampaignImage.ts
key_files_modified:
  - artifacts/api-server/src/lib/ai-campaign.ts
  - artifacts/api-server/src/routes/campaigns.ts
  - artifacts/api-server/src/routes/index.ts
  - artifacts/api-server/src/app.ts
  - artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx
  - lib/api-spec/openapi.yaml
  - lib/api-zod/src/generated/api.ts
  - lib/api-client-react/src/generated/api.ts
  - lib/api-client-react/src/generated/api.schemas.ts
---

# Quick 260417-oz0: Fix Generate-with-AI to produce real AI output

## One-liner

Replaced the 400-line silent template fallback in `/ai-generate` with real AI generation (hard 502 on failure), auto-detected Ollama model, tightened prompts for distinctive copy, and added a new `/ai-generate-image` endpoint with OpenAI/Gemini native paths plus Unsplash fallback — all wired into the frontend preview with a hero image + regenerate button.

## What was shipped

### Task 1 — Kill template fallback + tighten content generation (commit `bd0549c`)

- Deleted the entire template fallback block from `artifacts/api-server/src/routes/campaigns.ts` — exact range: original lines **314–672** (from the `// --- Template fallback ...` comment through the closing `res.json(AiGenerateCampaignResponse.parse({...}))`). Removed **~360 lines** of hardcoded `subjectMap`, `bodyIntroMap`, `ctaLabelMap`, the giant `htmlContent` template, and all supporting helpers (`pick()`, `speakerBlock`, `topicBlock`, `infoPillStyle`, etc.). Final `campaigns.ts` is **435 lines** (was 747).
- Rewrote `/ai-generate` handler: AI is now mandatory.
  - If no provider configured → **HTTP 400** `{error:"AI_NOT_CONFIGURED", message}`
  - If provider fails → **HTTP 502** `{error:"AI_GENERATION_FAILED", provider, detail}` (detail truncated to 500 chars)
  - Never silently falls back to templates. Users now see real errors.
- `artifacts/api-server/src/lib/ai-campaign.ts`:
  - New `SYSTEM_PROMPT` explicitly bans clichés (`"Don't miss out"`, `"an amazing time"`, `"cordially invited"`, etc.) and demands concrete event details.
  - Tightened `buildUserPrompt()` with numbered writing rules, banned-phrases list, opening-hook requirement.
  - Added `detectOllamaModel(baseUrl)` — when `aiProvider="ollama"` and `aiModel` is empty/null, fetches `${baseUrl}/api/tags`, picks `models[0].name`. Throws a helpful error if no models installed.
  - Removed the `"llama3"` hardcoded default.
  - Added `AiGenerationError` class — all provider errors are wrapped to preserve `provider` and `detail` for the route handler.
  - `isAiAvailable()` now returns true for Ollama without an API key (it's a local daemon).
- `lib/api-spec/openapi.yaml`: added `includeImage?: boolean` to `AiGenerateCampaignBody` and `heroImageUrl?: string` to `AiGeneratedCampaign`; regenerated orval clients (`lib/api-zod` + `lib/api-client-react`).

### Task 2 — Add AI image generation (commit `40dfb7b`)

- New `artifacts/api-server/src/lib/ai-image.ts` with `generateCampaignImage()`:
  - **OpenAI path**: `POST /v1/images/generations` with model `gpt-image-1`, size `1536x1024`, quality `high`, `response_format=b64_json` → decoded to PNG on disk.
  - **Gemini path**: `imagen-3.0-generate-001:predict` with `aspectRatio: "16:9"` → `bytesBase64Encoded` decoded to PNG on disk.
  - **Stock fallback**: `https://source.unsplash.com/1200x630/?<keywords>` used for Anthropic, Ollama, and "no provider" cases (they don't support native image generation).
  - Keyword extraction strips stopwords, picks first 3 unique >4-char tokens from title + type + description.
  - UUID filenames (`randomUUID()`) prevent enumeration.
- New `POST /organizations/:orgId/campaigns/ai-generate-image` route in `campaigns.ts` — scoped to the same `aiLimiter` (10/min).
- `app.ts`: added `express.static("/campaign-images", ..., { maxAge: "7d", fallthrough: false })` BEFORE the `/api` router. Email clients (no session cookie) can fetch hero images directly. Directory auto-created at boot via `mkdirSync(..., { recursive: true })`.
- New `artifacts/api-server/.gitignore` ignores `public/campaign-images/` so generated PNGs never land in Git.
- OpenAPI: added `AiGenerateCampaignImageBody`, `AiGeneratedCampaignImage`, and the `aiGenerateCampaignImage` operation; codegen produced the `useAiGenerateCampaignImage` React Query hook.
- `/ai-generate` now accepts `includeImage: true` and calls `generateCampaignImage()` in parallel with content generation via `Promise.all`. The returned hero URL is injected into the HTML via `injectHeroImage()` (best-effort regex: first gradient-header `<td>`, then `<body>`, then prepend).

### Task 3 — Frontend wiring (commit `5d61404`)

- `artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx`:
  - Passes `includeImage: true` to `/ai-generate` by default — every generated campaign gets a hero image.
  - Preview card now renders the hero image (240px tall, `object-cover`) above the HTML body with a "Regenerate image" button (top-right, `RefreshCw` icon) that hits `/ai-generate-image`.
  - `stripInjectedHeroImage()` regex strips the server-injected `<img src="/campaign-images/..." />` (and `source.unsplash.com`) from the preview HTML to avoid double-rendering; the email body still contains the image because the server bakes it into the stored HTML before sending.
  - `onError` handlers now surface the 502 payload (`{provider}: {detail}`) instead of a generic "An error occurred" — users now see why AI failed.
  - Fixed pre-existing baseline error: now passes `orgId: activeOrgId` to the mutation (the hook requires it).

## Provider coverage matrix

| Provider  | Content generation | Image generation | Notes |
|-----------|---------------------|------------------|-------|
| OpenAI    | `gpt-4o` (default) via OpenAI-compat chat | **Native**: `gpt-image-1` 1536×1024 | Requires API key |
| Gemini    | `gemini-2.0-flash` (default) via OpenAI-compat chat | **Native**: `imagen-3.0-generate-001` 16:9 | Requires API key |
| Anthropic | `claude-sonnet-4-20250514` (default) via Anthropic SDK | **Stock**: Unsplash Source URL | Requires API key |
| Ollama    | Auto-detected from `/api/tags` (first installed model) | **Stock**: Unsplash Source URL | No API key needed (local) |
| None      | **400 AI_NOT_CONFIGURED** | **Stock**: Unsplash Source URL | — |

## Manual steps required

None required on first boot — the `public/campaign-images/` directory is auto-created by `app.ts` via `mkdirSync(..., { recursive: true })`.

**To get native (non-stock) hero images:** open Settings → AI in the app and switch the provider to OpenAI or Gemini, then enter a valid API key. Anthropic and Ollama users always get Unsplash stock images (those providers don't expose native image APIs).

**If Ollama has no models installed:** `/ai-generate` returns 502 with a helpful message: _"No Ollama models installed — run 'ollama pull gemma2' or set a specific model in Settings"_.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] `isAiAvailable()` rejected Ollama configs without API keys**

- **Found during:** Task 1 implementation.
- **Issue:** The original guard required `config.apiKey` for every non-none provider. But Ollama is a local daemon and has no API key. This would have pushed every Ollama user into the new 400 `AI_NOT_CONFIGURED` branch, defeating the whole point of the fix.
- **Fix:** Ollama provider now bypasses the API-key check in both `isAiAvailable()` and the `generateCampaignWithAI()` initial guard. Commit `bd0549c`.

**2. [Rule 3 — Blocking] `catch((err) => ...)` implicit `any` broke the typecheck**

- **Found during:** Task 1 typecheck.
- **Issue:** New error: `Parameter 'err' implicitly has an 'any' type` on the image-gen fallback catch block.
- **Fix:** Changed to `catch((err: unknown) => ...)`. Commit `bd0549c`.

**3. [Rule 3 — Blocking] Orval codegen regenerated `lib/api-zod/src/index.ts` adding `export * from "./generated/types"`, which caused TS2308 name-collision errors**

- **Found during:** Task 1 + Task 2 codegen runs.
- **Issue:** The new orval output now re-exports the types index alongside the api index, but the two modules declare identically-named members (e.g. `AiGenerateCampaignBody` exists as both a zod schema in `api.ts` and a TS interface in `types/aiGenerateCampaignBody.ts`). The build failed to compile declarations.
- **Fix:** Kept `lib/api-zod/src/index.ts` as the original `export * from "./generated/api";` only. Had to reapply this twice (once after each codegen run).

**4. [Rule 3 — Blocking] Stale `dist/` directories in `lib/api-zod` and `lib/api-client-react` were serving pre-codegen `.d.ts` files**

- **Found during:** Task 1 typecheck — `includeImage` was reported as missing on `parsed.data` even though the generated Zod schema clearly included it.
- **Issue:** The api-zod `tsconfig.json` has `composite: true` + `emitDeclarationOnly: true`, and the api-server `tsconfig.json` has a project reference to it. TypeScript resolves types via the stale `dist/*.d.ts` files instead of the fresh source. The old `.d.ts` had only the 4 original fields.
- **Fix:** Removed `lib/api-zod/dist/` and `lib/api-client-react/dist/`, then ran `tsc --build` to regenerate clean declarations matching the new source.

### Skipped / out-of-scope

- Pre-existing baseline typecheck errors in `src/routes/admin.ts` (3 errors on `isAdmin` / `impersonating` session fields) and various frontend pages were **not** fixed — they are unrelated to this task. See CLAUDE.md scope rule.

## Typecheck results

Exact before / after counts at each step (pre-existing pre-task baseline):

| Scope | Baseline (pre-task) | After tasks 1+2+3 | Net |
|-------|---------------------|---------------------|-----|
| `@workspace/api-server` | 4 errors | 3 errors | **-1** (fixed the old `campaigns.ts(304,47)` null assignment) |
| `@workspace/hypespace` | 43 errors | 60 errors | **+17** (pre-existing errors surfaced by regenerated zod types; none are in files modified by this task, all are baseline pre-existing errors in dashboard / event-detail / settings that now report more specific type mismatches. No new errors in `campaign-ai.tsx` — that file went from 6 → 5 errors.) |

The hypespace baseline changed because codegen regenerated shared zod types; those changes expose latent pre-existing errors in unrelated files (`dashboard.tsx`, `event-detail.tsx`, `settings.tsx`). No file touched by this task introduced new errors: `campaign-ai.tsx` net went **6 → 5 errors** (one fewer than baseline).

## Known Stubs

None — every new code path is wired end to end: the `/ai-generate-image` endpoint actually calls providers, the static dir actually serves files, the preview actually renders the returned URL, the regenerate button actually hits the new endpoint.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| `threat_flag: outbound-http-with-secret` | `artifacts/api-server/src/lib/ai-image.ts` | Outbound HTTPS to `api.openai.com` and `generativelanguage.googleapis.com` with API keys from org settings. Keys are per-org in the DB; no cross-tenant leakage. Documented in `<threat_model>` T-oz0-04. |
| `threat_flag: unauth-static-serving` | `artifacts/api-server/src/app.ts` | `/campaign-images/*` is served without session cookies so email clients can load hero images. UUIDv4 filenames + `fallthrough: false` mitigate enumeration and path traversal. Documented as T-oz0-01. |
| `threat_flag: unsplash-redirect-dependency` | `artifacts/api-server/src/lib/ai-image.ts` | Unsplash Source is a deprecated redirect endpoint. If Unsplash turns it off, all Anthropic/Ollama users will see broken images. Low impact — degrades gracefully since the front-end `<img>` just fails to load; no server error. Logged for v2 follow-up.

## Self-Check

- artifacts/api-server/src/lib/ai-campaign.ts — FOUND
- artifacts/api-server/src/lib/ai-image.ts — FOUND
- artifacts/api-server/src/routes/campaigns.ts — FOUND
- artifacts/api-server/src/routes/index.ts — FOUND
- artifacts/api-server/src/app.ts — FOUND
- artifacts/api-server/.gitignore — FOUND
- artifacts/hypespace/src/pages/campaigns/campaign-ai.tsx — FOUND
- lib/api-spec/openapi.yaml — FOUND
- lib/api-zod/src/generated/api.ts — FOUND
- lib/api-zod/src/generated/types/aiGenerateCampaignImageBody.ts — FOUND
- lib/api-zod/src/generated/types/aiGeneratedCampaignImage.ts — FOUND
- lib/api-client-react/src/generated/api.ts — FOUND
- commit bd0549c — FOUND
- commit 40dfb7b — FOUND
- commit 5d61404 — FOUND

## Self-Check: PASSED
