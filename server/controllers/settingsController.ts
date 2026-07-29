import { Request, Response } from "express";
import { db } from "../config/db.js";
import { settings } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { ok, asyncHandler } from "../utils/helpers.js";
import { ProviderFactory } from "../providers/ProviderFactory.js";
import type { ProviderConfig, ProviderID } from "../../shared/types.js";

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return "••••••••" + key.slice(-4);
}

function safeRow(row: typeof settings.$inferSelect) {
  return {
    ...row,
    geminiApiKey: maskKey(row.geminiApiKey),
    openaiApiKey: maskKey(row.openaiApiKey),
    anthropicApiKey: maskKey(row.anthropicApiKey),
  };
}

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  let row = await db.query.settings.findFirst({ where: eq(settings.userId, userId) });

  if (!row) {
    const [created] = await db.insert(settings).values({ userId }).returning();
    row = created;
  }

  // Include provider registry for the UI
  const registry = ProviderFactory.registry();

  return ok(res, {
    settings: safeRow(row),
    providers: registry,
  });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const {
    provider,
    geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    defaultModel,
    temperature,
    maxTokens,
    defaultSystemPromptId,
    theme,
    streamingEnabled,
  } = req.body;

  const existing = await db.query.settings.findFirst({ where: eq(settings.userId, userId) });

  // Only overwrite API key if a new non-masked value is provided
  const resolveKey = (newVal?: string, existing?: string | null) =>
    newVal && !newVal.startsWith("••••") ? newVal : (existing ?? null);

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
    ...(provider !== undefined && { provider }),
    ...(defaultModel !== undefined && { defaultModel }),
    ...(temperature !== undefined && { temperature: String(temperature) }),
    ...(maxTokens !== undefined && { maxTokens: Number(maxTokens) }),
    ...(defaultSystemPromptId !== undefined && { defaultSystemPromptId }),
    ...(theme !== undefined && { theme }),
    ...(streamingEnabled !== undefined && { streamingEnabled: Boolean(streamingEnabled) }),
    geminiApiKey: resolveKey(geminiApiKey, existing?.geminiApiKey),
    openaiApiKey: resolveKey(openaiApiKey, existing?.openaiApiKey),
    anthropicApiKey: resolveKey(anthropicApiKey, existing?.anthropicApiKey),
  };

  // Invalidate provider cache when key changes
  if (provider || geminiApiKey || openaiApiKey) {
    const cfg: ProviderConfig = {
      provider: (provider ?? existing?.provider ?? "mock") as ProviderID,
      apiKey: patch.geminiApiKey as string | undefined,
    };
    ProviderFactory.invalidate(cfg);
  }

  let updated;
  if (existing) {
    const [r] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.userId, userId))
      .returning();
    updated = r;
  } else {
    const [r] = await db
      .insert(settings)
      .values({ userId, ...patch })
      .returning();
    updated = r;
  }

  return ok(res, { settings: safeRow(updated) });
});
