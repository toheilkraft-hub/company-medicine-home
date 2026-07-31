/**
 * OpenAIProvider — OpenAI GPT integration (fully implemented).
 */

import type { IProvider } from "./IProvider.js";
import type {
  AIMessage,
  AIResponse,
  GenerateOptions,
  ItemAnalysisResult,
  ModelInfo,
} from "../../shared/types.js";
import OpenAI from "openai";
import { buildMedicalPrompt, extractJSON, coerceAnalysis } from "./analyzeHelpers.js";

export class OpenAIProvider implements IProvider {
  readonly id = "openai";
  readonly name = "OpenAI";

  private apiKey: string;
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel ?? "gpt-4o";
    this.client = new OpenAI({ apiKey });
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.startsWith("sk-");
  }

  async generateResponse(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): Promise<AIResponse> {
    this.assertConfigured();
    const start = Date.now();

    const modelId = options.model ?? this.defaultModel;
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    if (options.systemPrompt) {
      oaiMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const completion = await this.client.chat.completions.create({
      model: modelId,
      messages: oaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    const choice = completion.choices[0];
    return {
      content: choice.message.content ?? "",
      model: modelId,
      provider: "openai",
      tokensUsed: completion.usage?.total_tokens,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      latencyMs: Date.now() - start,
      finishReason: choice.finish_reason ?? "stop",
    };
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    this.assertConfigured();

    const modelId = options.model ?? this.defaultModel;
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    if (options.systemPrompt) {
      oaiMessages.unshift({ role: "system", content: options.systemPrompt });
    }

    const stream = await this.client.chat.completions.create({
      model: modelId,
      messages: oaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      full += delta;
      yield delta;
    }

    return {
      content: full,
      model: modelId,
      provider: "openai",
      finishReason: "stop",
    };
  }

  async summarize(text: string, options: GenerateOptions = {}): Promise<string> {
    const r = await this.generateResponse(
      [{ role: "user", content: `Summarise in one sentence: ${text}` }],
      { ...options, maxTokens: 80 }
    );
    return r.content;
  }

  async classifyIntent(message: string): Promise<string> {
    const r = await this.generateResponse(
      [{ role: "user", content: `Intent label (question/task/search/chat/unknown) for: "${message}". One word only.` }],
      { maxTokens: 5, temperature: 0 }
    );
    return r.content.trim().toLowerCase();
  }

  /**
   * Fetch live model list from OpenAI API, filtered to chat-capable models.
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.models.list();
      const chatModels = response.data
        .filter((m) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3"))
        .sort((a, b) => b.created - a.created)
        .map((m) => ({
          id: m.id,
          name: m.id,
          description: "",
          maxTokens: m.id.includes("32k") ? 32768 : m.id.includes("128k") || m.id.includes("4o") ? 128000 : 16385,
          supportsStreaming: true,
          provider: "openai" as const,
        }));
      return chatModels.length > 0 ? chatModels : this.staticModels();
    } catch {
      return this.staticModels();
    }
  }

  private staticModels(): ModelInfo[] {
    return [
      { id: "gpt-4o", name: "GPT-4o", description: "Most capable, multimodal", maxTokens: 128000, supportsStreaming: true, provider: "openai" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable", maxTokens: 128000, supportsStreaming: true, provider: "openai" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High intelligence, large context", maxTokens: 128000, supportsStreaming: true, provider: "openai" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Cost-effective", maxTokens: 16385, supportsStreaming: true, provider: "openai" },
    ];
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    const prompt = buildMedicalPrompt(item);

    const response = await this.generateResponse(
      [{ role: "user", content: prompt }],
      { model: this.defaultModel, maxTokens: 700, temperature: 0.2 }
    );

    const raw = JSON.parse(extractJSON(response.content)) as unknown;
    return coerceAnalysis(raw);
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new Error("OpenAIProvider: invalid or missing API key (must start with sk-)");
  }
}
