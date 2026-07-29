/**
 * monitorService — polls active monitors every 60 seconds and ingests
 * new items from Reddit (public JSON API) or RSS/Atom feeds into the inbox.
 */

import { db } from "../config/db.js";
import { monitors, collectedItems } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

const POLL_INTERVAL_MS = 60_000;

// ── Feed item shape ───────────────────────────────────────────────────────────

interface FeedItem {
  title: string;
  url: string;
  content: string;
  author?: string;
  publishedAt?: Date;
}

// ── RSS / Atom parser ─────────────────────────────────────────────────────────

function extractTag(block: string, tag: string): string {
  // CDATA variant
  const cdata = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`,
    "i",
  ).exec(block);
  if (cdata) return cdata[1].trim();
  // Plain variant
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (plain) return plain[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

function extractAtomLinkHref(block: string): string {
  const m = /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  return m ? m[1] : "";
}

function parseRSSFeed(xml: string, since?: Date): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const itemTag = isAtom ? "entry" : "item";
  const re = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, "gi");
  const items: FeedItem[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const block = m[1];

    const title = extractTag(block, "title") || "Untitled";
    const url =
      extractTag(block, "link") ||
      extractAtomLinkHref(block);
    const content = (
      extractTag(block, "content:encoded") ||
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content") ||
      title
    ).slice(0, 3000);
    const author =
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") ||
      undefined;
    const pubStr =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      extractTag(block, "dc:date");

    const publishedAt = pubStr ? new Date(pubStr) : undefined;

    // Skip items older than lastRunAt
    if (since && publishedAt && publishedAt <= since) continue;
    if (!url) continue;

    items.push({
      title,
      url,
      content,
      author: author || undefined,
      publishedAt,
    });
  }

  return items.slice(0, 10);
}

// ── Reddit fetcher (public JSON API — no auth required) ───────────────────────

async function fetchRedditItems(
  topic: string,
  subreddit: string | undefined,
  since?: Date,
): Promise<FeedItem[]> {
  const base = subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
    : "https://www.reddit.com/search.json";

  const params = new URLSearchParams({
    q: topic,
    sort: "new",
    limit: "10",
    t: "week",
    ...(subreddit ? { restrict_sr: "1" } : {}),
  });

  const resp = await fetch(`${base}?${params}`, {
    headers: {
      "User-Agent": "iHeal-AI-Monitor/1.0",
    },
  });

  if (!resp.ok) throw new Error(`Reddit API ${resp.status}`);

  const data = (await resp.json()) as any;
  const posts: any[] = data?.data?.children ?? [];

  const items: FeedItem[] = [];
  for (const child of posts) {
    const p = child.data;
    const publishedAt = new Date(p.created_utc * 1000);
    if (since && publishedAt <= since) continue;
    items.push({
      title: p.title,
      url: `https://reddit.com${p.permalink}`,
      content: (p.selftext || p.title).slice(0, 3000),
      author: `u/${p.author}`,
      publishedAt,
    });
  }

  return items.slice(0, 10);
}

// ── Run a single monitor ──────────────────────────────────────────────────────

async function runMonitor(monitor: typeof monitors.$inferSelect): Promise<number> {
  const since = monitor.lastRunAt ?? undefined;
  const cfg = (monitor.sourceConfig ?? {}) as Record<string, string>;
  let items: FeedItem[] = [];

  if (monitor.source === "reddit") {
    items = await fetchRedditItems(
      monitor.topic,
      cfg.subreddit || undefined,
      since ?? undefined,
    );
  } else if (monitor.source === "rss") {
    if (!cfg.url) return 0;
    const xml = await fetch(cfg.url, {
      headers: { "User-Agent": "iHeal-AI-Monitor/1.0" },
    }).then((r) => {
      if (!r.ok) throw new Error(`RSS fetch ${r.status} from ${cfg.url}`);
      return r.text();
    });
    items = parseRSSFeed(xml, since ?? undefined);
  }

  if (items.length === 0) {
    await db
      .update(monitors)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(monitors.id, monitor.id));
    return 0;
  }

  let ingested = 0;
  for (const item of items) {
    // URL-based deduplication — skip if this URL is already in the inbox
    if (item.url) {
      const existing = await db
        .select({ id: collectedItems.id })
        .from(collectedItems)
        .where(eq(collectedItems.url, item.url))
        .limit(1);
      if (existing.length > 0) continue;
    }

    await db.insert(collectedItems).values({
      userId: monitor.userId,
      title: item.title,
      content: item.content,
      source: monitor.source,
      url: item.url || null,
      author: item.author || null,
      collectedAt: item.publishedAt ?? new Date(),
      tags: [monitor.topic],
      status: "new",
    });
    ingested++;
  }

  // Always update lastRunAt so the next poll only fetches newer items
  await db
    .update(monitors)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(monitors.id, monitor.id));

  return ingested;
}

// ── Tick: process all active monitors ────────────────────────────────────────

async function tick(): Promise<void> {
  const active = await db
    .select()
    .from(monitors)
    .where(eq(monitors.status, "active"));

  if (active.length === 0) return;

  for (const monitor of active) {
    try {
      const n = await runMonitor(monitor);
      if (n > 0) {
        logger.info(`Monitor "${monitor.name}": ingested ${n} new item(s)`, {
          source: monitor.source,
          topic: monitor.topic,
        });
      }
    } catch (err: any) {
      logger.warn(`Monitor "${monitor.name}" fetch failed`, {
        err: err?.message,
      });
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startMonitorService(): void {
  const run = () =>
    tick().catch((e) => logger.error("Monitor tick error", { err: e?.message }));

  logger.info("Monitor service started", { pollMs: POLL_INTERVAL_MS });
  // First run 10 s after startup; then every 60 s
  setTimeout(run, 10_000);
  setInterval(run, POLL_INTERVAL_MS);
}
