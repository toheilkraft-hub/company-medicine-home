/**
 * ProviderFactory — creates the correct AI provider based on configuration.
 *
 * Adding a new provider:
 *  1. Create a class implementing IProvider in its own file.
 *  2. Import it here and add a case to the switch statement.
 *  3. Add its ID to the ProviderID union in shared/types.ts.
 *  4. Done — the rest of the app picks it up automatically.
 */

import type { IProvider } from "./IProvider.js";
import { MockProvider } from "./MockProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import type { ProviderConfig, ProviderID } from "../../shared/types.js";
import { logger } from "../middleware/logger.js";

// Singleton cache — one instance per (provider, apiKey) pair
const providerCache = new Map<string, IProvider>();

function cacheKey(config: ProviderConfig): string {
  return `${config.provider}::${config.apiKey ?? ""}`;
}

export class ProviderFactory {
  /**
   * Create (or return cached) provider matching the config.
   * Falls back to MockProvider if the requested provider isn't configured.
   */
  static create(config: ProviderConfig): IProvider {
    const key = cacheKey(config);
    if (providerCache.has(key)) return providerCache.get(key)!;

    const provider = ProviderFactory.instantiate(config);
    providerCache.set(key, provider);
    return provider;
  }

  /** Invalidate the cache for a given config (call when API key changes). */
  static invalidate(config: ProviderConfig) {
    providerCache.delete(cacheKey(config));
  }

  /** Return all registered providers with their status. */
  static registry(): Array<{ id: ProviderID; name: string; available: boolean }> {
    return [
      { id: "mock", name: "Mock Provider", available: true },
      { id: "gemini", name: "Google Gemini", available: false },
      { id: "openai", name: "OpenAI", available: false },
      { id: "anthropic", name: "Anthropic Claude", available: false },
    ];
  }

  private static instantiate(config: ProviderConfig): IProvider {
    switch (config.provider) {
      case "gemini":
        if (!config.apiKey) {
          logger.warn("GeminiProvider requested but no API key — falling back to Mock");
          return new MockProvider();
        }
        logger.info("Creating GeminiProvider");
        return new GeminiProvider(config.apiKey);

      case "openai":
        if (!config.apiKey) {
          logger.warn("OpenAIProvider requested but no API key — falling back to Mock");
          return new MockProvider();
        }
        logger.info("Creating OpenAIProvider");
        return new OpenAIProvider(config.apiKey);

      case "anthropic":
        logger.warn("AnthropicProvider not yet implemented — falling back to Mock");
        return new MockProvider();

      case "mock":
      default:
        logger.info("Creating MockProvider");
        return new MockProvider();
    }
  }
}
