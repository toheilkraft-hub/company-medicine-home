import { Request, Response } from "express";
import { db } from "../config/db.js";
import { conversations, messages, users } from "../../shared/schema.js";
import { eq, count, desc, gte } from "drizzle-orm";
import { ok, asyncHandler } from "../utils/helpers.js";
import { sql } from "drizzle-orm";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalConvs] = await db
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const [totalMsgs] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId));

  const [recentConvs] = await db
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  return ok(res, {
    totalConversations: totalConvs.count,
    totalMessages: totalMsgs.count,
    recentConversations: recentConvs.count,
    // Placeholder metrics — will be replaced with real analytics
    aiUsageTokens: 0,
    aiUsageRequests: totalMsgs.count,
    knowledgeSources: 0,
    teamMembers: 1,
    promptLibrarySize: 0,
    apiStatus: {
      gemini: "not_configured",
      openai: "not_configured",
      anthropic: "not_configured",
    },
  });
});

export const getAdminStats = asyncHandler(async (req: Request, res: Response) => {
  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [totalConvs] = await db.select({ count: count() }).from(conversations);
  const [totalMsgs] = await db.select({ count: count() }).from(messages);

  const recentUsers = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
    limit: 5,
    columns: { password: false },
  });

  return ok(res, {
    totalUsers: totalUsers.count,
    totalConversations: totalConvs.count,
    totalMessages: totalMsgs.count,
    recentUsers,
    // Placeholder activity log — replace with real audit table later
    activityLog: [
      { action: "User registered", time: new Date().toISOString(), actor: "system" },
    ],
  });
});
