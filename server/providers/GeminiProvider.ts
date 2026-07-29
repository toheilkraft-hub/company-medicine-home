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

export class GeminiProvider implements IProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private apiKey: string;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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

    const modelId = options.model ?? "gemini-1.5-flash";
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
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    this.assertConfigured();

    const modelId = options.model ?? "gemini-1.5-flash";
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
   * Falls back to a curated static list if the fetch fails.
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string; displayName: string; description?: string; outputTokenLimit?: number; supportedGenerationMethods?: string[] }> };

      // Known deprecated / unavailable model name fragments to exclude
      const DEPRECATED = ["vision", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-ultra", "aqa"];

      return (data.models ?? [])
        .filter((m) => {
          if (!m.supportedGenerationMethods?.includes("generateContent")) return false;
          const id = m.name.toLowerCase();
          return !DEPRECATED.some((d) => id.includes(d));
        })
        .map((m) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName ?? m.name.replace("models/", ""),
          description: m.description ?? "",
          maxTokens: m.outputTokenLimit ?? 8192,
          supportsStreaming: true,
          provider: "gemini" as const,
        }));
    } catch {
      // Fallback static list
      return [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Latest fast model", maxTokens: 8192, supportsStreaming: true, provider: "gemini" },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast and efficient", maxTokens: 8192, supportsStreaming: true, provider: "gemini" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Most capable Gemini model", maxTokens: 32768, supportsStreaming: true, provider: "gemini" },
        { id: "gemini-pro", name: "Gemini Pro", description: "Balanced performance", maxTokens: 8192, supportsStreaming: true, provider: "gemini" },
      ];
    }
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    const prompt = `Analyse the following intelligence item and return a JSON object with exactly these fields:
  summary (string, ≤50 words), intent (string), industry (string),
  category (string), sentiment ("Positive"|"Negative"|"Neutral"|"Mixed"),
  priorityScore (1-100 integer), confidenceScore (1-100 integer),
  suggestedReply (string, professional reply ≤200 words)

Source: ${item.source}
Title: ${item.title}
Content: ${item.content}

Return only valid JSON, no markdown fences.`;

    const response = await this.generateResponse(
      [{ role: "user", content: prompt }],
      { maxTokens: 500, temperature: 0.2 }
    );
    return JSON.parse(response.content) as ItemAnalysisResult;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error("GeminiProvider: API key is not configured. Add it in Settings.");
    }
  }
}
