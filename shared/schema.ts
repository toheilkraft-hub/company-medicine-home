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
  systemPromptContent: text("system_prompt_content"),
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
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  provider: varchar("provider", { length: 50 }).default("mock"),
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  defaultModel: varchar("default_model", { length: 100 }).default("mock-standard"),
  temperature: text("temperature").default("0.7"),
  maxTokens: integer("max_tokens").default(2048),
  defaultSystemPromptId: integer("default_system_prompt_id"),
  theme: varchar("theme", { length: 20 }).default("light"),
  streamingEnabled: boolean("streaming_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  status: varchar("status", { length: 50 }).notNull().default("new"),
  // Fine-grained step within processing:
  // pending → fetching_page → extracting_metadata → checking_medical →
  // checking_date → running_seo → completed | rejected
  processingStep: varchar("processing_step", { length: 50 }).notNull().default("pending"),
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
  // ── SEO & Merit fields ──────────────────────────────────────────────────────
  description: text("description"),
  seoScore: integer("seo_score").default(0),
  seoKeywords: jsonb("seo_keywords").$type<string[]>().default([]),
  authorAuthority: integer("author_authority").default(50),
  meritPassed: boolean("merit_passed").default(true),
  isMedical: boolean("is_medical").default(true),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Collector Configs ────────────────────────────────────────────────────────
export const collectorConfigs = pgTable("collector_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  collectorId: varchar("collector_id", { length: 100 }).notNull(),
  apiKey: text("api_key"),
  extraConfig: jsonb("extra_config").$type<Record<string, string>>().default({}),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Monitors ─────────────────────────────────────────────────────────────────
export const monitors = pgTable("monitors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  source: varchar("source", { length: 100 }).notNull().default("reddit"),
  sourceConfig: jsonb("source_config").$type<Record<string, string>>().default({}),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  settings: one(settings),
  systemPrompts: many(systemPrompts),
  collectorConfigs: many(collectorConfigs),
  monitors: many(monitors),
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

export const collectedItemsRelations = relations(collectedItems, ({ one }) => ({
  user: one(users, { fields: [collectedItems.userId], references: [users.id] }),
  analysis: one(itemAnalysis, { fields: [collectedItems.id], references: [itemAnalysis.itemId] }),
}));

export const itemAnalysisRelations = relations(itemAnalysis, ({ one }) => ({
  item: one(collectedItems, { fields: [itemAnalysis.itemId], references: [collectedItems.id] }),
}));

export const collectorConfigsRelations = relations(collectorConfigs, ({ one }) => ({
  user: one(users, { fields: [collectorConfigs.userId], references: [users.id] }),
}));

export const monitorsRelations = relations(monitors, ({ one }) => ({
  user: one(users, { fields: [monitors.userId], references: [users.id] }),
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
export type CollectorConfig = typeof collectorConfigs.$inferSelect;
export type InsertCollectorConfig = typeof collectorConfigs.$inferInsert;
export type Monitor = typeof monitors.$inferSelect;
export type InsertMonitor = typeof monitors.$inferInsert;
