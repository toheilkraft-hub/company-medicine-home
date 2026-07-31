/**
 * monitorService — polls active monitors every 5 minutes and ingests
 * new items from Reddit, Quora, or the web (via DuckDuckGo) into the inbox.
 */

import { db } from "../config/db.js";
import { monitors, collectedItems } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Feed item shape ───────────────────────────────────────────────────────────

interface FeedItem {
  title: string;
  url: string;
  content: string;
  author?: string;
  publishedAt?: Date;
}

// ── Time filter type ──────────────────────────────────────────────────────────

export type RedditTimeFilter = "hour" | "day" | "week" | "month" | "year" | "all";

// ── RSS / Atom parser ─────────────────────────────────────────────────────────

function extractTag(block: string, tag: string): string {
  const cdata = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`,
    "i",
  ).exec(block);
  if (cdata) return cdata[1].trim();
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
    const url = extractTag(block, "link") || extractAtomLinkHref(block);
    const content = (
      extractTag(block, "content:encoded") ||
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content") ||
      title
    ).slice(0, 3000);
    const author =
      extractTag(block, "dc:creator") || extractTag(block, "author") || undefined;
    const pubStr =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      extractTag(block, "dc:date");
    const publishedAt = pubStr ? new Date(pubStr) : undefined;
    if (since && publishedAt && publishedAt <= since) continue;
    if (!url) continue;
    items.push({ title, url, content, author: author || undefined, publishedAt });
  }

  return items.slice(0, 10);
}

// ── Reddit fetcher ────────────────────────────────────────────────────────────

export async function fetchRedditItems(
  topic: string,
  subreddit: string | undefined,
  since?: Date,
  timeFilter: RedditTimeFilter = "week",
): Promise<FeedItem[]> {
  // Try Reddit's direct JSON API first; fall back to DuckDuckGo on 403/429
  // (Replit's outbound IPs are often rate-limited or blocked by Reddit).
  try {
    const base = subreddit
      ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
      : "https://www.reddit.com/search.json";

    const params = new URLSearchParams({
      q: topic,
      sort: "new",
      limit: "25",
      t: timeFilter,
      ...(subreddit ? { restrict_sr: "1" } : {}),
    });

    const resp = await fetch(`${base}?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (resp.status === 403 || resp.status === 429) {
      throw new Error(`Reddit API ${resp.status} — falling back to DDG`);
    }
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

    return items.slice(0, 15);
  } catch (directErr: any) {
    // Fallback: use HN Algolia (closest open Q&A/discussion source)
    logger.warn(`Reddit direct fetch failed, using HN fallback`, { reason: directErr?.message });
    return fetchHNItems(topic, since, timeFilter);
  }
}

// ── Google News RSS (free, no auth, topic-exact) ──────────────────────────────
// Google News RSS is a search-engine backed feed: every result is about the
// query. We parse it with the existing RSS parser and apply a `since` date
// filter so we only ingest items newer than the last run.

async function fetchGoogleNewsItems(
  query: string,
  since?: Date,
): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  const url = `https://news.google.com/rss/search?${params}`;
  const xml = await fetch(url, {
    headers: { "User-Agent": "iHeal-AI-Monitor/1.0" },
  }).then((r) => {
    if (!r.ok) throw new Error(`Google News RSS ${r.status}`);
    return r.text();
  });

  // Google News wraps real URLs in a redirect — extract the actual source URL
  // from the <link> tag before the <title> in each item.
  const rawItems = parseRSSFeed(xml, since);

  // Unwrap Google's redirect links (format: https://news.google.com/rss/articles/...)
  // The real URL is embedded as the last segment after base64 decoding — too
  // fragile. Instead, keep the Google link but strip the /rss/ prefix so it
  // opens as a readable page in a browser.
  return rawItems.map((item) => ({
    ...item,
    url: item.url.replace(
      /^https:\/\/news\.google\.com\/rss\//,
      "https://news.google.com/",
    ),
  }));
}

// ── Web search: Google News (primary) ────────────────────────────────────────

async function fetchWebItems(
  query: string,
  since?: Date,
  _timeFilter: RedditTimeFilter = "week",
): Promise<FeedItem[]> {
  // Google News RSS is search-engine backed, so results are always on-topic.
  // No secondary source needed — this is more accurate than any scraper.
  return fetchGoogleNewsItems(query, since);
}

// ── Per-source fetcher dispatcher ─────────────────────────────────────────────

async function fetchForSource(
  source: string,
  topic: string,
  cfg: Record<string, string>,
  since: Date | undefined,
  timeFilter: RedditTimeFilter,
): Promise<FeedItem[]> {
  switch (source) {
    case "reddit":
      return fetchRedditItems(topic, cfg.subreddit || undefined, since, timeFilter);
    case "quora":
      // Quora blocks scraping; use web search as a proxy for Q&A-style results
      return fetchWebItems(topic, since, timeFilter);
    case "web":
      return fetchWebItems(topic, since, timeFilter);
    case "rss":
      if (!cfg.url) return [];
      {
        const xml = await fetch(cfg.url, {
          headers: { "User-Agent": "iHeal-AI-Monitor/1.0" },
        }).then((r) => {
          if (!r.ok) throw new Error(`RSS fetch ${r.status}`);
          return r.text();
        });
        return parseRSSFeed(xml, since);
      }
    default:
      return [];
  }
}

// ── Ingest items into the DB (dedup by URL) ───────────────────────────────────

async function ingestItems(
  userId: number,
  monitorId: number,
  topic: string,
  source: string,
  items: FeedItem[],
): Promise<number> {
  let ingested = 0;
  for (const item of items) {
    if (item.url) {
      const existing = await db
        .select({ id: collectedItems.id })
        .from(collectedItems)
        .where(eq(collectedItems.url, item.url))
        .limit(1);
      if (existing.length > 0) continue;
    }
    await db.insert(collectedItems).values({
      userId,
      title: item.title,
      content: item.content,
      source,
      url: item.url || null,
      author: item.author || null,
      collectedAt: item.publishedAt ?? new Date(),
      tags: [topic],
      status: "new",
    });
    ingested++;
  }
  return ingested;
}

// ── Run a single monitor ──────────────────────────────────────────────────────

async function runMonitor(
  monitor: typeof monitors.$inferSelect,
): Promise<number> {
  const since = monitor.lastRunAt ?? undefined;
  const cfg = (monitor.sourceConfig ?? {}) as Record<string, string>;
  const timeFilter = (cfg.timeFilter as RedditTimeFilter) || "week";

  // Determine which sources to run
  let sources: string[];
  if (monitor.source === "multi") {
    sources = cfg.sources ? JSON.parse(cfg.sources) : ["reddit"];
  } else {
    sources = [monitor.source];
  }

  let totalIngested = 0;

  for (const src of sources) {
    try {
      const items = await fetchForSource(
        src,
        monitor.topic,
        cfg,
        since ?? undefined,
        timeFilter,
      );
      const n = await ingestItems(
        monitor.userId,
        monitor.id,
        monitor.topic,
        src,
        items,
      );
      totalIngested += n;
      if (n > 0) {
        logger.info(`Monitor "${monitor.name}" [${src}]: ingested ${n} item(s)`);
      }
    } catch (err: any) {
      logger.warn(`Monitor "${monitor.name}" [${src}] fetch failed`, {
        err: err?.message,
      });
    }
  }

  await db
    .update(monitors)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(monitors.id, monitor.id));

  return totalIngested;
}

// ── Public: run a specific monitor immediately ────────────────────────────────

export async function runMonitorById(
  monitorId: number,
  userId: number,
): Promise<{ ingested: number }> {
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);

  if (!monitor) throw new Error("Monitor not found");
  const ingested = await runMonitor(monitor);
  return { ingested };
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
      await runMonitor(monitor);
    } catch (err: any) {
      logger.warn(`Monitor "${monitor.name}" tick failed`, {
        err: err?.message,
      });
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startMonitorService(): void {
  const run = () =>
    tick().catch((e) =>
      logger.error("Monitor tick error", { err: e?.message }),
    );

  logger.info("Monitor service started", { pollMs: POLL_INTERVAL_MS });
  // First run 15 s after startup; then every 5 min
  setTimeout(run, 15_000);
  setInterval(run, POLL_INTERVAL_MS);
}
