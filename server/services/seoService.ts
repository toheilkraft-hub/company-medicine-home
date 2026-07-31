/**
 * seoService — local SEO analysis engine.
 *
 * Calculates an SEO score (0–100) from title, content, and URL
 * without any external API. Weights are tuned for medical content.
 */

export interface SeoAnalysis {
  score: number;           // 0–100 overall
  keywords: string[];      // medical keywords found
  wordCount: number;
  metaDescription: string; // first 160 chars of clean content
  breakdown: {
    titleLength: number;     // 0–20
    urlQuality: number;      // 0–15
    keywordDensity: number;  // 0–25
    wordCount: number;       // 0–20
    readability: number;     // 0–10
    headingStructure: number;// 0–5
    metaDescription: number; // 0–5
  };
}

// Medical keyword list for scoring
const MEDICAL_KEYWORDS = [
  "disease", "diagnosis", "treatment", "symptom", "patient", "doctor",
  "medical", "health", "cancer", "therapy", "clinical", "syndrome",
  "disorder", "drug", "medication", "surgery", "hospital", "physician",
  "medicine", "immune", "virus", "bacteria", "infection", "pain",
  "chronic", "acute", "mental health", "depression", "diabetes", "heart",
  "lung", "kidney", "blood", "vaccine", "pharma", "neurology", "oncology",
  "cardiology", "prevention", "epidemic", "pandemic", "condition", "wellness",
  "study", "research", "trial", "evidence", "guidelines", "pathology",
  "prognosis", "epidemiology", "genomics", "biomarker", "therapeutic",
  "pharmacology", "immunology", "pediatric", "geriatric", "psychiatric",
];

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score title length: ideal 40–70 chars */
function scoreTitleLength(title: string): number {
  const len = title.length;
  if (len >= 40 && len <= 70) return 20;
  if (len >= 25 && len <= 90) return 14;
  if (len >= 10 && len <= 110) return 8;
  return 3;
}

/** Score URL quality: short, clean, no excessive params */
function scoreUrlQuality(url: string | null): number {
  if (!url) return 0;
  try {
    const u = new URL(url);
    const path = u.pathname;
    const hasParams = u.search.length > 1;
    const pathLen = path.length;
    const segCount = path.split("/").filter(Boolean).length;

    if (!hasParams && pathLen <= 60 && segCount <= 4) return 15;
    if (!hasParams && pathLen <= 100) return 10;
    if (pathLen <= 150) return 6;
    return 2;
  } catch {
    return 0;
  }
}

/** Score keyword density in title + content */
function scoreKeywordDensity(title: string, content: string): { score: number; keywords: string[] } {
  const combined = `${title} ${content}`.toLowerCase();
  const found = MEDICAL_KEYWORDS.filter((kw) => combined.includes(kw));
  const unique = [...new Set(found)];
  const count = unique.length;
  const score = count >= 8 ? 25 : count >= 5 ? 20 : count >= 3 ? 14 : count >= 1 ? 8 : 0;
  return { score, keywords: unique.slice(0, 10) };
}

/** Score content word count */
function scoreWordCount(text: string): { score: number; wordCount: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const score = wordCount >= 600 ? 20 : wordCount >= 300 ? 15 : wordCount >= 150 ? 9 : wordCount >= 50 ? 4 : 1;
  return { score, wordCount };
}

/** Score readability — average sentence length (sweet spot 12–22 words) */
function scoreReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length >= 4);
  if (sentences.length === 0) return 3;
  const words = text.split(/\s+/).filter(Boolean).length;
  const avgLen = words / sentences.length;
  if (avgLen >= 12 && avgLen <= 22) return 10;
  if (avgLen >= 8 && avgLen <= 30) return 6;
  return 2;
}

/** Score presence of headings in raw content */
function scoreHeadingStructure(rawContent: string): number {
  const hasHtmlHeadings = /<h[1-6]/i.test(rawContent);
  const hasMarkdownHeadings = /^#{1,6}\s/m.test(rawContent);
  return hasHtmlHeadings || hasMarkdownHeadings ? 5 : 0;
}

/** Score meta description extracted from content */
function scoreMetaDescription(cleanContent: string): { score: number; metaDescription: string } {
  const meta = cleanContent.slice(0, 160).trim();
  const score = meta.length >= 120 ? 5 : meta.length >= 80 ? 3 : meta.length >= 30 ? 1 : 0;
  return { score, metaDescription: meta };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function analyzeSeo(
  title: string,
  rawContent: string,
  url: string | null,
): SeoAnalysis {
  const cleanContent = stripHtml(rawContent);

  const titleScore     = scoreTitleLength(title);
  const urlScore       = scoreUrlQuality(url);
  const { score: kwScore, keywords } = scoreKeywordDensity(title, cleanContent);
  const { score: wcScore, wordCount } = scoreWordCount(cleanContent);
  const readScore      = scoreReadability(cleanContent);
  const headingScore   = scoreHeadingStructure(rawContent);
  const { score: metaScore, metaDescription } = scoreMetaDescription(cleanContent);

  const total = titleScore + urlScore + kwScore + wcScore + readScore + headingScore + metaScore;

  return {
    score: Math.min(100, Math.max(0, total)),
    keywords,
    wordCount,
    metaDescription,
    breakdown: {
      titleLength:      titleScore,
      urlQuality:       urlScore,
      keywordDensity:   kwScore,
      wordCount:        wcScore,
      readability:      readScore,
      headingStructure: headingScore,
      metaDescription:  metaScore,
    },
  };
}

// ── Page fetcher (best-effort) ────────────────────────────────────────────────

export interface FetchedPageMeta {
  title: string | null;
  metaDescription: string | null;
  publishedDate: Date | null;
  bodyText: string | null;
}

/** Try to fetch a URL and extract basic metadata. Times out after 5 s. */
export async function fetchPageMeta(url: string): Promise<FetchedPageMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; iHealBot/1.0; +https://iheal.ai/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);

    if (!resp.ok) return { title: null, metaDescription: null, publishedDate: null, bodyText: null };

    const html = await resp.text();

    // Title
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 300) : null;

    // Meta description
    const metaDescMatch =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html) ??
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i.exec(html);
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim().slice(0, 300) : null;

    // Published date
    const pubMatch =
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i.exec(html) ??
      /<time[^>]+datetime=["']([^"']+)["']/i.exec(html);
    let publishedDate: Date | null = null;
    if (pubMatch) {
      const d = new Date(pubMatch[1]);
      if (!isNaN(d.getTime())) publishedDate = d;
    }

    // Body text (strip scripts/styles, get plain text)
    const bodyText = stripHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, ""),
    ).slice(0, 5000);

    return { title, metaDescription, publishedDate, bodyText };
  } catch {
    clearTimeout(timer);
    return { title: null, metaDescription: null, publishedDate: null, bodyText: null };
  }
}
