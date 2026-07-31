import { Request, Response } from "express";
import { db } from "../config/db.js";
import { conversations, messages, settings, collectedItems } from "../../shared/schema.js";
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

  // Fall back to user's saved settings if not explicitly provided
  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  const [conv] = await db
    .insert(conversations)
    .values({
      userId,
      title: title ?? "New Conversation",
      model: model ?? userSettings?.defaultModel ?? "gemini-flash-latest",
      provider: provider ?? userSettings?.provider ?? "mock",
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

  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!conv) return fail(res, "Conversation not found", 404);

  await db.delete(messages).where(eq(messages.conversationId, id));
  return ok(res, { cleared: true });
});

// ─── Research intent detection ─────────────────────────────────────────────────

const RESEARCH_KEYWORDS = [
  "find", "search", "research", "look for", "look up", "discover",
  "gather", "collect", "scan", "investigate", "explore", "fetch",
  "what are", "list of", "show me", "tell me about", "report on",
  "feed inbox", "add to inbox", "send to inbox", "track", "monitor for",
  "analyze", "summarise", "summarize",
];

function isResearchRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return RESEARCH_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Push AI findings to Intelligence Inbox ────────────────────────────────────

interface InboxItem {
  title: string;
  content: string;
  source: string;
  url?: string;
  tags?: string[];
}

async function pushFindingsToInbox(
  userId: number,
  userQuery: string,
  aiResponseText: string,
  model: string | undefined,
  temperature: number,
): Promise<InboxItem[]> {
  const extractPrompt = `The user asked: "${userQuery}"

Your previous response was:
${aiResponseText.slice(0, 3000)}

Now extract up to 6 discrete intelligence items from your response that are worth saving to the user's Intelligence Inbox.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact shape:
[
  {
    "title": "Short descriptive title (max 80 chars)",
    "content": "Key details and findings (max 400 chars)",
    "source": "ai-research",
    "url": "https://... or null if none mentioned",
    "tags": ["tag1", "tag2"]
  }
]

If there are no distinct factual items to extract, return an empty array: []`;

  try {
    const response = await generateResponse(userId, [{ role: "user", content: extractPrompt }], {
      model,
      temperature: 0.2,
      maxTokens: 1200,
    });

    // Strip markdown fences if present
    const raw = response.content.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const items: InboxItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    // Insert each item into collected_items
    const inserted: InboxItem[] = [];
    for (const item of items.slice(0, 6)) {
      if (!item.title?.trim() || !item.content?.trim()) continue;
      await db.insert(collectedItems).values({
        userId,
        title: item.title.slice(0, 200),
        content: item.content.slice(0, 2000),
        source: "ai-research",
        url: item.url && item.url !== "null" ? item.url : null,
        author: "AI Chat",
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 5) : [],
        status: "new",
        collectedAt: new Date(),
      });
      inserted.push(item);
    }

    logger.info("Chat → Inbox: pushed findings", {
      userId,
      count: inserted.length,
      query: userQuery.slice(0, 60),
    });

    return inserted;
  } catch (err: any) {
    logger.warn("Chat → Inbox: extraction failed", { err: err?.message });
    return [];
  }
}

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

  const [userMsg] = await db
    .insert(messages)
    .values({ conversationId: convId, role: "user", content })
    .returning();

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

  if (conv.title === "New Conversation") {
    const title = await summarizeText(userId, content);
    await db.update(conversations).set({ title, updatedAt: new Date() }).where(eq(conversations.id, convId));
  } else {
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, convId));
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

  const [userMsg] = await db
    .insert(messages)
    .values({ conversationId: convId, role: "user", content })
    .returning();

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

  const FALLBACK_MODEL = "gemini-flash-latest";
  const activeModel = conv.model ?? userSettings?.defaultModel ?? FALLBACK_MODEL;
  const activeTemp  = parseFloat(userSettings?.temperature ?? "0.7");

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: "start", userMessageId: userMsg.id });

  /** Returns true if the error indicates the model is unavailable/deprecated. */
  const isModelUnavailable = (err: any) => {
    const msg: string = err?.message ?? "";
    return (
      msg.includes("no longer available") ||
      msg.includes("not available with your API key") ||
      msg.includes("404") ||
      msg.toLowerCase().includes("not found")
    );
  };

  /** Auto-heal: update DB so the bad model isn't used again. */
  const healModel = async () => {
    await Promise.all([
      db.update(conversations).set({ model: FALLBACK_MODEL, updatedAt: new Date() }).where(eq(conversations.id, convId)),
      db.update(settings).set({ defaultModel: FALLBACK_MODEL, updatedAt: new Date() }).where(eq(settings.userId, userId)),
    ]).catch(() => {/* non-fatal */});
    logger.warn("Auto-healed model to fallback", { from: activeModel, to: FALLBACK_MODEL });
  };

  const streamWithModel = (model: string | undefined) =>
    generateStream(userId, historyAsc, {
      model,
      temperature: activeTemp,
      maxTokens: userSettings?.maxTokens ?? 2048,
      systemPrompt: conv.systemPromptContent ?? undefined,
    });

  let fullContent = "";
  let finalMetadata: Record<string, unknown> = {};

  // Try with the saved model; if unavailable, auto-retry with the fallback.
  const runStream = async (gen: ReturnType<typeof generateStream>) => {
    while (true) {
      const { value, done } = await gen.next();
      if (done) {
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
  };

  try {
    try {
      await runStream(streamWithModel(activeModel));
    } catch (err: any) {
      if (isModelUnavailable(err) && activeModel !== FALLBACK_MODEL) {
        await healModel();
        fullContent = "";
        send({ type: "model_fallback", from: activeModel, to: FALLBACK_MODEL });
        await runStream(streamWithModel(FALLBACK_MODEL));
      } else {
        throw err;
      }
    }

    const [assistantMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: fullContent,
        metadata: finalMetadata,
      })
      .returning();

    if (conv.title === "New Conversation") {
      const title = await summarizeText(userId, content);
      await db.update(conversations).set({ title, updatedAt: new Date() }).where(eq(conversations.id, convId));
    } else {
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, convId));
    }

    send({ type: "done", assistantMessage: assistantMsg, metadata: finalMetadata });

    // ── Chat → Inbox: push findings if this was a research request ─────────
    if (isResearchRequest(content) && fullContent.length > 100) {
      try {
        const pushed = await pushFindingsToInbox(userId, content, fullContent, activeModel, activeTemp);
        if (pushed.length > 0) {
          send({
            type: "inbox_push",
            count: pushed.length,
            items: pushed.map((i) => ({ title: i.title, source: i.source })),
          });
        }
      } catch (e: any) {
        logger.warn("inbox_push failed silently", { err: e?.message });
      }
    }

  } catch (err: any) {
    logger.error("streamMessage error", { message: err.message });
    send({ type: "error", error: err.message });
  } finally {
    res.end();
  }
});
