import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface AiImageConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface CampaignImageInput {
  eventTitle: string;
  eventType?: string;
  eventDescription?: string;
  campaignType: string;
  tone: string;
  additionalContext?: string | null;
  orgId: number;
  stylePrompt?: string;
  config?: AiImageConfig | null;
}

export interface CampaignImageOutput {
  imageUrl: string;
  generatedBy: "openai" | "gemini" | "stock";
}

// Tiny stopword list — keep small; we only want nouns-ish tokens for Unsplash.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "from", "to", "of", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "this", "that", "these", "those", "your", "our", "their",
  "event", "events", "meeting", "online", "onsite", "hybrid", "invitation", "reminder",
  "followup", "announcement", "custom", "professional", "friendly", "formal", "casual", "urgent",
  "about", "please", "thanks", "thank", "you", "we", "us", "join", "hosted", "welcome",
]);

function extractKeywords(input: CampaignImageInput): string[] {
  const blob = `${input.eventTitle} ${input.eventType ?? ""} ${input.eventDescription ?? ""}`.toLowerCase();
  const tokens = blob.split(/[^a-z0-9]+/).filter((t) => t.length > 4 && !STOPWORDS.has(t));
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); unique.push(t); }
    if (unique.length >= 3) break;
  }
  if (unique.length === 0 && input.eventType) unique.push(input.eventType);
  if (unique.length === 0) { unique.push("conference"); unique.push("people"); }
  return unique;
}

function unsplashUrl(input: CampaignImageInput): string {
  const keywords = extractKeywords(input).join(",");
  return `https://source.unsplash.com/1200x630/?${encodeURIComponent(keywords)}`;
}

function buildImagePrompt(input: CampaignImageInput): string {
  const stylePrompt = input.stylePrompt ?? "modern editorial marketing photography, cinematic, warm lighting, inviting, no text, no watermark";
  const desc = input.eventDescription ? ` Event context: ${input.eventDescription.slice(0, 200)}.` : "";
  return `Hero banner image for an event email. Event: "${input.eventTitle}". Type: ${input.eventType ?? "in-person"}. Tone: ${input.tone}.${desc} Style: ${stylePrompt}. 16:9 aspect, high quality, no typography in the image.`;
}

async function writeImageToDisk(base64: string): Promise<string> {
  // Resolve dir relative to process.cwd() — the api-server starts from artifacts/api-server/
  const publicDir = path.resolve(process.cwd(), "public", "campaign-images");
  await mkdir(publicDir, { recursive: true });
  const filename = `${randomUUID()}.png`;
  const fullPath = path.join(publicDir, filename);
  await writeFile(fullPath, Buffer.from(base64, "base64"));
  return `/campaign-images/${filename}`;
}

async function generateOpenAiImage(config: AiImageConfig, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "high",
      n: 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI image error (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image API returned no b64_json");
  return writeImageToDisk(b64);
}

async function generateGeminiImage(config: AiImageConfig, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${encodeURIComponent(config.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "16:9" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini image error (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string }> };
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error("Gemini image API returned no bytesBase64Encoded");
  return writeImageToDisk(b64);
}

export async function generateCampaignImage(input: CampaignImageInput): Promise<CampaignImageOutput> {
  const provider = input.config?.provider ?? "none";
  const apiKey = input.config?.apiKey ?? "";
  const prompt = buildImagePrompt(input);

  // Only OpenAI and Gemini support native image generation. Anthropic/Ollama/none → Unsplash fallback.
  if (provider === "openai" && apiKey) {
    const imageUrl = await generateOpenAiImage(input.config!, prompt);
    return { imageUrl, generatedBy: "openai" };
  }
  if (provider === "gemini" && apiKey) {
    const imageUrl = await generateGeminiImage(input.config!, prompt);
    return { imageUrl, generatedBy: "gemini" };
  }
  return { imageUrl: unsplashUrl(input), generatedBy: "stock" };
}
