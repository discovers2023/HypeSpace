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

function parseAiResponse(text: string): CampaignOutput {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const result = JSON.parse(cleaned) as CampaignOutput;
  if (!result.subject || !result.htmlContent) {
    throw new Error("AI response missing required fields");
  }
  return result;
}

async function generateWithAnthropic(config: AiConfig, input: CampaignInput): Promise<CampaignOutput> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const message = await client.messages.create({
    model: config.model || "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });
  const responseText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("");
  return parseAiResponse(responseText);
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

async function generateWithOpenAICompatible(config: AiConfig, input: CampaignInput): Promise<CampaignOutput> {
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
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`AI provider error (${res.status}) with model "${resolvedModel}": ${err.slice(0, 500)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const responseText = data.choices?.[0]?.message?.content ?? "";
  return parseAiResponse(responseText);
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
  // Use org-level config if available, fall back to system env
  const effectiveConfig: AiConfig = config && config.provider !== "none" && (config.apiKey || config.provider === "ollama")
    ? config
    : { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY ?? "" };

  if (effectiveConfig.provider !== "ollama" && !effectiveConfig.apiKey) {
    throw new AiGenerationError(effectiveConfig.provider || "unknown", "No AI API key configured");
  }

  try {
    switch (effectiveConfig.provider) {
      case "anthropic":
        return await generateWithAnthropic(effectiveConfig, input);
      case "openai":
      case "gemini":
      case "ollama":
        return await generateWithOpenAICompatible(effectiveConfig, input);
      default:
        throw new Error(`Unsupported AI provider: ${effectiveConfig.provider}`);
    }
  } catch (err) {
    // Preserve AiGenerationError if already thrown; otherwise wrap
    if (err instanceof AiGenerationError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new AiGenerationError(effectiveConfig.provider, detail);
  }
}
