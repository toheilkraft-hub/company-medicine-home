/**
 * MockProvider — a fully functional mock AI provider.
 *
 * Returns realistic, context-aware responses and simulates streaming.
 * Used when no real API key is configured.
 *
 * ── Replace with a real provider by: ─────────────────────────────────────────
 *   1. Implementing IProvider for your chosen LLM.
 *   2. Registering it in ProviderFactory.ts.
 *   3. Setting the provider + API key in Settings.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IProvider } from "./IProvider.js";
import type {
  AIMessage,
  AIResponse,
  GenerateOptions,
  ItemAnalysisResult,
  ModelInfo,
} from "../../shared/types.js";

const MOCK_MODELS: ModelInfo[] = [
  {
    id: "mock-standard",
    name: "Mock Standard",
    description: "Simulated AI responses for development and testing",
    maxTokens: 4096,
    supportsStreaming: true,
    provider: "mock",
  },
  {
    id: "mock-fast",
    name: "Mock Fast",
    description: "Faster mock responses with shorter output",
    maxTokens: 2048,
    supportsStreaming: true,
    provider: "mock",
  },
];

// Contextual response templates
const RESPONSE_LIBRARY: Record<string, string> = {
  greeting:
    "Hello! I'm iHeal AI, currently running in **mock mode**. I can simulate realistic AI conversations — once you add a real API key (e.g. Google Gemini) in Settings, I'll use that provider instead.\n\nHow can I help you today?",

  code: `Here's an example implementation:

\`\`\`typescript
interface AIProvider {
  generateResponse(messages: Message[]): Promise<string>;
  generateStream(messages: Message[]): AsyncGenerator<string>;
}

class GeminiProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async generateResponse(messages: Message[]): Promise<string> {
    // TODO: Replace with actual Gemini SDK call
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(messages);
    return result.response.text();
  }
}
\`\`\`

This is the pattern used in \`server/providers/GeminiProvider.ts\`. Once you add your Gemini API key in Settings, the real implementation will activate automatically.`,

  explain: `Great question! Here's how it works:

The iHeal AI architecture uses a **provider abstraction layer** that decouples the application from any specific AI model:

1. **IProvider interface** — defines the contract: \`generateResponse()\`, \`generateStream()\`, \`summarize()\`, \`classifyIntent()\`
2. **ProviderFactory** — reads your Settings and instantiates the correct provider
3. **Concrete providers** — MockProvider (active now), GeminiProvider, OpenAIProvider (stubs)

This means you can switch from mock → Gemini by:
- Going to Settings
- Selecting "Google Gemini" as the provider
- Entering your API key

No other code changes are needed.`,

  default: `I understand your question. As a mock AI provider, I'm demonstrating how the iHeal AI platform will respond once a real language model is connected.

The platform supports:
- **Streaming responses** — text appears word by word (active now)
- **Conversation history** — full context is sent with each message
- **System prompts** — customise my personality and knowledge scope
- **Model selection** — choose between provider models
- **Provider switching** — swap Gemini, OpenAI, or Anthropic via Settings

To get real AI responses, add your API key in **Settings → AI Provider**.`,
};

function selectResponse(messages: AIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() ?? "";
  if (/^(hi|hello|hey|greetings|howdy)/i.test(last)) return RESPONSE_LIBRARY.greeting;
  if (/code|implement|function|class|typescript|javascript|python/.test(last))
    return RESPONSE_LIBRARY.code;
  if (/how|explain|what is|why|describe/.test(last)) return RESPONSE_LIBRARY.explain;
  return RESPONSE_LIBRARY.default;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class MockProvider implements IProvider {
  readonly id = "mock";
  readonly name = "Mock Provider";

  isConfigured(): boolean {
    return true; // mock is always available
  }

  async generateResponse(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): Promise<AIResponse> {
    const start = Date.now();
    await sleep(400 + Math.random() * 400);

    const content = this.buildResponse(messages, options);
    return {
      content,
      model: options.model ?? "mock-standard",
      provider: "mock",
      tokensUsed: Math.ceil(content.length / 4),
      promptTokens: Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4),
      completionTokens: Math.ceil(content.length / 4),
      latencyMs: Date.now() - start,
      finishReason: "stop",
    };
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    const start = Date.now();
    const full = this.buildResponse(messages, options);

    // Split into word-level chunks to simulate realistic streaming
    const words = full.split(/(\s+)/);
    const chunkSize = options.model === "mock-fast" ? 3 : 1;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join("");
      yield chunk;
      await sleep(20 + Math.random() * 40);
    }

    return {
      content: full,
      model: options.model ?? "mock-standard",
      provider: "mock",
      tokensUsed: Math.ceil(full.length / 4),
      promptTokens: Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4),
      completionTokens: Math.ceil(full.length / 4),
      latencyMs: Date.now() - start,
      finishReason: "stop",
    };
  }

  async summarize(text: string, _options: GenerateOptions = {}): Promise<string> {
    await sleep(200);
    const words = text.trim().split(/\s+/);
    return words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
  }

  async classifyIntent(message: string): Promise<string> {
    const lower = message.toLowerCase();
    if (/^(hi|hello|hey)/.test(lower)) return "chat";
    if (/\?|^(what|how|why|when|where|who|can|is|are|do|does)/.test(lower)) return "question";
    if (/^(find|search|look for|get me)/.test(lower)) return "search";
    if (/^(create|make|build|write|generate|do|run)/.test(lower)) return "task";
    return "chat";
  }

  async listModels(): Promise<ModelInfo[]> {
    return MOCK_MODELS;
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    await sleep(300 + Math.random() * 500);

    // Strip HTML tags from content for clean analysis
    const cleanContent = item.content
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const text = `${item.title} ${cleanContent}`.toLowerCase();
    const contentWords = cleanContent.split(/\s+/).filter(Boolean);

    // ── Medical relevance check ───────────────────────────────────────────────
    const MEDICAL_KEYWORDS = [
      "disease", "diagnosis", "diagnose", "treatment", "symptom", "patient",
      "doctor", "medical", "health", "cancer", "therapy", "clinical", "syndrome",
      "disorder", "drug", "medication", "surgery", "hospital", "physician",
      "medicine", "immune", "virus", "bacteria", "infection", "pain", "chronic",
      "acute", "mental health", "depression", "diabetes", "heart", "lung",
      "kidney", "blood", "gene", "cell", "vaccine", "trial", "pharma",
      "neurology", "oncology", "cardiology", "pathology", "anatomy", "genome",
      "prognosis", "biopsy", "prescription", "dosage", "side effect",
      "prevention", "epidemic", "pandemic", "outbreak", "mortality", "morbidity",
      "condition", "ailment", "wellness", "healthcare", "surgical", "nursing",
    ];
    const foundMedical = MEDICAL_KEYWORDS.filter((kw) => text.includes(kw));
    const isMedical = foundMedical.length >= 2;

    // ── SEO Score (0-100) ─────────────────────────────────────────────────────
    let seoScore = 0;

    // Title length quality (0–25 pts)
    const titleLen = item.title.length;
    if (titleLen >= 30 && titleLen <= 70) seoScore += 25;
    else if (titleLen >= 10 && titleLen <= 100) seoScore += 15;
    else if (titleLen > 0) seoScore += 5;

    // Content length (0–30 pts)
    const wordCount = contentWords.length;
    if (wordCount >= 300) seoScore += 30;
    else if (wordCount >= 150) seoScore += 22;
    else if (wordCount >= 80) seoScore += 14;
    else if (wordCount >= 30) seoScore += 8;

    // Medical keyword density (0–25 pts)
    const keywordDensity = foundMedical.length / Math.max(1, wordCount / 100);
    if (keywordDensity >= 5) seoScore += 25;
    else if (keywordDensity >= 3) seoScore += 18;
    else if (keywordDensity >= 1) seoScore += 10;
    else seoScore += 3;

    // Source authority (0–20 pts)
    const srcAuthority =
      item.source === "web" ? 20
      : item.source === "rss" ? 18
      : item.source === "reddit" ? 12
      : 10;
    seoScore += srcAuthority;

    seoScore = Math.min(100, Math.max(0, seoScore));

    // Top SEO keywords (unique medical keywords found, up to 8)
    const seoKeywords = [...new Set(foundMedical)].slice(0, 8);

    // ── Author authority (0-100) ──────────────────────────────────────────────
    let authorAuthority =
      item.source === "web" ? 72
      : item.source === "rss" ? 68
      : item.source === "reddit" ? 42
      : 55;
    authorAuthority += Math.floor((Math.random() - 0.5) * 16);
    authorAuthority = Math.min(100, Math.max(20, authorAuthority));

    // ── Merit: must be medical AND seoScore ≥ 30 ─────────────────────────────
    const meritPassed = isMedical && seoScore >= 30;

    // ── Clean description (first 120 words, no HTML) ──────────────────────────
    const description =
      contentWords.slice(0, 120).join(" ") +
      (contentWords.length > 120 ? "…" : "");

    // ── Industry ─────────────────────────────────────────────────────────────
    let industry = "Healthcare"; // Medical-focused — default to Healthcare
    if (/tech|ai|software|digital|platform|app|data|algorithm|machine learning/.test(text))
      industry = "Health Technology";
    else if (/finance|invest|market|stock|fund|revenue|capital/.test(text))
      industry = "Health Finance";
    else if (/government|policy|regulation|law|legal|compliance|fda|hipaa/.test(text))
      industry = "Health Regulatory";
    else if (/research|study|trial|evidence|clinical|published|journal|nature/.test(text))
      industry = "Medical Research";

    // ── Category ─────────────────────────────────────────────────────────────
    let category = "Medical News";
    if (/research|study|trial|evidence|clinical|published|journal|nature/.test(text))
      category = "Clinical Research";
    else if (/treatment|therapy|drug|medication|prescription|dosage|surgical/.test(text))
      category = "Treatment & Therapy";
    else if (/symptom|diagnosis|diagnose|test|screening|biopsy/.test(text))
      category = "Diagnosis & Symptoms";
    else if (/prevention|vaccine|immunisation|public health|epidemic|pandemic/.test(text))
      category = "Prevention & Public Health";
    else if (/mental|depression|anxiety|psychiatric|psychology|behavioural/.test(text))
      category = "Mental Health";
    else if (/heart|cardio|stroke|blood pressure|cardiovascular/.test(text))
      category = "Cardiology";
    else if (/cancer|oncology|tumour|tumor|chemotherapy|radiation/.test(text))
      category = "Oncology";

    // ── Sentiment ─────────────────────────────────────────────────────────────
    const positiveWords = (text.match(/\b(breakthrough|effective|safe|improved|success|benefit|positive|promising|advance|recover|cure|heal|hope)\b/g) ?? []).length;
    const negativeWords = (text.match(/\b(risk|danger|fatal|severe|critical|concern|failure|problem|complication|death|mortality|adverse)\b/g) ?? []).length;
    let sentiment = "Neutral";
    if (positiveWords > negativeWords + 1) sentiment = "Positive";
    else if (negativeWords > positiveWords + 1) sentiment = "Negative";
    else if (positiveWords > 0 && negativeWords > 0) sentiment = "Mixed";

    // ── Intent ────────────────────────────────────────────────────────────────
    let intent = "Medical Research";
    if (/treatment|therapy|cure|drug|medication|prescription/.test(text))
      intent = "Treatment Information";
    else if (/symptom|diagnose|diagnosis|test|screening/.test(text))
      intent = "Diagnostic Information";
    else if (/prevention|vaccine|immunisation|protect/.test(text))
      intent = "Prevention Advice";
    else if (/study|trial|research|published|journal|findings/.test(text))
      intent = "Research Publication";
    else if (/news|report|article|announce|update/.test(text))
      intent = "Medical News";
    else if (/support|help|assistance|advice/.test(text))
      intent = "Patient Support";

    // ── Priority score ────────────────────────────────────────────────────────
    let base = 55;
    if (intent === "Treatment Information") base = 78;
    else if (intent === "Diagnostic Information") base = 82;
    else if (intent === "Research Publication") base = 70;
    else if (intent === "Prevention Advice") base = 72;
    else if (negativeWords > 2) base = 85;
    const priorityScore = Math.min(100, Math.max(1, base + Math.floor((Math.random() - 0.5) * 12)));
    const confidenceScore = Math.min(100, Math.max(50, 76 + Math.floor(Math.random() * 22)));

    // ── Summary ───────────────────────────────────────────────────────────────
    const summary =
      contentWords.slice(0, 35).join(" ") +
      (contentWords.length > 35 ? "…" : "");

    // ── Suggested professional reply ──────────────────────────────────────────
    let suggestedReply =
      "Thank you for sharing this medical research. Our clinical team will review and assess the relevance to our patient care protocols within 48 hours.";
    if (intent === "Treatment Information") {
      suggestedReply =
        "This treatment information has been flagged for clinical review. Our medical team will evaluate the evidence base and determine whether this approach aligns with current best-practice guidelines. We'll share an assessment within 2 business days.";
    } else if (intent === "Diagnostic Information") {
      suggestedReply =
        "Thank you for this diagnostic update. We've forwarded it to our clinical diagnostics team for evaluation. If the findings have immediate patient-safety implications, our review will be expedited.";
    } else if (intent === "Research Publication") {
      suggestedReply =
        "This publication has been added to our medical intelligence queue. Our research team will assess its methodology, sample size, and clinical applicability and provide a summary review.";
    } else if (intent === "Prevention Advice") {
      suggestedReply =
        "This prevention and public-health update has been shared with our epidemiology and wellness teams. We'll incorporate relevant guidance into our patient-facing communications.";
    } else if (sentiment === "Negative") {
      suggestedReply =
        "This item has been flagged as high-priority due to potential risk indicators. Our clinical safety team has been notified and will conduct an expedited review within 24 hours.";
    }

    return {
      summary,
      intent,
      industry,
      category,
      sentiment,
      priorityScore,
      confidenceScore,
      suggestedReply,
      description,
      seoScore,
      seoKeywords,
      authorAuthority,
      meritPassed,
      isMedical,
    };
  }

  private buildResponse(messages: AIMessage[], options: GenerateOptions): string {
    const systemPrompt = options.systemPrompt
      ?? messages.find((m) => m.role === "system")?.content;

    const baseResponse = selectResponse(messages);

    if (systemPrompt) {
      return `*[Responding with system prompt: "${systemPrompt.slice(0, 60)}…"]*\n\n${baseResponse}`;
    }
    return baseResponse;
  }
}
