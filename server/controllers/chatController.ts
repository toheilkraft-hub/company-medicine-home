import { Request, Response } from "express";
import { db } from "../config/db.js";
import { conversations, messages, settings } from "../../shared/schema.js";
import { eq, and, desc, ilike } from "drizzle-orm";
import { ok, fail, asyncHandler } from "../utils/helpers.js";
import {
  generateResponse,
  generateStream,
  summarizeText,
  listModels,
} from "../services/aiService.js";
import type { AIMessage } from "../../shared/types.js";
import { logger } from "../middleware/logger.js";

// ─── Models ───────────────────────────────────────────────────────────────────

export const getModels = asyncHandler(async (req: Request, res: Response) => {
  const models = await listModels(req.session.userId!);
  return ok(res, models);
});

// ─── Conversations ─────────────────────────────────────────────────────────────

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { search } = req.query;

  const rows = await db.query.conversations.findMany({
    where: search
      ? and(eq(conversations.userId, userId), ilike(conversations.title, `%${search}%`))
      : eq(conversations.userId, userId),
    orderBy: [desc(conversations.updatedAt)],
    columns: { userId: false },
  });
  return ok(res, rows);
});

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { title, model, provider, systemPromptId, systemPromptContent } = req.body;

  const [conv] = await db
    .insert(conversations)
    .values({
      userId,
      title: title ?? "New Conversation",
      model: model ?? "mock-standard",
      provider: provider ?? "mock",
      systemPromptId: systemPromptId ?? null,
      systemPromptContent: systemPromptContent ?? null,
    })
    .returning();

  return ok(res, conv);
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    with: {
      messages: { orderBy: [desc(messages.createdAt)] },
    },
  });

  if (!conv) return fail(res, "Conversation not found", 404);
  conv.messages = (conv.messages as typeof conv.messages).reverse();
  return ok(res, conv);
});

export const updateConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  const { title, pinned, model, provider, systemPromptContent } = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) patch.title = title;
  if (pinned !== undefined) patch.pinned = pinned;
  if (model !== undefined) patch.model = model;
  if (provider !== undefined) patch.provider = provider;
  if (systemPromptContent !== undefined) patch.systemPromptContent = systemPromptContent;

  const [updated] = await db
    .update(conversations)
    .set(patch)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();

  return ok(res, updated);
});

export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return ok(res, { deleted: true });
});

export const clearConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);

  // verify ownership
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!conv) return fail(res, "Conversation not found", 404);

  await db.delete(messages).where(eq(messages.conversationId, id));
  return ok(res, { cleared: true });
});

// ─── Messages / Non-streaming send ────────────────────────────────────────────

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const convId = parseInt(req.params.id, 10);
  const { content } = req.body;

  if (!content?.trim()) return fail(res, "Message content is required");

  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, convId), eq(conversations.userId, userId)),
  });
  if (!conv) return fail(res, "Conversation not found", 404);

  // Persist user message
  const [userMsg] = await db
    .insert(messages)
    .values({ conversationId: convId, role: "user", content })
    .returning();

  // Load history (last 40 messages for context)
  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, convId),
    orderBy: [desc(messages.createdAt)],
    limit: 40,
  });
  const historyAsc: AIMessage[] = history.reverse().map((m) => ({
    role: m.role as AIMessage["role"],
    content: m.content,
  }));

  // Load user settings for model/temp override
  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  const aiResponse = await generateResponse(userId, historyAsc, {
    model: conv.model ?? userSettings?.defaultModel ?? undefined,
    temperature: parseFloat(userSettings?.temperature ?? "0.7"),
    maxTokens: userSettings?.maxTokens ?? 2048,
    systemPrompt: conv.systemPromptContent ?? undefined,
  });

  const [assistantMsg] = await db
    .insert(messages)
    .values({
      conversationId: convId,
      role: "assistant",
      content: aiResponse.content,
      metadata: {
        model: aiResponse.model,
        provider: aiResponse.provider,
        tokensUsed: aiResponse.tokensUsed,
        latencyMs: aiResponse.latencyMs,
        finishReason: aiResponse.finishReason,
      },
    })
    .returning();

  // Auto-title after first exchange
  if (conv.title === "New Conversation") {
    const title = await summarizeText(userId, content);
    await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, convId));
  } else {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));
  }

  return ok(res, { userMessage: userMsg, assistantMessage: assistantMsg });
});

// ─── Streaming send via SSE ───────────────────────────────────────────────────

export const streamMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const convId = parseInt(req.params.id, 10);
  const { content } = req.body;

  if (!content?.trim()) return fail(res, "Message content is required");

  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, convId), eq(conversations.userId, userId)),
  });
  if (!conv) return fail(res, "Conversation not found", 404);

  // Persist user message first
  const [userMsg] = await db
    .insert(messages)
    .values({ conversationId: convId, role: "user", content })
    .returning();

  // Load history
  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, convId),
    orderBy: [desc(messages.createdAt)],
    limit: 40,
  });
  const historyAsc: AIMessage[] = history.reverse().map((m) => ({
    role: m.role as AIMessage["role"],
    content: m.content,
  }));

  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send the user message ID so the client can correlate
  send({ type: "start", userMessageId: userMsg.id });

  let fullContent = "";
  let finalMetadata: Record<string, unknown> = {};

  try {
    const gen = generateStream(userId, historyAsc, {
      model: conv.model ?? userSettings?.defaultModel ?? undefined,
      temperature: parseFloat(userSettings?.temperature ?? "0.7"),
      maxTokens: userSettings?.maxTokens ?? 2048,
      systemPrompt: conv.systemPromptContent ?? undefined,
    });

    while (true) {
      const { value, done } = await gen.next();
      if (done) {
        // value is the final AIResponse
        const aiResponse = value as any;
        finalMetadata = {
          model: aiResponse.model,
          provider: aiResponse.provider,
          tokensUsed: aiResponse.tokensUsed,
          latencyMs: aiResponse.latencyMs,
          finishReason: aiResponse.finishReason,
        };
        break;
      }
      fullContent += value as string;
      send({ type: "token", content: value });
    }

    // Persist the full assistant message
    const [assistantMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: fullContent,
        metadata: finalMetadata,
      })
      .returning();

    // Auto-title
    if (conv.title === "New Conversation") {
      const title = await summarizeText(userId, content);
      await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    } else {
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    }

    send({
      type: "done",
      assistantMessage: assistantMsg,
      metadata: finalMetadata,
    });
  } catch (err: any) {
    logger.error("streamMessage error", { message: err.message });
    send({ type: "error", error: err.message });
  } finally {
    res.end();
  }
});
