import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { collectorConfigs } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { ok, fail, asyncHandler } from "../utils/helpers.js";

// GET /api/collector-config — list all configs for the current user
export const listConfigs = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const configs = await db
    .select()
    .from(collectorConfigs)
    .where(eq(collectorConfigs.userId, userId));
  ok(res, { configs });
});

// PUT /api/collector-config/:collectorId — upsert a collector config
export const upsertConfig = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { collectorId } = req.params;
  const { apiKey, extraConfig, enabled } = req.body as {
    apiKey?: string;
    extraConfig?: Record<string, string>;
    enabled?: boolean;
  };

  if (!collectorId) return fail(res, "collectorId is required");

  const existing = await db
    .select()
    .from(collectorConfigs)
    .where(
      and(
        eq(collectorConfigs.userId, userId),
        eq(collectorConfigs.collectorId, collectorId),
      ),
    )
    .limit(1);

  let config;
  if (existing.length > 0) {
    const [updated] = await db
      .update(collectorConfigs)
      .set({
        apiKey: apiKey !== undefined ? apiKey : existing[0].apiKey,
        extraConfig: extraConfig !== undefined ? extraConfig : existing[0].extraConfig,
        enabled: enabled !== undefined ? enabled : existing[0].enabled,
        updatedAt: new Date(),
      })
      .where(eq(collectorConfigs.id, existing[0].id))
      .returning();
    config = updated;
  } else {
    const [inserted] = await db
      .insert(collectorConfigs)
      .values({
        userId,
        collectorId,
        apiKey: apiKey ?? null,
        extraConfig: extraConfig ?? {},
        enabled: enabled ?? true,
      })
      .returning();
    config = inserted;
  }

  ok(res, { config });
});
