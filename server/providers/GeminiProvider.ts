/**
 * GeminiProvider — Google Gemini SDK integration.
 *
 * ── HOW TO ACTIVATE ──────────────────────────────────────────────────────────
 *  1. Install the SDK:       npm install @google/generative-ai
 *  2. Go to Settings in the app and set:
 *       - Provider: Google Gemini
 *       - API Key: your key from https://ai.google.dev/
 *  3. The ProviderFactory will automatically use this class.
 *
 * No other code changes are needed — the provider interface is already wired.
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

// ── SDK import (uncomment when @google/generative-ai is installed) ─────────────
// import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description: "Fast and efficient model for most tasks",
    maxTokens: 8192,
    supportsStreaming: true,
    provider: "gemini",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Most capable Gemini model for complex reasoning",
    maxTokens: 32768,
    supportsStreaming: true,
    provider: "gemini",
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    description: "Balanced performance and speed",
    maxTokens: 8192,
    supportsStreaming: true,
    provider: "gemini",
  },
];

export class GeminiProvider implements IProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private apiKey: string;
  // private client: GoogleGenerativeAI; // TODO: uncomment when SDK installed

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // TODO: uncomment when @google/generative-ai is installed
    // this.client = new GoogleGenerativeAI(apiKey);
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

    // TODO: replace this block with the real SDK call ─────────────────────────
    // const model = this.client.getGenerativeModel({
    //   model: options.model ?? "gemini-1.5-flash",
    //   generationConfig: {
    //     temperature: options.temperature ?? 0.7,
    //     maxOutputTokens: options.maxTokens ?? 2048,
    //   },
    //   systemInstruction: options.systemPrompt,
    // });
    //
    // const geminiHistory = messages
    //   .filter((m) => m.role !== "system")
    //   .slice(0, -1)
    //   .map((m) => ({
    //     role: m.role === "assistant" ? "model" : "user",
    //     parts: [{ text: m.content }] as Part[],
    //   }));
    //
    // const chat = model.startChat({ history: geminiHistory });
    // const lastMessage = messages[messages.length - 1];
    // const result = await chat.sendMessage(lastMessage.content);
    // const response = result.response;
    // const content = response.text();
    // const usage = response.usageMetadata;
    //
    // return {
    //   content,
    //   model: options.model ?? "gemini-1.5-flash",
    //   provider: "gemini",
    //   tokensUsed: (usage?.totalTokenCount ?? 0),
    //   promptTokens: usage?.promptTokenCount,
    //   completionTokens: usage?.candidatesTokenCount,
    //   latencyMs: Date.now() - start,
    //   finishReason: response.candidates?.[0]?.finishReason ?? "stop",
    // };
    // ─────────────────────────────────────────────────────────────────────────

    throw new Error(
      "GeminiProvider: install @google/generative-ai and uncomment the SDK calls in server/providers/GeminiProvider.ts"
    );
  }

  async *generateStream(
    messages: AIMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, AIResponse, unknown> {
    this.assertConfigured();

    // TODO: replace this block with the real streaming SDK call ───────────────
    // const model = this.client.getGenerativeModel({
    //   model: options.model ?? "gemini-1.5-flash",
    //   generationConfig: {
    //     temperature: options.temperature ?? 0.7,
    //     maxOutputTokens: options.maxTokens ?? 2048,
    //   },
    //   systemInstruction: options.systemPrompt,
    // });
    //
    // const geminiHistory = messages
    //   .filter((m) => m.role !== "system")
    //   .slice(0, -1)
    //   .map((m) => ({
    //     role: m.role === "assistant" ? "model" : "user",
    //     parts: [{ text: m.content }] as Part[],
    //   }));
    //
    // const chat = model.startChat({ history: geminiHistory });
    // const lastMessage = messages[messages.length - 1];
    // const { stream, response } = await chat.sendMessageStream(lastMessage.content);
    //
    // let full = "";
    // for await (const chunk of stream) {
    //   const text = chunk.text();
    //   full += text;
    //   yield text;
    // }
    //
    // const resolved = await response;
    // const usage = resolved.usageMetadata;
    // return {
    //   content: full,
    //   model: options.model ?? "gemini-1.5-flash",
    //   provider: "gemini",
    //   tokensUsed: usage?.totalTokenCount,
    //   promptTokens: usage?.promptTokenCount,
    //   completionTokens: usage?.candidatesTokenCount,
    //   finishReason: resolved.candidates?.[0]?.finishReason ?? "stop",
    // };
    // ─────────────────────────────────────────────────────────────────────────

    throw new Error(
      "GeminiProvider: install @google/generative-ai and uncomment the streaming SDK call in server/providers/GeminiProvider.ts"
    );

    // Required by TypeScript to satisfy the return type
    return {} as AIResponse;
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

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult> {
    // TODO: GEMINI — replace this with a structured prompt:
    //
    // const prompt = `Analyse the following intelligence item and return a JSON object
    // with exactly these fields:
    //   summary (string, ≤50 words), intent (string), industry (string),
    //   category (string), sentiment ("Positive"|"Negative"|"Neutral"|"Mixed"),
    //   priorityScore (1-100 integer), confidenceScore (1-100 integer),
    //   suggestedReply (string, professional reply ≤200 words)
    //
    // Source: ${item.source}
    // Title: ${item.title}
    // Content: ${item.content}`;
    //
    // const response = await this.generateResponse(
    //   [{ role: "user", content: prompt }],
    //   { maxTokens: 500, temperature: 0.2 }
    // );
    // return JSON.parse(response.content) as ItemAnalysisResult;

    throw new Error(
      "GeminiProvider.analyzeContent: add your API key in Settings to enable real AI analysis"
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error("GeminiProvider: API key is not configured. Add it in Settings.");
    }
  }
}
