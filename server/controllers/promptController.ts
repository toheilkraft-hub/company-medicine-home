import { Request, Response } from "express";
import { db } from "../config/db.js";
import { systemPrompts } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { ok, fail, asyncHandler } from "../utils/helpers.js";

export const listPrompts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const rows = await db.query.systemPrompts.findMany({
    where: eq(systemPrompts.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return ok(res, rows);
});

export const createPrompt = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { name, content, isDefault } = req.body;

  if (!name?.trim()) return fail(res, "Name is required");
  if (!content?.trim()) return fail(res, "Content is required");

  // If marking as default, unset previous default
  if (isDefault) {
    await db
      .update(systemPrompts)
      .set({ isDefault: false })
      .where(eq(systemPrompts.userId, userId));
  }

  const [row] = await db
    .insert(systemPrompts)
    .values({ userId, name, content, isDefault: !!isDefault })
    .returning();

  return ok(res, row);
});

export const updatePrompt = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  const { name, content, isDefault } = req.body;

  // If marking as default, unset others
  if (isDefault) {
    await db
      .update(systemPrompts)
      .set({ isDefault: false })
      .where(and(eq(systemPrompts.userId, userId)));
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name;
  if (content !== undefined) patch.content = content;
  if (isDefault !== undefined) patch.isDefault = isDefault;

  const [updated] = await db
    .update(systemPrompts)
    .set(patch)
    .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)))
    .returning();

  if (!updated) return fail(res, "System prompt not found", 404);
  return ok(res, updated);
});

export const deletePrompt = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const deleted = await db
    .delete(systemPrompts)
    .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)))
    .returning();

  if (!deleted.length) return fail(res, "System prompt not found", 404);
  return ok(res, { deleted: true });
});
