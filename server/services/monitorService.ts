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
}

// ── DuckDuckGo HTML fetcher (Quora / Web) ─────────────────────────────────────

async function fetchDDGItems(
  query: string,
  siteFilter: string | undefined, // e.g. "quora.com" or undefined for web
  timeFilter: RedditTimeFilter = "week",
): Promise<FeedItem[]> {
  const q = siteFilter ? `${query} site:${siteFilter}` : query;

  // DDG time-filter param: d=day, w=week, m=month, y=year
  const dfMap: Record<string, string> = {
    hour: "d", day: "d", week: "w", month: "m", year: "y", all: "",
  };
  const df = dfMap[timeFilter] ?? "w";

  const params = new URLSearchParams({ q, ia: "web" });
  if (df) params.set("df", df);

  const resp = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!resp.ok) throw new Error(`DDG search ${resp.status}`);

  const html = await resp.text();
  const items: FeedItem[] = [];

  // Extract result titles + hrefs
  const titleRe =
    /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  // Extract snippets
  const snippetRe =
    /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const titleMatches = [...html.matchAll(titleRe)];
  const snippetMatches = [...html.matchAll(snippetRe)];

  for (let i = 0; i < Math.min(titleMatches.length, 15); i++) {
    let href = titleMatches[i][1];
    const rawTitle = titleMatches[i][2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    // Decode DDG redirect URL → real URL
    if (href.includes("uddg=") || href.startsWith("/l/?")) {
      try {
        const full = href.startsWith("http")
          ? href
          : `https://duckduckgo.com${href}`;
        const u = new URL(full);
        const uddg = u.searchParams.get("uddg");
        if (uddg) href = decodeURIComponent(uddg);
      } catch {
        // keep original
      }
    }

    if (!rawTitle || !href || href.startsWith("//duckduckgo")) continue;
    if (siteFilter && !href.includes(siteFilter)) continue;

    const snippet = (snippetMatches[i]?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .trim();

    items.push({
      title: rawTitle.slice(0, 200),
      url: href,
      content: (snippet || rawTitle).slice(0, 2000),
    });
  }

  return items;
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
      return fetchDDGItems(topic, "quora.com", timeFilter);
    case "web":
      return fetchDDGItems(topic, undefined, timeFilter);
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
