/**
 * queueService — step-by-step processing pipeline.
 *
 * Each item progresses through visible steps:
 *   pending → fetching_page → extracting_metadata → checking_medical →
 *   checking_date → running_seo → completed | rejected
 *
 * Status stays "processing" throughout; processingStep provides the
 * fine-grained progress visible in real-time on the Processing tab.
 */

import { db } from "../config/db.js";
import { collectedItems, itemAnalysis } from "../../shared/schema.js";
import { eq, inArray } from "drizzle-orm";
import { analyzeCollectedItem } from "./intelService.js";
import { analyzeSeo, fetchPageMeta } from "./seoService.js";
import { logger } from "../middleware/logger.js";

const POLL_INTERVAL_MS      = 6_000;
const BATCH_SIZE            = 3;
const MAX_ITEM_FAILURES     = 3;
const RATE_LIMIT_BACKOFF_MS = 90_000;

// Step durations (ms) — make each step visible in the UI
const STEP_DELAY: Record<string, number> = {
  fetching_page:        0,    // real fetch time provides the delay
  extracting_metadata:  500,
  checking_medical:     600,
  checking_date:        400,
  running_seo:          700,
};

let isRunning = false;
let rateLimitBackoffUntil: number = 0;
const itemFailCounts = new Map<number, number>();

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("quota");
}

// Medical keyword pre-filter (same list as monitorService)
const MEDICAL_KEYWORDS = [
  "disease", "diagnosis", "treatment", "symptom", "patient", "doctor",
  "medical", "health", "cancer", "therapy", "clinical", "syndrome",
  "disorder", "drug", "medication", "surgery", "hospital", "physician",
  "medicine", "immune", "virus", "bacteria", "infection", "pain",
  "chronic", "acute", "mental health", "depression", "diabetes", "heart",
  "lung", "kidney", "blood", "vaccine", "pharma", "neurology", "oncology",
  "cardiology", "prevention", "epidemic", "pandemic", "condition", "wellness",
];

function isMedicallyRelevant(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => text.includes(kw));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Set step in DB ────────────────────────────────────────────────────────────

async function setStep(itemId: number, step: string): Promise<void> {
  await db
    .update(collectedItems)
    .set({ processingStep: step, updatedAt: new Date() })
    .where(eq(collectedItems.id, itemId));
}

// ── Per-item pipeline ─────────────────────────────────────────────────────────

async function processItem(
  item: typeof collectedItems.$inferSelect,
  systemUserId: number,
): Promise<void> {
  const id = item.id;

  // ── 1. Mark processing + fetching_page ────────────────────────────────────
  await db
    .update(collectedItems)
    .set({ status: "processing", processingStep: "fetching_page", updatedAt: new Date() })
    .where(eq(collectedItems.id, id));

  // Try to fetch actual page for richer metadata
  let richContent = item.content;
  let richTitle   = item.title;

  if (item.url) {
    try {
      const page = await fetchPageMeta(item.url);
      if (page.bodyText && page.bodyText.length > richContent.length) {
        richContent = page.bodyText;
      }
      if (page.title && page.title.length > 5) richTitle = page.title;
    } catch { /* keep original */ }
  } else {
    // No URL — pause so the step is visible
    await sleep(STEP_DELAY.fetching_page + 800);
  }

  // ── 2. Extracting metadata ────────────────────────────────────────────────
  await setStep(id, "extracting_metadata");
  await sleep(STEP_DELAY.extracting_metadata);

  // ── 3. Checking medical relevance ─────────────────────────────────────────
  await setStep(id, "checking_medical");
  const isMedical = isMedicallyRelevant(richTitle, richContent);
  await sleep(STEP_DELAY.checking_medical);

  // ── 4. Checking publish date ──────────────────────────────────────────────
  await setStep(id, "checking_date");
  // collectedAt = article publish date (from RSS pubDate, can be months old)
  // createdAt   = when we actually ingested the item into the DB (always recent)
  // We check createdAt so recently-ingested articles always pass, regardless of
  // how old the original article is. Items older than 7 days in the queue are stale.
  const createdMs  = new Date(item.createdAt).getTime();
  const sevenDays  = 7 * 24 * 60 * 60 * 1000;
  const dateOk = Date.now() - createdMs < sevenDays;
  await sleep(STEP_DELAY.checking_date);

  // ── 5. Running SEO analysis ───────────────────────────────────────────────
  await setStep(id, "running_seo");
  const seo = analyzeSeo(richTitle, richContent, item.url ?? null);
  await sleep(STEP_DELAY.running_seo);

  // ── 6. Full AI analysis (summary, intent, etc.) — non-fatal ─────────────
  let analysis: Awaited<ReturnType<typeof analyzeCollectedItem>> | null = null;
  try {
    analysis = await analyzeCollectedItem(systemUserId, {
      id,
      title: richTitle,
      content: richContent,
      source: item.source,
    });
  } catch (aiErr: any) {
    logger.warn(`Queue: AI analysis failed for item ${id} — using local fallback`, { err: aiErr?.message });
  }

  // Merge / build final values — prefer AI where available, fall back to local
  const cleanText = richContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const mergedSeoScore    = analysis ? Math.max(seo.score, analysis.seoScore ?? 0) : seo.score;
  const mergedSeoKeywords = (seo.keywords.length > 0 ? seo.keywords : analysis?.seoKeywords) ?? [];
  const mergedDescription =
    seo.metaDescription || analysis?.description || cleanText.slice(0, 300);

  const meritPassed = isMedical && dateOk && mergedSeoScore >= 30;

  // Persist analysis — use AI values where available, fall back to local
  const confidenceScore = analysis?.confidenceScore ?? (isMedical ? 72 : 28);
  const priorityScore   = analysis?.priorityScore   ?? Math.min(99, Math.round(mergedSeoScore * 0.9));
  await db
    .insert(itemAnalysis)
    .values({
      itemId: id,
      summary:         analysis?.summary        ?? (mergedDescription || richTitle),
      intent:          analysis?.intent         ?? "Medical Information",
      industry:        analysis?.industry       ?? "Healthcare",
      category:        analysis?.category       ?? "Medical Research",
      sentiment:       analysis?.sentiment      ?? "Neutral",
      priorityScore,
      confidenceScore,
      suggestedReply:  analysis?.suggestedReply ?? "This article has been flagged for clinical review.",
      description:     mergedDescription,
      seoScore:        mergedSeoScore,
      seoKeywords:     mergedSeoKeywords,
      authorAuthority: analysis?.authorAuthority ?? 50,
      meritPassed,
      isMedical,
      processedAt: new Date(),
    })
    .onConflictDoNothing();

  // ── 7. Final status ───────────────────────────────────────────────────────
  const nextStatus = meritPassed ? "reviewed" : "archived";
  const nextStep   = meritPassed ? "completed" : "rejected";

  if (!meritPassed) {
    logger.info(`Queue: item ${id} rejected — medical:${isMedical} date:${dateOk} seo:${mergedSeoScore}`);
  }

  await db
    .update(collectedItems)
    .set({ status: nextStatus, processingStep: nextStep, updatedAt: new Date() })
    .where(eq(collectedItems.id, id));

  itemFailCounts.delete(id);
  logger.info(`Queue: ✓ item ${id} → ${nextStatus} (seo:${mergedSeoScore} medical:${isMedical})`);
}

// ── Single poll tick ──────────────────────────────────────────────────────────

export async function processQueue(systemUserId: number): Promise<void> {
  if (isRunning) return;

  if (Date.now() < rateLimitBackoffUntil) {
    const waitSec = Math.ceil((rateLimitBackoffUntil - Date.now()) / 1000);
    logger.debug(`Queue: rate-limit backoff — ${waitSec}s remaining`);
    return;
  }

  isRunning = true;

  try {
    // Exhaust items that exceeded failure cap
    const exhaustedIds = [...itemFailCounts.entries()]
      .filter(([, count]) => count >= MAX_ITEM_FAILURES)
      .map(([id]) => id);

    if (exhaustedIds.length > 0) {
      await db
        .update(collectedItems)
        .set({ status: "failed", processingStep: "rejected", updatedAt: new Date() })
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
      if (Date.now() < rateLimitBackoffUntil) break;

      try {
        await processItem(item, systemUserId);
      } catch (err: any) {
        logger.error(`Queue: failed item ${item.id}`, { err: err?.message });

        if (isRateLimitError(err)) {
          rateLimitBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          logger.warn(`Queue: rate limit hit — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
          await db
            .update(collectedItems)
            .set({ status: "new", processingStep: "pending", updatedAt: new Date() })
            .where(eq(collectedItems.id, item.id))
            .catch(() => {});
          break;
        }

        const fails = (itemFailCounts.get(item.id) ?? 0) + 1;
        itemFailCounts.set(item.id, fails);

        if (fails >= MAX_ITEM_FAILURES) {
          logger.warn(`Queue: item ${item.id} failed ${fails}x — marking failed`);
          await db
            .update(collectedItems)
            .set({ status: "failed", processingStep: "rejected", updatedAt: new Date() })
            .where(eq(collectedItems.id, item.id))
            .catch(() => {});
        } else {
          await db
            .update(collectedItems)
            .set({ status: "new", processingStep: "pending", updatedAt: new Date() })
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
      logger.error("Queue tick error", { err: e?.message }),
    );

  logger.info("Intelligence processing queue started", { pollMs: POLL_INTERVAL_MS });
  setTimeout(tick, 2000);
  setInterval(tick, POLL_INTERVAL_MS);
}
