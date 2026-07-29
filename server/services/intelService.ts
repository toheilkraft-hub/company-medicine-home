/**
 * intelService — orchestrates AI analysis of collected intelligence items.
 *
 * This is the single entry point for all item analysis. Routes calls through
 * the provider abstraction layer so Gemini (or any other LLM) can be plugged
 * in by changing the provider in Settings.
 */

import { getProviderConfig } from "./aiService.js";
import { ProviderFactory } from "../providers/ProviderFactory.js";
import { logger } from "../middleware/logger.js";
import type { ItemAnalysisResult } from "../../shared/types.js";

// ── Core analysis function ────────────────────────────────────────────────────

export async function analyzeCollectedItem(
  userId: number,
  item: { id: number; title: string; content: string; source: string }
): Promise<ItemAnalysisResult> {
  const config = await getProviderConfig(userId);
  const provider = ProviderFactory.create(config);

  logger.debug("analyzeCollectedItem", {
    itemId: item.id,
    provider: provider.id,
    source: item.source,
  });

  // TODO: GEMINI — When GeminiProvider.analyzeContent is wired, it will call
  // Gemini with a structured JSON prompt that returns the analysis fields below.
  const result = await provider.analyzeContent({
    title: item.title,
    content: item.content,
    source: item.source,
  });

  logger.info("Item analyzed", {
    itemId: item.id,
    intent: result.intent,
    sentiment: result.sentiment,
    priorityScore: result.priorityScore,
  });

  return result;
}
