/**
 * queueService — continuously processes collected items through the AI pipeline.
 *
 * Polls for items with status = "new", marks them "processing", runs analysis
 * via intelService, saves results to item_analysis, then marks them "reviewed".
 */

import { db } from "../config/db.js";
import { collectedItems, itemAnalysis } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { analyzeCollectedItem } from "./intelService.js";
import { logger } from "../middleware/logger.js";

const POLL_INTERVAL_MS = 6000;
const BATCH_SIZE = 3;
let isRunning = false;

// ── Single poll tick ──────────────────────────────────────────────────────────

export async function processQueue(systemUserId: number): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const newItems = await db
      .select()
      .from(collectedItems)
      .where(eq(collectedItems.status, "new"))
      .limit(BATCH_SIZE);

    if (newItems.length === 0) return;

    logger.info(`Queue: processing ${newItems.length} new item(s)`);

    for (const item of newItems) {
      try {
        // 1. Mark processing
        await db
          .update(collectedItems)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(collectedItems.id, item.id));

        // 2. Run AI analysis
        const analysis = await analyzeCollectedItem(systemUserId, {
          id: item.id,
          title: item.title,
          content: item.content,
          source: item.source,
        });

        // 3. Persist analysis (upsert-safe via onConflictDoNothing)
        await db
          .insert(itemAnalysis)
          .values({
            itemId: item.id,
            summary: analysis.summary,
            intent: analysis.intent,
            industry: analysis.industry,
            category: analysis.category,
            sentiment: analysis.sentiment,
            priorityScore: analysis.priorityScore,
            confidenceScore: analysis.confidenceScore,
            suggestedReply: analysis.suggestedReply,
            processedAt: new Date(),
          })
          .onConflictDoNothing();

        // 4. Mark reviewed
        await db
          .update(collectedItems)
          .set({ status: "reviewed", updatedAt: new Date() })
          .where(eq(collectedItems.id, item.id));

        logger.info(`Queue: ✓ item ${item.id} — "${item.title.slice(0, 45)}"`);
      } catch (err: any) {
        logger.error(`Queue: failed item ${item.id}`, { err: err?.message });
        // Reset so it can be retried on the next tick
        await db
          .update(collectedItems)
          .set({ status: "new", updatedAt: new Date() })
          .where(eq(collectedItems.id, item.id))
          .catch(() => {});
      }
    }
  } finally {
    isRunning = false;
  }
}

// ── Start polling ─────────────────────────────────────────────────────────────

export function startQueue(systemUserId: number): void {
  const tick = () =>
    processQueue(systemUserId).catch((e) =>
      logger.error("Queue tick error", { err: e?.message })
    );

  logger.info("Intelligence processing queue started", { pollMs: POLL_INTERVAL_MS });
  // Run immediately, then on interval
  setTimeout(tick, 2000);
  setInterval(tick, POLL_INTERVAL_MS);
}
