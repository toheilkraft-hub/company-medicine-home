/**
 * IProvider — the single interface every AI provider must implement.
 *
 * To add a new provider (e.g. Gemini, OpenAI, Anthropic):
 *  1. Create a class that implements this interface in its own file.
 *  2. Register it in ProviderFactory.ts.
 *  3. Expose its config fields in Settings.
 *
 * The rest of the application never imports a concrete provider directly.
 */

import type { AIMessage, AIResponse, GenerateOptions, ItemAnalysisResult, ModelInfo } from "../../shared/types.js";

export interface IProvider {
  /** Unique identifier, e.g. "gemini", "openai", "mock" */
  readonly id: string;

  /** Human-readable name for the UI */
  readonly name: string;

  /** Returns true if the provider has enough config to make API calls */
  isConfigured(): boolean;

  /**
   * Generate a single (non-streaming) response.
   */
  generateResponse(
    messages: AIMessage[],
    options?: GenerateOptions
  ): Promise<AIResponse>;

  /**
   * Streaming response via async generator.
   * Each yielded string is a content chunk (delta).
   * The final yield is an empty string; metadata is attached separately.
   *
   * Usage:
   *   for await (const chunk of provider.generateStream(messages, options)) {
   *     res.write(`data: ${JSON.stringify({ type: "token", content: chunk })}\n\n`);
   *   }
   */
  generateStream(
    messages: AIMessage[],
    options?: GenerateOptions
  ): AsyncGenerator<string, AIResponse, unknown>;

  /**
   * Summarise text into a short string (title, paragraph, etc.).
   */
  summarize(text: string, options?: GenerateOptions): Promise<string>;

  /**
   * Classify the intent of a user message.
   * Returns one of: "question" | "task" | "search" | "chat" | "unknown"
   */
  classifyIntent(message: string): Promise<string>;

  /**
   * Return the list of models this provider supports.
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Analyse a collected intelligence item and return structured output.
   * Called by intelService for each new item in the processing queue.
   *
   * TODO: GEMINI — implement with a structured JSON prompt so Gemini returns
   * all fields directly, then parse and validate before returning.
   */
  analyzeContent(item: {
    title: string;
    content: string;
    source: string;
  }): Promise<ItemAnalysisResult>;
}
