import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

export function isAiAvailable(): boolean {
  return !!ANTHROPIC_API_KEY;
}

export async function generateCampaignWithAI(input: CampaignInput): Promise<CampaignOutput> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `You are an expert email marketing copywriter for event management. Generate a professional, visually appealing HTML email campaign.

EVENT DETAILS:
- Title: ${input.eventTitle}
- Date: ${input.eventDate || "TBD"}
- Time: ${input.eventTime || "TBD"}
- Location: ${input.eventLocation || "TBD"}
- Type: ${input.eventType || "in-person"}
- Description: ${input.eventDescription || "No description provided"}

CAMPAIGN TYPE: ${input.campaignType} (${
    input.campaignType === "invitation" ? "Initial invite to attend the event" :
    input.campaignType === "reminder" ? "Reminder for people who already know about it" :
    input.campaignType === "followup" ? "Thank you / follow-up after the event" :
    input.campaignType === "announcement" ? "First announcement that the event exists" :
    "Custom communication about the event"
  })
TONE: ${input.tone}
RSVP/CTA URL: ${input.rsvpUrl}
ORGANIZATION: ${input.orgName || "HypeSpace Events"}
${input.additionalContext ? `ADDITIONAL CONTEXT: ${input.additionalContext}` : ""}

Generate a complete HTML email with these requirements:
1. Responsive, mobile-friendly HTML email (600px max width, inline CSS only)
2. Professional gradient header (use #7C3AED purple and #F97316 orange as brand colors)
3. Clear event details section with date, time, location
4. Compelling body copy matching the tone and campaign type
5. Prominent CTA button linking to ${input.rsvpUrl}
6. Clean footer with unsubscribe link placeholder
7. The email should look polished and modern — use rounded corners, subtle shadows, good typography

Return your response as JSON with this exact structure (no markdown, just raw JSON):
{
  "subject": "The email subject line",
  "htmlContent": "The complete HTML email",
  "textContent": "Plain text version of the email",
  "suggestions": ["suggestion 1 for improvement", "suggestion 2", "suggestion 3"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Parse JSON from response (handle potential markdown wrapping)
  let cleaned = responseText.trim();
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
