/**
 * GeminiProvider — Google Gemini SDK integration (fully implemented).
 */

import type { IProvider } from "./IProvider.js";
import type {
  AIMessage,
  AIResponse,
  GenerateOptions,
  ItemAnalysisResult,
  ModelInfo,
} from "../../shared/types.js";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { buildMedicalPrompt, extractJSON, coerceAnalysis } from "./analyzeHelpers.js";

/** Rewrite "no longer available" API errors into a clear user-facing message. */
function wrapModelError(err: unknown, modelId: string): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.toLowerCase().includes("no longer available") ||
    msg.toLowerCase().includes("not found") ||
    msg.includes("404")
  ) {
    throw new Error(
      `The model "${modelId}" is not available with your API key. ` +
      `Go to Settings → AI Provider, click "Fetch available models", ` +
      `select a working model (e.g. Gemini 2.0 Flash), and save.`
    );
  }
  throw err;
}

export class GeminiProvider implements IProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private apiKey: string;
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel ?? "gemini-flash-latest";
    this.client = new GoogleGenerativeAI(apiKey);
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  async generateResponse(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): Promise<AIResponse> {
    this.assertConfigured();
    const start = Date.now();
    const modelId = options.model ?? this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({
        model: modelId,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
        systemInstruction: options.systemPrompt,
      });

      const geminiHistory = messages
        .filter((m) => m.role !== "system")
        .slice(0, -1)
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }] as Part[],
        }));

      const chat = model.startChat({ history: geminiHistory });
      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;
      const content = response.text();
      const usage = response.usageMetadata;

      return {
        content,
        model: modelId,
        provider: "gemini",
        tokensUsed: usage?.totalTokenCount ?? 0,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        latencyMs: Date.now() - start,
        finishReason: response.candidates?.[0]?.finishReason ?? "stop",
      };
    } catch (err) {
      wrapModelError(err, modelId);
    }
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    this.assertConfigured();
    const modelId = options.model ?? this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({
        model: modelId,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
        systemInstruction: options.systemPrompt,
      });

      const geminiHistory = messages
        .filter((m) => m.role !== "system")
        .slice(0, -1)
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }] as Part[],
        }));

      const chat = model.startChat({ history: geminiHistory });
      const lastMessage = messages[messages.length - 1];
      const { stream, response } = await chat.sendMessageStream(lastMessage.content);

      let full = "";
      for await (const chunk of stream) {
        const text = chunk.text();
        full += text;
        yield text;
      }

      const resolved = await response;
      const usage = resolved.usageMetadata;
      return {
        content: full,
        model: modelId,
        provider: "gemini",
        tokensUsed: usage?.totalTokenCount,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        finishReason: resolved.candidates?.[0]?.finishReason ?? "stop",
      };
    } catch (err) {
      wrapModelError(err, modelId);
    }
  }

  async summarize(text: string, options: GenerateOptions = {}): Promise<string> {
    const prompt: AIMessage = {
      role: "user",
      content: `Summarise the following text in one concise sentence:\n\n${text}`,
    };
    const response = await this.generateResponse([prompt], { ...options, maxTokens: 100 });
    return response.content;
  }

  async classifyIntent(message: string): Promise<string> {
    const prompt: AIMessage = {
      role: "user",
      content: `Classify the intent of this message as one of: question, task, search, chat, unknown.
Reply with just the single word label.

Message: "${message}"`,
    };
    const response = await this.generateResponse([prompt], { maxTokens: 10, temperature: 0 });
    const label = response.content.trim().toLowerCase();
    const valid = ["question", "task", "search", "chat", "unknown"];
    return valid.includes(label) ? label : "chat";
  }

  /**
   * Fetch the live list of models from the Gemini API.
   * Filters to chat-capable models with usable rate limits.
   * Falls back to a curated static list if the fetch fails.
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}&pageSize=100`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        models?: Array<{
          name: string;
          displayName: string;
          description?: string;
          inputTokenLimit?: number;
          outputTokenLimit?: number;
          supportedGenerationMethods?: string[];
        }>;
      };

      // Fragments that indicate non-chat models
      const EXCLUDE_FRAGMENTS = ["embedding", "aqa", "vision"];

      // Bare deprecated aliases that no longer work for most keys.
      // gemini-2.5-flash and gemini-2.5-pro are intentionally kept — they are
      // the target models for accounts with 250 k RPD access.
      const DEPRECATED_EXACT = new Set([
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-pro",
        "models/gemini-ultra",
      ]);

      return (data.models ?? [])
        .filter((m) => {
          // Must support text generation
          if (!m.supportedGenerationMethods?.includes("generateContent")) return false;
          // Must have a usable input token limit (0 = not available for standard use)
          if ((m.inputTokenLimit ?? 0) === 0) return false;
          // Exclude known deprecated bare aliases
          if (DEPRECATED_EXACT.has(m.name)) return false;
          // Exclude non-chat model types
          const id = m.name.toLowerCase();
          return !EXCLUDE_FRAGMENTS.some((frag) => id.includes(frag));
        })
        .map((m) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName ?? m.name.replace("models/", ""),
          description: m.description ?? "",
          maxTokens: m.outputTokenLimit ?? 8192,
          supportsStreaming: true,
          provider: "gemini" as const,
        }))
        // Sort: newest / most capable first
        .sort((a, b) => {
          const priority = (id: string) => {
            if (id.includes("2.5")) return 0;
            if (id.includes("2.0")) return 1;
            if (id.includes("1.5")) return 2;
            return 3;
          };
          return priority(a.id) - priority(b.id);
        });
    } catch {
      // Fallback static list — alias models that resolve reliably across keys
      return [
        { id: "gemini-flash-latest", name: "Gemini Flash (Latest)", description: "Always resolves to the newest available Flash model", maxTokens: 65536, supportsStreaming: true, provider: "gemini" },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Latest 2.5 generation", maxTokens: 65536, supportsStreaming: true, provider: "gemini" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Stable 2.0 generation", maxTokens: 8192, supportsStreaming: true, provider: "gemini" },
      ];
    }
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    const prompt = buildMedicalPrompt(item);

    // Try the configured model first; fall back to stable aliases on
    // "model not available" errors only — rate-limit / auth errors surface immediately.
    const fallbackChain = [
      this.defaultModel,
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-flash-latest",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastErr: unknown;
    for (const modelId of fallbackChain) {
      try {
        const response = await this.generateResponse(
          [{ role: "user", content: prompt }],
          { model: modelId, maxTokens: 700, temperature: 0.2 }
        );
        if (modelId !== this.defaultModel) {
          this.defaultModel = modelId;
        }
        const raw = JSON.parse(extractJSON(response.content)) as unknown;
        return coerceAnalysis(raw);
      } catch (err: any) {
        const msg: string = err?.message ?? String(err);
        if (
          msg.includes("429") ||
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("api key") ||
          msg.toLowerCase().includes("permission")
        ) {
          throw err;
        }
        lastErr = err;
      }
    }
    throw lastErr;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error("GeminiProvider: API key is not configured. Add it in Settings.");
    }
  }
}
