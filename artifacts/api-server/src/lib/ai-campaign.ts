import Anthropic from "@anthropic-ai/sdk";

interface AiConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface CampaignInput {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventType: string;
  eventDescription: string;
  campaignType: string;
  tone: string;
  additionalContext?: string | null;
  rsvpUrl: string;
  orgName?: string;
}

interface CampaignOutput {
  subject: string;
  htmlContent: string;
  textContent: string;
  suggestions: string[];
}

export class AiGenerationError extends Error {
  public provider: string;
  public detail: string;
  constructor(provider: string, detail: string) {
    super(`AI generation failed (${provider}): ${detail}`);
    this.provider = provider;
    this.detail = detail;
    this.name = "AiGenerationError";
  }
}

interface AiCallArgs {
  system: string;
  user: string;
  maxTokens?: number;
}

const SYSTEM_PROMPT = `You are an elite email marketing copywriter for event organizers. Your job is to produce HTML email campaigns that feel personal, specific, and written by a human who actually cares about the event. NEVER use generic phrases like "Don't miss out!", "You won't want to miss this", "Join us for an amazing time", or "an unforgettable experience". Reference concrete details from the event description. Vary sentence length. Use one strong, specific hook in the opening sentence. Return ONLY valid JSON — no markdown fences, no prose around it.`;

function buildUserPrompt(input: CampaignInput): string {
  return `Generate a professional HTML email campaign.

EVENT DETAILS:
- Title: ${input.eventTitle}
- Date: ${input.eventDate || "TBD"}
- Time: ${input.eventTime || "TBD"}
- Location: ${input.eventLocation || "TBD"}
- Type: ${input.eventType || "in-person"}
- Description: ${input.eventDescription || "No description provided"}

CAMPAIGN TYPE: ${input.campaignType} (${
    input.campaignType === "invitation" ? "Initial invite to attend" :
    input.campaignType === "reminder" ? "Reminder for registered attendees" :
    input.campaignType === "followup" ? "Thank you / post-event follow-up" :
    input.campaignType === "announcement" ? "First announcement" :
    "Custom communication"
  })
TONE: ${input.tone}
RSVP/CTA URL: ${input.rsvpUrl}
ORGANIZATION: ${input.orgName || "HypeSpace Events"}
${input.additionalContext ? `ADDITIONAL CONTEXT: ${input.additionalContext}` : ""}

Writing rules (follow strictly):
1. Open with a specific hook that references the event topic or description — NOT "Dear attendee", NOT "We are pleased". The first sentence should quote or paraphrase a concrete detail from the event description.
2. If the event description is non-empty, weave at least 3 concrete details from it into the body copy.
3. Vary sentence length. Mix short punchy sentences (4–8 words) with longer ones. Never more than two sentences of similar length in a row.
4. Banned phrases: "don't miss out", "you won't want to miss", "an amazing time", "unforgettable experience", "join us for", "we are pleased to", "cordially invited", "exciting opportunity".
5. Keep the HTML inline-styled and 600px max width. Use a single table-based layout for email-client compatibility.
6. Header gradient: #7C3AED (purple) and #F97316 (orange). Footer: unsubscribe placeholder.
7. Single prominent CTA button linking to ${input.rsvpUrl}.

Return ONLY raw JSON (no markdown fences):
{"subject":"...","htmlContent":"...","textContent":"...","suggestions":["...","...","..."]}`;
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function parseAiResponse(text: string): CampaignOutput {
  const cleaned = stripCodeFences(text);
  const result = JSON.parse(cleaned) as CampaignOutput;
  if (!result.subject || !result.htmlContent) {
    throw new Error("AI response missing required fields");
  }
  return result;
}

async function callAnthropic(config: AiConfig, args: AiCallArgs): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const message = await client.messages.create({
    model: config.model || "claude-sonnet-4-20250514",
    max_tokens: args.maxTokens ?? 4096,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("");
}

/**
 * Ollama exposes /api/tags (NOT under /v1) listing installed models.
 * Returns the first model name, or throws if none installed.
 */
async function detectOllamaModel(baseUrl: string): Promise<string> {
  // Strip trailing /v1 or /v1/ if present — /api/tags lives at the Ollama root
  const ollamaRoot = baseUrl.replace(/\/v1\/?$/, "");
  const tagsUrl = `${ollamaRoot}/api/tags`;
  let res: Response;
  try {
    res = await fetch(tagsUrl);
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${ollamaRoot} — is Ollama running? (${err instanceof Error ? err.message : String(err)})`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama /api/tags returned ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json() as { models?: Array<{ name?: string }> };
  const models = data.models ?? [];
  if (models.length === 0 || !models[0]?.name) {
    throw new Error("No Ollama models installed — run 'ollama pull gemma2' or set a specific model in Settings");
  }
  return models[0].name;
}

async function callOpenAICompatible(config: AiConfig, args: AiCallArgs): Promise<string> {
  // Works with OpenAI, Gemini (via OpenAI compat), Ollama, and any OpenAI-compatible API
  const baseUrl = config.baseUrl || (
    config.provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/openai" :
    config.provider === "ollama" ? "http://localhost:11434/v1" :
    "https://api.openai.com/v1"
  );

  // Auto-detect Ollama model when none configured
  let resolvedModel: string;
  if (config.model && config.model.trim() !== "") {
    resolvedModel = config.model;
  } else if (config.provider === "ollama") {
    const ollamaRoot = config.baseUrl || "http://localhost:11434";
    resolvedModel = await detectOllamaModel(ollamaRoot);
  } else if (config.provider === "gemini") {
    resolvedModel = "gemini-2.0-flash";
  } else {
    resolvedModel = "gpt-4o";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: args.maxTokens ?? 4096,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`AI provider error (${res.status}) with model "${resolvedModel}": ${err.slice(0, 500)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAI(config: AiConfig, args: AiCallArgs): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config, args);
    case "openai":
    case "gemini":
    case "ollama":
      return callOpenAICompatible(config, args);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

function resolveEffectiveConfig(config?: AiConfig | null): AiConfig {
  return config && config.provider !== "none" && (config.apiKey || config.provider === "ollama")
    ? config
    : { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY ?? "" };
}

function ensureKey(config: AiConfig): void {
  if (config.provider !== "ollama" && !config.apiKey) {
    throw new AiGenerationError(config.provider || "unknown", "No AI API key configured");
  }
}

export function isAiAvailable(config?: AiConfig | null): boolean {
  if (config && config.provider !== "none") {
    // Ollama doesn't require an API key — it's a local daemon
    if (config.provider === "ollama") return true;
    if (config.apiKey) return true;
  }
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateCampaignWithAI(input: CampaignInput, config?: AiConfig | null): Promise<CampaignOutput> {
  const effectiveConfig = resolveEffectiveConfig(config);
  ensureKey(effectiveConfig);

  try {
    const text = await callAI(effectiveConfig, {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input),
      maxTokens: 4096,
    });
    return parseAiResponse(text);
  } catch (err) {
    if (err instanceof AiGenerationError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new AiGenerationError(effectiveConfig.provider, detail);
  }
}

// ─── Rewrite ────────────────────────────────────────────────────────────────

export interface RewriteInput {
  html: string;
  subject: string;
  instruction: string;
  eventTitle?: string;
}
export interface RewriteOutput {
  html: string;
  subject: string;
}

const REWRITE_SYSTEM = `You are an email-HTML editor. You receive an existing HTML email and a user instruction. Apply the instruction while preserving the table-based 600px layout, inline styles, and any tracking placeholders. Return ONLY raw JSON: {"html":"...","subject":"..."}.`;

export async function rewriteHtmlWithAI(input: RewriteInput, config?: AiConfig | null): Promise<RewriteOutput> {
  const effectiveConfig = resolveEffectiveConfig(config);
  ensureKey(effectiveConfig);

  const user = `INSTRUCTION:
${input.instruction}

CURRENT SUBJECT:
${input.subject}

CURRENT HTML:
${input.html}

Return ONLY raw JSON (no markdown fences):
{"html":"...","subject":"..."}`;

  try {
    const text = await callAI(effectiveConfig, { system: REWRITE_SYSTEM, user, maxTokens: 4096 });
    const cleaned = stripCodeFences(text);
    const result = JSON.parse(cleaned) as Partial<RewriteOutput>;
    if (!result.html || !result.subject) {
      throw new Error("AI response missing required fields");
    }
    return { html: result.html, subject: result.subject };
  } catch (err) {
    if (err instanceof AiGenerationError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new AiGenerationError(effectiveConfig.provider, detail);
  }
}

// ─── Describe ───────────────────────────────────────────────────────────────

export interface DescribeEventInput {
  title: string;
  type?: string | null;
  category?: string | null;
  location?: string | null;
  additionalContext?: string | null;
}

const DESCRIBE_SYSTEM = `You write concise, specific event descriptions for invitation pages. 2–4 sentences. No clichés. No "don't miss out", "unforgettable", "join us for". Return ONLY raw JSON: {"description":"..."}.`;

export async function describeEventWithAI(input: DescribeEventInput, config?: AiConfig | null): Promise<{ description: string }> {
  const effectiveConfig = resolveEffectiveConfig(config);
  ensureKey(effectiveConfig);

  const lines: string[] = [`TITLE: ${input.title}`];
  if (input.type) lines.push(`TYPE: ${input.type}`);
  if (input.category) lines.push(`CATEGORY: ${input.category}`);
  if (input.location) lines.push(`LOCATION: ${input.location}`);
  if (input.additionalContext) lines.push(`ADDITIONAL CONTEXT: ${input.additionalContext}`);
  const user = `${lines.join("\n")}

Return ONLY raw JSON (no markdown fences):
{"description":"..."}`;

  try {
    const text = await callAI(effectiveConfig, { system: DESCRIBE_SYSTEM, user, maxTokens: 1024 });
    const cleaned = stripCodeFences(text);
    const result = JSON.parse(cleaned) as { description?: string };
    if (!result.description) {
      throw new Error("AI response missing required fields");
    }
    return { description: result.description };
  } catch (err) {
    if (err instanceof AiGenerationError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new AiGenerationError(effectiveConfig.provider, detail);
  }
}

// ─── Subject Variants ───────────────────────────────────────────────────────

export interface SubjectVariantsInput {
  campaignType: string;
  eventTitle: string;
  tone?: string | null;
  currentSubject?: string | null;
}

const SUBJECT_VARIANTS_SYSTEM = `You write email subject lines. Punchy, specific, under 60 characters. Vary style across the 5 variants (curiosity, urgency, benefit, question, statement). No emojis unless the tone is casual. Return ONLY raw JSON: {"variants":["...","...","...","...","..."]}.`;

export async function generateSubjectVariantsWithAI(input: SubjectVariantsInput, config?: AiConfig | null): Promise<{ variants: string[] }> {
  const effectiveConfig = resolveEffectiveConfig(config);
  ensureKey(effectiveConfig);

  const lines: string[] = [
    `CAMPAIGN TYPE: ${input.campaignType}`,
    `EVENT TITLE: ${input.eventTitle}`,
  ];
  if (input.tone) lines.push(`TONE: ${input.tone}`);
  if (input.currentSubject) lines.push(`CURRENT SUBJECT: ${input.currentSubject}`);
  const user = `${lines.join("\n")}

Return ONLY raw JSON (no markdown fences):
{"variants":["...","...","...","...","..."]}`;

  try {
    const text = await callAI(effectiveConfig, { system: SUBJECT_VARIANTS_SYSTEM, user, maxTokens: 1024 });
    const cleaned = stripCodeFences(text);
    const result = JSON.parse(cleaned) as { variants?: string[] };
    if (!Array.isArray(result.variants) || result.variants.length === 0) {
      throw new Error("AI response missing required fields");
    }
    return { variants: result.variants };
  } catch (err) {
    if (err instanceof AiGenerationError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new AiGenerationError(effectiveConfig.provider, detail);
  }
}
