import {
  useState, useRef, useEffect, useCallback,
} from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import {
  Send, Plus, Trash2, Copy, Check, StopCircle,
  MessageSquare, Paperclip, RotateCcw, ChevronDown,
  Settings2, Cpu, X, PenLine, BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn, timeAgo } from "../lib/utils";
import type { ConversationWithMessages, MessageRow, ModelInfo, SystemPrompt } from "@shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConversationStub {
  id: number;
  title: string;
  updatedAt: string;
  model: string | null;
  provider: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 px-4 py-2">
      <div className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
        <Cpu size={13} className="text-brand-600" />
      </div>
      <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 text-xs text-gray-500">
        <span className="font-mono">{language ?? "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-gray-800 font-mono bg-gray-50">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MessageBubble({ msg, onRegenerate }: { msg: MessageRow; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("group flex items-end gap-3 px-4 py-1.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
        isUser ? "bg-brand-600 text-white" : "bg-gray-100 border border-gray-200 text-brand-600"
      )}>
        {isUser ? "U" : <Cpu size={13} />}
      </div>

      <div className={cn("max-w-2xl flex flex-col", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-brand-600 text-white rounded-br-sm"
            : "bg-gray-50 border border-gray-200 text-gray-800 rounded-bl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose-ai">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isBlock = !props.inline;
                    if (isBlock) {
                      return <CodeBlock language={match?.[1]} children={String(children).replace(/\n$/, "")} />;
                    }
                    return <code className="font-mono text-xs bg-gray-800 text-brand-300 px-1.5 py-0.5 rounded" {...props}>{children}</code>;
                  },
                  pre({ children }) { return <>{children}</>; },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata + actions */}
        <div className={cn(
          "flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
          {msg.metadata?.model && (
            <span className="text-xs text-gray-400">· {msg.metadata.model}</span>
          )}
          <button onClick={copy} className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors" title="Copy">
            {copied ? <Check size={12} className="text-brand-500" /> : <Copy size={12} />}
          </button>
          {!isUser && onRegenerate && (
            <button onClick={onRegenerate} className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors" title="Regenerate">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Streaming message bubble (shows content as it arrives) ────────────────────
function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex items-end gap-3 px-4 py-1.5">
      <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
        <Cpu size={13} className="text-brand-600" />
      </div>
      <div className="max-w-2xl bg-gray-50 border border-brand-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed">
        {content.length === 0 ? (
          <span className="inline-block w-0.5 h-4 bg-brand-400 animate-pulse" />
        ) : (
          <div className="prose-ai">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        <span className="inline-block w-0.5 h-4 bg-brand-400 animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  );
}

// ── Model Selector ────────────────────────────────────────────────────────────
function ModelSelector({
  models,
  value,
  onChange,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (m: string) => void;
}) {
  const current = models.find((m) => m.id === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// ── System Prompt Panel ───────────────────────────────────────────────────────
function SystemPromptPanel({
  prompts,
  currentContent,
  onChange,
  onClose,
}: {
  prompts: SystemPrompt[];
  currentContent: string;
  onChange: (content: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(currentContent);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen size={14} className="text-brand-600" />
          System Prompt
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {prompts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => setDraft(p.content)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs text-gray-700 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="You are a helpful AI assistant…"
        className="w-full bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
        <button
          onClick={() => { onChange(draft); onClose(); }}
          className="btn-primary text-xs py-1.5 px-3"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── Main Chat page ────────────────────────────────────────────────────────────
export default function Chat() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const convId = params.id ? parseInt(params.id, 10) : null;

  // ── Data fetching ────────────────────────────────────────────────────────────

  // Load user settings to get the active provider + defaultModel
  const { data: settingsData } = useQuery<{ settings: { provider: string; defaultModel: string } }>({
    queryKey: ["settings"],
    queryFn: () => apiFetch("/api/settings"),
    staleTime: 30_000,
  });

  const activeProvider = settingsData?.settings?.provider ?? "mock";

  // Fetch models for the active provider — re-fetches when provider changes
  const { data: models = [] } = useQuery<ModelInfo[]>({
    queryKey: ["models", activeProvider],
    queryFn: () => apiFetch<ModelInfo[]>("/api/chat/models"),
    staleTime: 60_000,
  });

  // Initialise selectedModel from saved settings (once loaded), unless a
  // conversation already has its own model set (handled in the conv useEffect)
  useEffect(() => {
    if (!convId && settingsData?.settings?.defaultModel) {
      setSelectedModel(settingsData.settings.defaultModel);
    }
  }, [settingsData?.settings?.defaultModel, convId]);

  const { data: systemPrompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["system-prompts"],
    queryFn: () => apiFetch<SystemPrompt[]>("/api/prompts"),
  });

  const { data: conversation, isLoading } = useQuery<ConversationWithMessages>({
    queryKey: ["conversation", convId],
    queryFn: () => apiFetch<ConversationWithMessages>(`/api/chat/conversations/${convId}`),
    enabled: !!convId,
    refetchInterval: false,
  });

  // Sync model + system prompt from loaded conversation
  useEffect(() => {
    if (conversation) {
      if (conversation.model) setSelectedModel(conversation.model);
      if (conversation.systemPromptContent) setSystemPrompt(conversation.systemPromptContent);
    }
  }, [conversation?.id]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createConv = useMutation({
    mutationFn: () =>
      apiFetch<{ id: number }>("/api/chat/conversations", "POST", {
        model: selectedModel,
        systemPromptContent: systemPrompt || null,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${data.id}`);
    },
  });

  const deleteConv = useMutation({
    mutationFn: () => apiFetch(`/api/chat/conversations/${convId}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate("/chat");
    },
  });

  const clearConv = useMutation({
    mutationFn: () => apiFetch(`/api/chat/conversations/${convId}/messages`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", convId] }),
  });

  const updateConvSettings = useMutation({
    mutationFn: (patch: { model?: string; systemPromptContent?: string }) =>
      apiFetch(`/api/chat/conversations/${convId}`, "PATCH", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });

  // ── Streaming send ────────────────────────────────────────────────────────────
  const sendStreamingMessage = useCallback(async (content: string) => {
    if (!convId) return;
    setIsStreaming(true);
    setStreamingContent("");

    let fullContent = "";
    let aborted = false;
    const ctrl = new AbortController();
    abortRef.current = () => { aborted = true; ctrl.abort(); };

    try {
      const resp = await fetch(`/api/chat/conversations/${convId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
        signal: ctrl.signal,
      });

      if (!resp.ok) throw new Error(await resp.text());

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") {
              fullContent += event.content;
              setStreamingContent(fullContent);
            } else if (event.type === "done" || event.type === "error") {
              // Refresh conversation to get persisted messages
              qc.invalidateQueries({ queryKey: ["conversation", convId] });
              qc.invalidateQueries({ queryKey: ["conversations"] });
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Stream error:", err);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }, [convId, qc]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput("");

    if (!convId) {
      // Create conversation first, then navigate
      const conv = await apiFetch<{ id: number }>("/api/chat/conversations", "POST", {
        model: selectedModel,
        systemPromptContent: systemPrompt || null,
      });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${conv.id}`);
      // Message will be sent after navigation via useEffect below
      sessionStorage.setItem("pendingMessage", content);
      return;
    }

    sendStreamingMessage(content);
  };

  // Send pending message after creating a new conversation
  useEffect(() => {
    if (!convId) return;
    const pending = sessionStorage.getItem("pendingMessage");
    if (pending) {
      sessionStorage.removeItem("pendingMessage");
      sendStreamingMessage(pending);
    }
  }, [convId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.();
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // Scroll to bottom
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (!isStreaming) scrollToBottom();
  }, [conversation?.messages?.length]);

  useEffect(() => {
    if (isStreaming) scrollToBottom();
  }, [streamingContent]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  // When system prompt changes, update the conversation
  const handleSystemPromptChange = (content: string) => {
    setSystemPrompt(content);
    if (convId) {
      updateConvSettings.mutate({ systemPromptContent: content || null });
    }
  };

  // When model changes, update the conversation
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (convId) {
      updateConvSettings.mutate({ model });
    }
  };

  const currentMessages = conversation?.messages ?? [];
  const hasMessages = currentMessages.length > 0 || isStreaming;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 flex-1 truncate min-w-0">
          {conversation?.title ?? (convId ? "Loading…" : "New Conversation")}
        </h2>

        {/* Model selector */}
        {models.length > 0 && (
          <ModelSelector models={models} value={selectedModel} onChange={handleModelChange} />
        )}

        {/* System prompt toggle */}
        <button
          onClick={() => setShowSystemPrompt((v) => !v)}
          title="System prompt"
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            systemPrompt
              ? "bg-brand-50 text-brand-600 border border-brand-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          )}
        >
          <Settings2 size={16} />
        </button>

        {/* Actions */}
        {convId && (
          <>
            <button
              onClick={() => { if (confirm("Clear all messages?")) clearConv.mutate(); }}
              className="btn-ghost text-xs py-1.5 px-2.5 text-gray-400 hover:text-gray-600"
              title="Clear conversation"
            >
              <PenLine size={14} />
            </button>
            <button
              onClick={() => { if (confirm("Delete this conversation?")) deleteConv.mutate(); }}
              className="btn-ghost text-xs py-1.5 px-2.5 text-red-500 hover:text-red-400 hover:bg-red-950"
              title="Delete conversation"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto py-4 relative"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : !hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
              <Cpu size={28} className="text-brand-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              {convId ? "Start the conversation" : "iHeal AI"}
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mb-1">
              {convId
                ? "Send a message to begin. The AI will respond using the selected provider."
                : "Select a conversation from the sidebar or start a new one."}
            </p>
            {systemPrompt && (
              <p className="text-xs text-brand-500 mt-2 max-w-xs truncate">
                System: {systemPrompt.slice(0, 60)}…
              </p>
            )}
            {!convId && (
              <button
                onClick={() => createConv.mutate()}
                className="btn-primary mt-4"
              >
                <Plus size={16} /> New conversation
              </button>
            )}
          </div>
        ) : (
          <>
            {currentMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onRegenerate={
                  msg.role === "assistant" && !isStreaming
                    ? () => {
                        // Regenerate: find the preceding user message and resend
                        const idx = currentMessages.indexOf(msg);
                        const userMsg = currentMessages.slice(0, idx).findLast((m) => m.role === "user");
                        if (userMsg) sendStreamingMessage(userMsg.content);
                      }
                    : undefined
                }
              />
            ))}
            {isStreaming && (
              streamingContent
                ? <StreamingBubble content={streamingContent} />
                : <TypingIndicator />
            )}
          </>
        )}
        <div ref={messagesEndRef} />

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-32 right-6 p-2 bg-white border border-gray-300 rounded-full shadow-lg text-gray-500 hover:text-gray-900 transition-all"
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {/* System prompt panel (floats above input) */}
          {showSystemPrompt && (
            <SystemPromptPanel
              prompts={systemPrompts}
              currentContent={systemPrompt}
              onChange={handleSystemPromptChange}
              onClose={() => setShowSystemPrompt(false)}
            />
          )}

          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-brand-500 transition">
            <button
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mb-0.5"
              title="Attach file (coming soon)"
            >
              <Paperclip size={17} />
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
              placeholder={isStreaming ? "AI is responding…" : "Message iHeal AI (Shift+Enter for new line)"}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none min-h-[28px] max-h-40 py-1"
            />

            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                  title="Stop generation"
                >
                  <StopCircle size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-xs text-gray-400">
              {systemPrompt ? (
                <span className="text-brand-600">System prompt active</span>
              ) : (
                <span>No system prompt</span>
              )}
            </p>
            <p className="text-xs text-gray-400">
              {selectedModel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
