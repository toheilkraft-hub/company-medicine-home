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

    const text = `${item.title} ${item.content}`.toLowerCase();

    // Industry detection
    let industry = "General";
    if (/health|medical|patient|clinical|hospital|therapy|mental|wellness|pharma|nurse|physician|icu|fda|hipaa/.test(text))
      industry = "Healthcare";
    else if (/tech|ai|software|digital|platform|app|data|algorithm|machine learning/.test(text))
      industry = "Technology";
    else if (/finance|invest|market|stock|fund|revenue|capital|series [ab]/.test(text))
      industry = "Finance";
    else if (/government|policy|regulation|law|legal|compliance/.test(text))
      industry = "Regulatory";

    // Category
    let category = "General Discussion";
    if (/partner|collab|opportunity|business development|integration/.test(text))
      category = "Business Development";
    else if (/research|study|trial|evidence|clinical|published|journal|nature/.test(text))
      category = "Clinical Research";
    else if (/product|feature|launch|release|demo|pricing|purchase/.test(text))
      category = "Product";
    else if (/support|help|issue|problem|complaint|frustrated|burning out/.test(text))
      category = "Support & Feedback";
    else if (/news|report|article|analysis|market|raises|funding/.test(text))
      category = "News & Analysis";
    else if (/complaint|negative|fail|risk|dangerous|concern/.test(text))
      category = "Risk & Concern";

    // Sentiment
    const positiveWords = (text.match(/\b(great|excellent|amazing|positive|success|improve|benefit|effective|breakthrough|cleared|landmark|impressive|love|helpful)\b/g) ?? []).length;
    const negativeWords = (text.match(/\b(problem|issue|fail|risk|concern|bad|negative|difficult|challenge|frustrated|burning|dangerous|mislead|error)\b/g) ?? []).length;
    let sentiment = "Neutral";
    if (positiveWords > negativeWords + 1) sentiment = "Positive";
    else if (negativeWords > positiveWords + 1) sentiment = "Negative";
    else if (positiveWords > 0 && negativeWords > 0) sentiment = "Mixed";

    // Intent
    let intent = "Informational";
    if (/partnership|partner|collab|work together|integrate/.test(text)) intent = "Partnership Inquiry";
    else if (/demo|schedule|call|meeting|discuss/.test(text)) intent = "Sales Inquiry";
    else if (/support|help|assistance|question|how do/.test(text)) intent = "Support Request";
    else if (/feedback|opinion|review|experience|my experience/.test(text)) intent = "User Feedback";
    else if (/research|study|published|findings|data/.test(text)) intent = "Research Publication";
    else if (/market|report|analysis|industry|growth/.test(text)) intent = "Market Intelligence";
    else if (/media|press|interview|journalist|correspondent/.test(text)) intent = "Media Inquiry";

    // Priority: higher for sales/partnership, lower for general news
    let base = 50;
    if (intent === "Partnership Inquiry" || intent === "Sales Inquiry") base = 88;
    else if (intent === "Support Request") base = 75;
    else if (intent === "User Feedback") base = 65;
    else if (intent === "Market Intelligence") base = 60;
    else if (intent === "Research Publication") base = 65;
    const priorityScore = Math.min(100, Math.max(1, base + Math.floor((Math.random() - 0.5) * 10)));
    const confidenceScore = Math.min(100, Math.max(50, 78 + Math.floor(Math.random() * 20)));

    // Summary — first ~30 words
    const words = item.content.trim().split(/\s+/);
    const summary = words.slice(0, 30).join(" ") + (words.length > 30 ? "…" : "");

    // Suggested reply
    let suggestedReply =
      `Thank you for sharing this with us. We've reviewed your message and appreciate the insights. A member of our team will follow up within 2 business days.`;
    if (intent === "Partnership Inquiry") {
      suggestedReply = `Thank you for your interest in partnering with iHeal AI. We'd love to explore this opportunity further. Could you share more details about your organization and the specific collaboration you have in mind? A member of our partnerships team will be in touch within 48 hours.`;
    } else if (intent === "Sales Inquiry") {
      suggestedReply = `Thank you for your interest in iHeal AI. We'd be delighted to schedule a personalized demo tailored to your team's workflows. I'll reach out directly to confirm timing. In the meantime, please feel free to review our platform overview at iheal.ai/platform.`;
    } else if (intent === "Support Request") {
      suggestedReply = `Thank you for reaching out. We've received your request and our team is reviewing it. We aim to respond within 24 hours. Please check our documentation at docs.iheal.ai for immediate guidance.`;
    } else if (sentiment === "Negative") {
      suggestedReply = `We appreciate you bringing this to our attention and take all feedback seriously. We want to ensure your experience meets your expectations. Could you provide additional context so we can address this appropriately?`;
    } else if (intent === "Media Inquiry") {
      suggestedReply = `Thank you for reaching out. We'd be happy to connect with your editorial team. Please contact our communications team at press@iheal.ai to arrange an interview and receive our latest press kit.`;
    }

    return { summary, intent, industry, category, sentiment, priorityScore, confidenceScore, suggestedReply };
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
