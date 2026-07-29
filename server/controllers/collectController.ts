/**
 * collectController — receives new intelligence items from external sources.
 *
 * This is the standard ingestion interface. Future collectors (Reddit, RSS,
 * email, webhooks, CRM) will POST to /api/collect with the same payload shape,
 * so the AI processing engine never needs to change.
 */

import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { collectedItems } from "../../shared/schema.js";
import { ok, fail, asyncHandler } from "../utils/helpers.js";

// ── Ingest a new item ─────────────────────────────────────────────────────────

export const collectItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const {
    title,
    content,
    source = "manual",
    url,
    author,
    collectedAt,
    tags = [],
  } = req.body as {
    title?: string;
    content?: string;
    source?: string;
    url?: string;
    author?: string;
    collectedAt?: string;
    tags?: string[];
  };

  if (!title?.trim()) return fail(res, "title is required");
  if (!content?.trim()) return fail(res, "content is required");

  const [inserted] = await db
    .insert(collectedItems)
    .values({
      userId,
      title: title.trim(),
      content: content.trim(),
      source: source.trim() || "manual",
      url: url?.trim() || undefined,
      author: author?.trim() || undefined,
      collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
      tags: Array.isArray(tags) ? tags : [],
      status: "new",
    })
    .returning();

  ok(res, inserted);
});
