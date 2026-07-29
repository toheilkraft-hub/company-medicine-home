import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { collectedItems, itemAnalysis } from "../../shared/schema.js";
import { eq, desc, and, inArray } from "drizzle-orm";
import { ok, fail, asyncHandler, parsePagination } from "../utils/helpers.js";
import type { ItemStatus } from "../../shared/types.js";

const VALID_STATUSES: ItemStatus[] = ["new", "processing", "reviewed", "archived"];

// ── List items ────────────────────────────────────────────────────────────────

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const status = req.query.status as string | undefined;

  // Build filter
  const filters = [eq(collectedItems.userId, userId)];
  if (status && status !== "all" && VALID_STATUSES.includes(status as ItemStatus)) {
    filters.push(eq(collectedItems.status, status));
  }

  const rows = await db
    .select()
    .from(collectedItems)
    .leftJoin(itemAnalysis, eq(itemAnalysis.itemId, collectedItems.id))
    .where(and(...filters))
    .orderBy(desc(collectedItems.collectedAt))
    .limit(limit)
    .offset(offset);

  const items = rows.map(({ collected_items: item, item_analysis: analysis }) => ({
    ...item,
    analysis: analysis ?? null,
  }));

  // Count totals per status for the filter tabs
  const allRows = await db
    .select()
    .from(collectedItems)
    .where(eq(collectedItems.userId, userId));

  const counts = { new: 0, processing: 0, reviewed: 0, archived: 0, all: allRows.length };
  for (const r of allRows) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }

  ok(res, { items, counts });
});

// ── Get single item ───────────────────────────────────────────────────────────

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return fail(res, "Invalid item ID");

  const rows = await db
    .select()
    .from(collectedItems)
    .leftJoin(itemAnalysis, eq(itemAnalysis.itemId, collectedItems.id))
    .where(and(eq(collectedItems.id, id), eq(collectedItems.userId, userId)));

  if (!rows.length) return fail(res, "Item not found", 404);

  const { collected_items: item, item_analysis: analysis } = rows[0];
  ok(res, { ...item, analysis: analysis ?? null });
});

// ── Update item status ────────────────────────────────────────────────────────

export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return fail(res, "Invalid item ID");

  const { status } = req.body as { status: string };
  if (!status || !VALID_STATUSES.includes(status as ItemStatus)) {
    return fail(res, `status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const updated = await db
    .update(collectedItems)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(collectedItems.id, id), eq(collectedItems.userId, userId)))
    .returning();

  if (!updated.length) return fail(res, "Item not found", 404);
  ok(res, updated[0]);
});
