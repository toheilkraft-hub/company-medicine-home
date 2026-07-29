/**
 * AI Service — the single orchestration layer between the HTTP handlers and
 * the provider implementations.
 */

import { db } from "../config/db.js";
import { settings } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { ProviderFactory } from "../providers/ProviderFactory.js";
import { AppError } from "../middleware/errorHandler.js";
import { logger } from "../middleware/logger.js";
import type {
  AIMessage,
  AIResponse,
  GenerateOptions,
  ModelInfo,
  ProviderConfig,
  ProviderID,
} from "../../shared/types.js";

// ── Provider config resolution ────────────────────────────────────────────────

export async function getProviderConfig(userId: number): Promise<ProviderConfig> {
  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  const provider = (userSettings?.provider as ProviderID) ?? "mock";

  // Pick the correct API key for the active provider
  let apiKey: string | undefined;
  if (provider === "gemini") apiKey = userSettings?.geminiApiKey ?? undefined;
  else if (provider === "openai") apiKey = userSettings?.openaiApiKey ?? undefined;
  else if (provider === "anthropic") apiKey = userSettings?.anthropicApiKey ?? undefined;

  return {
    provider,
    apiKey,
    defaultModel: userSettings?.defaultModel ?? undefined,
  };
}

// ── Core generation ───────────────────────────────────────────────────────────

export async function generateResponse(
  userId: number,
  messages: AIMessage[],
  options: GenerateOptions = {}
): Promise<AIResponse> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);

  logger.debug("generateResponse", {
    userId,
    provider: provider.id,
    model: options.model ?? config.defaultModel,
    messageCount: messages.length,
  });

  try {
    const response = await provider.generateResponse(messages, {
      model: options.model ?? config.defaultModel,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
    });

    logger.info("AI response generated", {
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
      latencyMs: response.latencyMs,
    });

    return response;
  } catch (err: any) {
    logger.error("generateResponse failed", { message: err.message, provider: config.provider });
    throw new AppError(`AI generation failed: ${err.message}`, 502, "AI_ERROR");
  }
}

export async function* generateStream(
  userId: number,
  messages: AIMessage[],
  options: GenerateOptions = {}
): AsyncGenerator<string, AIResponse, unknown> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);

  logger.debug("generateStream start", {
    userId,
    provider: provider.id,
    model: options.model ?? config.defaultModel,
  });

  try {
    const gen = provider.generateStream(messages, {
      model: options.model ?? config.defaultModel,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
    });

    let result: AIResponse = {} as AIResponse;
    while (true) {
      const { value, done } = await gen.next();
      if (done) {
        result = value as AIResponse;
        break;
      }
      yield value as string;
    }

    logger.info("Stream completed", {
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
    });

    return result;
  } catch (err: any) {
    logger.error("generateStream failed", { message: err.message });
    throw new AppError(`AI stream failed: ${err.message}`, 502, "AI_STREAM_ERROR");
  }
}

// ── Utility functions ─────────────────────────────────────────────────────────

export async function summarizeText(userId: number, text: string): Promise<string> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);
  try {
    return await provider.summarize(text);
  } catch {
    return text.slice(0, 80).trim() + (text.length > 80 ? "…" : "");
  }
}

export async function classifyIntent(userId: number, message: string): Promise<string> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);
  try {
    return await provider.classifyIntent(message);
  } catch {
    return "chat";
  }
}

export async function listModels(userId: number): Promise<ModelInfo[]> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);
  return provider.listModels();
}

export { ProviderFactory };
