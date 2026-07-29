// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types — used by both server and client
// ─────────────────────────────────────────────────────────────────────────────

// ── Intelligence / Inbox ──────────────────────────────────────────────────────

export interface ItemAnalysisResult {
  summary: string;
  intent: string;
  industry: string;
  category: string;
  sentiment: string;
  priorityScore: number;
  confidenceScore: number;
  suggestedReply: string;
}

export type ItemStatus = "new" | "processing" | "reviewed" | "archived";

export interface CollectedItemRow {
  id: number;
  userId: number;
  title: string;
  content: string;
  source: string;
  url: string | null;
  author: string | null;
  collectedAt: string;
  tags: string[];
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  analysis: (ItemAnalysisResult & { processedAt: string; id: number }) | null;
}

// ── AI Message ────────────────────────────────────────────────────────────────
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── Model info ────────────────────────────────────────────────────────────────
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  provider: string;
}

// ── Generation options ────────────────────────────────────────────────────────
export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

// ── AI Response ───────────────────────────────────────────────────────────────
export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  finishReason?: string;
}

// ── Provider config ───────────────────────────────────────────────────────────
export type ProviderID = "mock" | "gemini" | "openai" | "anthropic";

export interface ProviderConfig {
  provider: ProviderID;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ── SSE stream token ──────────────────────────────────────────────────────────
export interface StreamToken {
  type: "token" | "done" | "error";
  content?: string;
  error?: string;
  metadata?: Partial<AIResponse>;
}

// ── System prompt ─────────────────────────────────────────────────────────────
export interface SystemPrompt {
  id: number;
  userId: number;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Conversation (with messages) ──────────────────────────────────────────────
export interface ConversationWithMessages {
  id: number;
  userId: number;
  title: string;
  model: string | null;
  provider: string | null;
  systemPromptId: number | null;
  systemPromptContent: string | null;
  pinned: boolean | null;
  createdAt: string;
  updatedAt: string;
  messages: MessageRow[];
}

export interface MessageRow {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
  metadata?: {
    model?: string;
    provider?: string;
    tokensUsed?: number;
    latencyMs?: number;
    finishReason?: string;
  } | null;
}
