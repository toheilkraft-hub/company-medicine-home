import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── System Prompts ───────────────────────────────────────────────────────────
export const systemPrompts = pgTable("system_prompts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Conversations ─────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 500 }).notNull().default("New Conversation"),
  provider: varchar("provider", { length: 50 }).default("mock"),
  model: varchar("model", { length: 100 }).default("mock-standard"),
  systemPromptId: integer("system_prompt_id")
    .references(() => systemPrompts.id, { onDelete: "set null" }),
  systemPromptContent: text("system_prompt_content"), // snapshot at conversation creation
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // model, provider, tokens, latency, finishReason
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  // Provider config
  provider: varchar("provider", { length: 50 }).default("mock"),
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  defaultModel: varchar("default_model", { length: 100 }).default("mock-standard"),
  temperature: text("temperature").default("0.7"),
  maxTokens: integer("max_tokens").default(2048),
  // System prompt
  defaultSystemPromptId: integer("default_system_prompt_id"),
  // UI
  theme: varchar("theme", { length: 20 }).default("light"),
  streamingEnabled: boolean("streaming_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  settings: one(settings),
  systemPrompts: many(systemPrompts),
}));

export const systemPromptsRelations = relations(systemPrompts, ({ one }) => ({
  user: one(users, { fields: [systemPrompts.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
  systemPrompt: one(systemPrompts, {
    fields: [conversations.systemPromptId],
    references: [systemPrompts.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] }),
}));

// ─── Collected Items ──────────────────────────────────────────────────────────
export const collectedItems = pgTable("collected_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 100 }).notNull().default("manual"),
  url: text("url"),
  author: varchar("author", { length: 255 }),
  collectedAt: timestamp("collected_at").defaultNow().notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  // Status: new | processing | reviewed | archived
  status: varchar("status", { length: 50 }).notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Item Analysis ────────────────────────────────────────────────────────────
export const itemAnalysis = pgTable("item_analysis", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .references(() => collectedItems.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  summary: text("summary").notNull(),
  intent: varchar("intent", { length: 100 }).notNull(),
  industry: varchar("industry", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  sentiment: varchar("sentiment", { length: 50 }).notNull(),
  priorityScore: integer("priority_score").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  suggestedReply: text("suggested_reply").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations (intelligence) ─────────────────────────────────────────────────
export const collectedItemsRelations = relations(collectedItems, ({ one }) => ({
  user: one(users, { fields: [collectedItems.userId], references: [users.id] }),
  analysis: one(itemAnalysis, { fields: [collectedItems.id], references: [itemAnalysis.itemId] }),
}));

export const itemAnalysisRelations = relations(itemAnalysis, ({ one }) => ({
  item: one(collectedItems, { fields: [itemAnalysis.itemId], references: [collectedItems.id] }),
}));

// ─── TypeScript types ─────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;
