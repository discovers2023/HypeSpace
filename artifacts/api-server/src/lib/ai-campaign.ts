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
  additionalContext?: string;
  rsvpUrl: string;
  orgName?: string;
}

interface CampaignOutput {
  subject: string;
  htmlContent: string;
  textContent: string;
  suggestions: string[];
}

const SYSTEM_PROMPT = `You are an expert email marketing copywriter for event management. You generate professional, visually appealing HTML email campaigns. Always return valid JSON only — no markdown, no code fences.`;

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

Requirements:
1. Responsive HTML email (600px max, inline CSS only)
2. Gradient header using #7C3AED (purple) and #F97316 (orange) brand colors
3. Event details section with date, time, location
4. Compelling body copy matching tone and campaign type
5. Prominent CTA button linking to the RSVP URL
6. Footer with unsubscribe placeholder
7. Modern design — rounded corners, subtle shadows, good typography

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

async function generateWithOpenAICompatible(config: AiConfig, input: CampaignInput): Promise<CampaignOutput> {
  // Works with OpenAI, Gemini (via OpenAI compat), Ollama, and any OpenAI-compatible API
  const baseUrl = config.baseUrl || (
    config.provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/openai" :
    config.provider === "ollama" ? "http://localhost:11434/v1" :
    "https://api.openai.com/v1"
  );
  const model = config.model || (
    config.provider === "gemini" ? "gemini-2.0-flash" :
    config.provider === "ollama" ? "llama3" :
    "gpt-4o"
  );

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI provider error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const responseText = data.choices?.[0]?.message?.content ?? "";
  return parseAiResponse(responseText);
}

export function isAiAvailable(config?: AiConfig | null): boolean {
  if (config && config.provider !== "none" && config.apiKey) return true;
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateCampaignWithAI(input: CampaignInput, config?: AiConfig | null): Promise<CampaignOutput> {
  // Use org-level config if available, fall back to system env
  const effectiveConfig: AiConfig = config && config.provider !== "none" && config.apiKey
    ? config
    : { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY ?? "" };

  if (!effectiveConfig.apiKey) {
    throw new Error("No AI API key configured");
  }

  switch (effectiveConfig.provider) {
    case "anthropic":
      return generateWithAnthropic(effectiveConfig, input);
    case "openai":
    case "gemini":
    case "ollama":
      return generateWithOpenAICompatible(effectiveConfig, input);
    default:
      throw new Error(`Unsupported AI provider: ${effectiveConfig.provider}`);
  }
}
