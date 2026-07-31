/**
 * analyzeHelpers — shared utilities for the medical-intelligence analysis pipeline.
 *
 * 1. buildMedicalPrompt()  – builds the structured LLM prompt requesting all
 *    required fields including the new SEO / medical-merit fields.
 * 2. coerceAnalysis()      – safely coerces a raw parsed-JSON object into a
 *    fully-typed ItemAnalysisResult, filling in safe defaults for any fields
 *    that the LLM omits, mis-types, or names differently.
 * 3. extractJSON()         – strips markdown fences before JSON.parse so that
 *    models which wrap output in ```json…``` still work.
 */

import type { ItemAnalysisResult } from "../../shared/types.js";

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildMedicalPrompt(item: {
  title: string;
  content: string;
  source: string;
}): string {
  // Strip HTML for cleaner LLM input
  const cleanContent = item.content
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000); // keep within token budget

  return `You are a medical intelligence analyst. Analyse the following item and return ONLY a valid JSON object — no markdown fences, no commentary, no trailing text.

Required JSON fields (all must be present):
{
  "summary": "<≤50-word factual summary of the medical content>",
  "description": "<100–150 word plain-English description suitable for a clinician, no HTML>",
  "intent": "<one of: Research Publication | Treatment Information | Diagnostic Information | Prevention Advice | Medical News | Patient Support | Informational>",
  "industry": "<one of: Healthcare | Medical Research | Health Technology | Health Regulatory | Health Finance>",
  "category": "<one of: Clinical Research | Treatment & Therapy | Diagnosis & Symptoms | Prevention & Public Health | Mental Health | Cardiology | Oncology | Medical News | General Discussion>",
  "sentiment": "<one of: Positive | Negative | Neutral | Mixed>",
  "priorityScore": <integer 1–100, higher = more clinically urgent>,
  "confidenceScore": <integer 1–100, your confidence in this analysis>,
  "suggestedReply": "<professional clinical or editorial response ≤200 words>",
  "isMedical": <boolean, true only if the item is genuinely about human health / medicine>,
  "seoScore": <integer 0–100: score based on title quality 0–25, content depth 0–30, medical keyword density 0–25, source authority 0–20>,
  "seoKeywords": ["<medical keyword found in content>", ...],
  "authorAuthority": <integer 0–100, estimated credibility of the author/publication>,
  "meritPassed": <boolean, MUST be true if and only if isMedical=true AND seoScore>=30>
}

Source: ${item.source}
Title: ${item.title}
Content: ${cleanContent}`;
}

// ── JSON extractor ────────────────────────────────────────────────────────────

export function extractJSON(raw: string): string {
  // Strip leading/trailing markdown fences: ```json … ``` or ``` … ```
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced) return fenced[1].trim();

  // Find first { … } block if no fences
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

// ── Coercion helper ───────────────────────────────────────────────────────────

/** Safely coerce a raw parsed-JSON value into a fully-typed ItemAnalysisResult. */
export function coerceAnalysis(raw: unknown): ItemAnalysisResult {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const seoScore = clampInt(r.seoScore, 0, 100, 40);
  const isMedical = typeof r.isMedical === "boolean" ? r.isMedical : true;

  // meritPassed is ALWAYS recomputed from validated fields — never trust the
  // LLM's own assertion, which may be malformed, hallucinated, or inconsistent.
  const meritPassed = isMedical && seoScore >= 30;

  const SENTIMENTS = ["Positive", "Negative", "Neutral", "Mixed"] as const;

  return {
    summary:          str(r.summary,        "Content analysed."),
    description:      str(r.description,    str(r.summary, "No description available.")),
    intent:           str(r.intent,         "Informational"),
    industry:         str(r.industry,       "Healthcare"),
    category:         str(r.category,       "Medical News"),
    sentiment:        SENTIMENTS.includes(r.sentiment as typeof SENTIMENTS[number])
                        ? (r.sentiment as string)
                        : "Neutral",
    priorityScore:    clampInt(r.priorityScore,    1, 100, 50),
    confidenceScore:  clampInt(r.confidenceScore,  1, 100, 70),
    suggestedReply:   str(r.suggestedReply,  "Thank you for this medical information. Our clinical team will review it."),
    seoScore,
    seoKeywords:      strArray(r.seoKeywords),
    authorAuthority:  clampInt(r.authorAuthority,  0, 100, 60),
    isMedical,
    meritPassed,
  };
}

// ── Mini helpers ──────────────────────────────────────────────────────────────

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(max, Math.max(min, Math.round(v)));
  }
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  }
  return fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}
