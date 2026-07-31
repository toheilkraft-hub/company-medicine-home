/**
 * queueService — continuously processes collected items through the AI pipeline.
 *
 * Polls for items with status = "new", marks them "processing", runs analysis
 * via intelService, saves results to item_analysis, then marks them "reviewed".
 *
 * Rate-limit handling:
 *  - On 429 / quota errors: backs off for RATE_LIMIT_BACKOFF_MS before retrying.
 *  - Per-item failure count tracked in memory: after MAX_ITEM_FAILURES the item
 *    is marked "failed" so it stops blocking the queue indefinitely.
 */

import { db } from "../config/db.js";
import { collectedItems, itemAnalysis } from "../../shared/schema.js";
import { eq, inArray } from "drizzle-orm";
import { analyzeCollectedItem } from "./intelService.js";
import { logger } from "../middleware/logger.js";

const POLL_INTERVAL_MS    = 6_000;
const BATCH_SIZE          = 3;
const MAX_ITEM_FAILURES   = 3;
const RATE_LIMIT_BACKOFF_MS = 90_000; // 90 s cooldown after a 429

let isRunning = false;

// In-memory state (reset on server restart, which is fine)
let rateLimitBackoffUntil: number = 0;           // epoch ms
const itemFailCounts = new Map<number, number>(); // itemId → consecutive failures

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("quota");
}

// ── Single poll tick ──────────────────────────────────────────────────────────

export async function processQueue(systemUserId: number): Promise<void> {
  if (isRunning) return;

  // Honour rate-limit backoff
  if (Date.now() < rateLimitBackoffUntil) {
    const waitSec = Math.ceil((rateLimitBackoffUntil - Date.now()) / 1000);
    logger.debug(`Queue: rate-limit backoff — ${waitSec}s remaining`);
    return;
  }

  isRunning = true;

  try {
    // Exclude items that have hit the failure cap (mark them failed first)
    const exhaustedIds = [...itemFailCounts.entries()]
      .filter(([, count]) => count >= MAX_ITEM_FAILURES)
      .map(([id]) => id);

    if (exhaustedIds.length > 0) {
      await db
        .update(collectedItems)
        .set({ status: "failed", updatedAt: new Date() })
        .where(inArray(collectedItems.id, exhaustedIds))
        .catch(() => {});
      exhaustedIds.forEach((id) => itemFailCounts.delete(id));
    }

    const newItems = await db
      .select()
      .from(collectedItems)
      .where(eq(collectedItems.status, "new"))
      .limit(BATCH_SIZE);

    if (newItems.length === 0) return;

    logger.info(`Queue: processing ${newItems.length} new item(s)`);

    for (const item of newItems) {
      // Skip if this item is being rate-limited mid-batch
      if (Date.now() < rateLimitBackoffUntil) break;

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

        // 3. Persist analysis
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
            description: analysis.description,
            seoScore: analysis.seoScore,
            seoKeywords: analysis.seoKeywords,
            authorAuthority: analysis.authorAuthority,
            meritPassed: analysis.meritPassed,
            isMedical: analysis.isMedical,
            processedAt: new Date(),
          })
          .onConflictDoNothing();

        // 4. Mark reviewed (or archive if merit filter explicitly failed).
        // Use === false so that any unexpected undefined/null from a broken
        // provider does NOT silently archive the item — it falls through to
        // "reviewed" and the analyst can decide manually.
        const nextStatus = analysis.meritPassed === false ? "archived" : "reviewed";
        if (!analysis.meritPassed) {
          logger.info(
            `Queue: item ${item.id} filtered — not medical or low SEO (score ${analysis.seoScore}, medical ${analysis.isMedical})`
          );
        }
        await db
          .update(collectedItems)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(collectedItems.id, item.id));

        itemFailCounts.delete(item.id);
        logger.info(`Queue: ✓ item ${item.id} — "${item.title.slice(0, 45)}"`);

      } catch (err: any) {
        logger.error(`Queue: failed item ${item.id}`, { err: err?.message });

        if (isRateLimitError(err)) {
          // Back off and stop processing this batch
          rateLimitBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          logger.warn(`Queue: rate limit hit — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
          await db
            .update(collectedItems)
            .set({ status: "new", updatedAt: new Date() })
            .where(eq(collectedItems.id, item.id))
            .catch(() => {});
          break; // stop processing remaining items in this batch
        }

        // Non-rate-limit error: increment failure count, reset to new
        const fails = (itemFailCounts.get(item.id) ?? 0) + 1;
        itemFailCounts.set(item.id, fails);

        if (fails >= MAX_ITEM_FAILURES) {
          logger.warn(`Queue: item ${item.id} failed ${fails}x — marking failed`);
          await db
            .update(collectedItems)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(collectedItems.id, item.id))
            .catch(() => {});
        } else {
          await db
            .update(collectedItems)
            .set({ status: "new", updatedAt: new Date() })
            .where(eq(collectedItems.id, item.id))
            .catch(() => {});
        }
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
  setTimeout(tick, 2000);
  setInterval(tick, POLL_INTERVAL_MS);
}
