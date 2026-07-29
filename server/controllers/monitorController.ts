import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { monitors } from "../../shared/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { ok, fail, asyncHandler } from "../utils/helpers.js";

export const listMonitors = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const monitorList = await db
    .select()
    .from(monitors)
    .where(eq(monitors.userId, userId))
    .orderBy(desc(monitors.createdAt));
  ok(res, { monitors: monitorList });
});

export const createMonitor = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { name, topic, source, sourceConfig } = req.body as {
    name?: string;
    topic?: string;
    source?: string;
    sourceConfig?: Record<string, string>;
  };

  if (!topic?.trim()) return fail(res, "topic is required");
  if (!source) return fail(res, "source is required");
  if (source === "rss" && !sourceConfig?.url?.trim()) {
    return fail(res, "RSS feed URL is required");
  }

  const [monitor] = await db
    .insert(monitors)
    .values({
      userId,
      name: (name || topic).trim(),
      topic: topic.trim(),
      source,
      sourceConfig: sourceConfig ?? {},
      status: "active",
    })
    .returning();

  ok(res, { monitor });
});

export const updateMonitor = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return fail(res, "invalid id");

  const { status } = req.body as { status?: string };
  if (!status) return fail(res, "status is required");

  const [updated] = await db
    .update(monitors)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
    .returning();

  if (!updated) return fail(res, "Monitor not found", 404);
  ok(res, { monitor: updated });
});

export const deleteMonitor = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return fail(res, "invalid id");

  await db
    .delete(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)));
  ok(res, {});
});

export const pauseAll = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  await db
    .update(monitors)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(monitors.userId, userId), eq(monitors.status, "active")));
  ok(res, {});
});

export const stopAll = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  await db
    .update(monitors)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(eq(monitors.userId, userId));
  ok(res, {});
});
