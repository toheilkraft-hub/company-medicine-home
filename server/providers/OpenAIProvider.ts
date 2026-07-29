/**
 * OpenAIProvider — OpenAI GPT integration stub.
 *
 * ── HOW TO ACTIVATE ──────────────────────────────────────────────────────────
 *  1. Install:   npm install openai
 *  2. Uncomment the SDK import and implementation below.
 *  3. Register in ProviderFactory.ts (already listed).
 *  4. Set provider = "openai" and API key in Settings.
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

// import OpenAI from "openai"; // TODO: npm install openai

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most capable OpenAI model",
    maxTokens: 128000,
    supportsStreaming: true,
    provider: "openai",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and affordable",
    maxTokens: 128000,
    supportsStreaming: true,
    provider: "openai",
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Legacy model, cost-effective",
    maxTokens: 16385,
    supportsStreaming: true,
    provider: "openai",
  },
];

export class OpenAIProvider implements IProvider {
  readonly id = "openai";
  readonly name = "OpenAI";

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.startsWith("sk-");
  }

  async generateResponse(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): Promise<AIResponse> {
    this.assertConfigured();
    // TODO: uncomment when `openai` package is installed
    // const client = new OpenAI({ apiKey: this.apiKey });
    // const completion = await client.chat.completions.create({
    //   model: options.model ?? "gpt-4o",
    //   messages: messages.map(m => ({ role: m.role, content: m.content })),
    //   temperature: options.temperature ?? 0.7,
    //   max_tokens: options.maxTokens ?? 2048,
    // });
    // const choice = completion.choices[0];
    // return {
    //   content: choice.message.content ?? "",
    //   model: options.model ?? "gpt-4o",
    //   provider: "openai",
    //   tokensUsed: completion.usage?.total_tokens,
    //   promptTokens: completion.usage?.prompt_tokens,
    //   completionTokens: completion.usage?.completion_tokens,
    //   finishReason: choice.finish_reason ?? "stop",
    // };
    throw new Error("OpenAIProvider: uncomment implementation in server/providers/OpenAIProvider.ts");
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    this.assertConfigured();
    // TODO: streaming implementation
    // const client = new OpenAI({ apiKey: this.apiKey });
    // const stream = await client.chat.completions.create({
    //   model: options.model ?? "gpt-4o",
    //   messages: messages.map(m => ({ role: m.role, content: m.content })),
    //   stream: true,
    // });
    // let full = "";
    // for await (const chunk of stream) {
    //   const delta = chunk.choices[0]?.delta?.content ?? "";
    //   full += delta;
    //   yield delta;
    // }
    // return { content: full, model: options.model ?? "gpt-4o", provider: "openai", finishReason: "stop" };
    throw new Error("OpenAIProvider: streaming not yet implemented");
    return {} as AIResponse;
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

  async listModels(): Promise<ModelInfo[]> {
    return OPENAI_MODELS;
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    // TODO: OpenAI — structured JSON prompt via function calling or response_format
    throw new Error("OpenAIProvider.analyzeContent: not yet implemented");
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new Error("OpenAIProvider: invalid or missing API key");
  }
}
