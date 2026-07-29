import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import {
  Key, Sliders, Cpu, BookOpen, CheckCircle2,
  AlertCircle, Eye, EyeOff, Plus, Trash2, Edit2, X, Check,
} from "lucide-react";
import { cn } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SettingsData {
  id: number;
  provider: string;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  defaultModel: string;
  temperature: string;
  maxTokens: number;
  theme: string;
  streamingEnabled: boolean;
}

interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
}

interface SystemPrompt {
  id: number;
  name: string;
  content: string;
  isDefault: boolean;
}

type Tab = "provider" | "model" | "prompts";

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: "provider", icon: Key, label: "AI Provider" },
  { id: "model", icon: Sliders, label: "Model Config" },
  { id: "prompts", icon: BookOpen, label: "System Prompts" },
];

const PROVIDER_DETAILS: Record<string, { description: string; keyLabel: string; keyPlaceholder: string; docsUrl: string }> = {
  mock: {
    description: "Built-in mock provider. No API key needed. Returns simulated AI responses for development and testing.",
    keyLabel: "",
    keyPlaceholder: "",
    docsUrl: "",
  },
  gemini: {
    description: "Google Gemini — state-of-the-art multimodal AI. Activate by installing @google/generative-ai and uncommenting the SDK calls in server/providers/GeminiProvider.ts.",
    keyLabel: "Gemini API Key",
    keyPlaceholder: "AIza…",
    docsUrl: "https://ai.google.dev/",
  },
  openai: {
    description: "OpenAI GPT models. Activate by installing the openai package and uncommenting the SDK calls in server/providers/OpenAIProvider.ts.",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-…",
    docsUrl: "https://platform.openai.com/",
  },
  anthropic: {
    description: "Anthropic Claude — coming soon. Implementation stub is in server/providers/.",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/",
  },
};

// ── Saved banner ──────────────────────────────────────────────────────────────
function SavedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 p-3 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm mb-4 animate-fade-in">
      <CheckCircle2 size={15} /> Settings saved.
    </div>
  );
}

// ── System prompt editor row ───────────────────────────────────────────────────
function PromptRow({
  prompt,
  onSave,
  onDelete,
}: {
  prompt: SystemPrompt;
  onSave: (id: number, data: Partial<SystemPrompt>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prompt.name);
  const [content, setContent] = useState(prompt.content);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Prompt name"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
            placeholder="System prompt content…"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditing(false); setName(prompt.name); setContent(prompt.content); }}
              className="btn-ghost py-1 px-3 text-xs text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(prompt.id, { name, content }); setEditing(false); }}
              className="btn-primary py-1 px-3 text-xs"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-200">{prompt.name}</span>
              {prompt.isDefault && (
                <span className="badge bg-brand-950 text-brand-400 border border-brand-800 text-xs">Default</span>
              )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-2 font-mono">{prompt.content}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => onDelete(prompt.id)}
              className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-950 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("provider");
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const qc = useQueryClient();

  // Form state
  const [provider, setProvider] = useState("mock");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("mock-standard");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [streamingEnabled, setStreamingEnabled] = useState(true);

  // New prompt form
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");

  // Fetch settings + providers
  const { data, isLoading } = useQuery<{ settings: SettingsData; providers: ProviderInfo[] }>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<{ settings: SettingsData; providers: ProviderInfo[] }>("/api/settings"),
  });

  useEffect(() => {
    if (data?.settings) {
      setProvider(data.settings.provider ?? "mock");
      setGeminiKey(data.settings.geminiApiKey ?? "");
      setOpenaiKey(data.settings.openaiApiKey ?? "");
      setDefaultModel(data.settings.defaultModel ?? "mock-standard");
      setTemperature(parseFloat(data.settings.temperature ?? "0.7"));
      setMaxTokens(data.settings.maxTokens ?? 2048);
      setStreamingEnabled(data.settings.streamingEnabled ?? true);
    }
  }, [data]);

  const updateSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<{ settings: SettingsData }>("/api/settings", "PATCH", body),
    onSuccess: (res) => {
      qc.setQueryData(["settings"], (old: any) => ({ ...old, settings: res.settings }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = () => {
    updateSettings.mutate({
      provider,
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      defaultModel,
      temperature: String(temperature),
      maxTokens,
      streamingEnabled,
    });
  };

  // System prompts
  const { data: prompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["system-prompts"],
    queryFn: () => apiFetch<SystemPrompt[]>("/api/prompts"),
  });

  const createPrompt = useMutation({
    mutationFn: (body: { name: string; content: string }) =>
      apiFetch("/api/prompts", "POST", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-prompts"] });
      setNewPromptName("");
      setNewPromptContent("");
    },
  });

  const updatePrompt = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<SystemPrompt>) =>
      apiFetch(`/api/prompts/${id}`, "PATCH", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-prompts"] }),
  });

  const deletePrompt = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/prompts/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-prompts"] }),
  });

  const currentProviderDetail = PROVIDER_DETAILS[provider] ?? PROVIDER_DETAILS.mock;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <h2 className="text-xl font-bold text-gray-100 mb-6">Settings</h2>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                activeTab === id
                  ? "bg-gray-800 text-gray-100"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <SavedBanner show={saved} />

        {/* ── AI Provider tab ────────────────────────────────────────────── */}
        {activeTab === "provider" && (
          <div className="space-y-4">
            {/* Provider selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Active Provider
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(data?.providers ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                      provider === p.id
                        ? "border-brand-600 bg-brand-950 text-brand-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      p.id === "mock" ? "bg-green-500" : "bg-gray-600"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.id === "mock" && <p className="text-xs opacity-60">Active now</p>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 leading-relaxed">{currentProviderDetail.description}</p>
              </div>
            </div>

            {/* API keys */}
            {provider !== "mock" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  API Keys
                </label>

                {provider === "gemini" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">Gemini API Key</label>
                    <div className="relative">
                      <input
                        type={showKeys.gemini ? "text" : "password"}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="AIza…"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys((k) => ({ ...k, gemini: !k.gemini }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showKeys.gemini ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Get your key at{" "}
                      <a href="https://ai.google.dev/" target="_blank" rel="noopener" className="text-brand-500 hover:underline">
                        ai.google.dev
                      </a>
                      {" "}· Also uncomment SDK calls in{" "}
                      <code className="text-brand-400 bg-gray-800 px-1 rounded">server/providers/GeminiProvider.ts</code>
                    </p>
                  </div>
                )}

                {provider === "openai" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">OpenAI API Key</label>
                    <div className="relative">
                      <input
                        type={showKeys.openai ? "text" : "password"}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="sk-…"
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys((k) => ({ ...k, openai: !k.openai }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showKeys.openai ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Also uncomment SDK calls in{" "}
                      <code className="text-brand-400 bg-gray-800 px-1 rounded">server/providers/OpenAIProvider.ts</code>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="btn-primary"
              >
                {updateSettings.isPending ? "Saving…" : "Save provider settings"}
              </button>
            </div>
          </div>
        )}

        {/* ── Model config tab ───────────────────────────────────────────── */}
        {activeTab === "model" && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Default Model</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="mock-standard"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Available models depend on the active provider. The Chat UI lists them in the model selector.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Temperature: <span className="text-brand-400 font-mono">{temperature}</span>
                  <span className="text-gray-600 text-xs ml-2">(0 = deterministic · 1 = creative)</span>
                </label>
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>Precise</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Max Output Tokens</label>
                <input
                  type="number"
                  min={256} max={32768} step={256}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-800">
                <div>
                  <p className="text-sm text-gray-300">Streaming responses</p>
                  <p className="text-xs text-gray-600">Show tokens as they arrive via SSE</p>
                </div>
                <button
                  onClick={() => setStreamingEnabled((v) => !v)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative",
                    streamingEnabled ? "bg-brand-600" : "bg-gray-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    streamingEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="btn-primary"
              >
                {updateSettings.isPending ? "Saving…" : "Save model config"}
              </button>
            </div>
          </div>
        )}

        {/* ── System prompts tab ─────────────────────────────────────────── */}
        {activeTab === "prompts" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              System prompts set the AI's persona and behaviour. Select one in the Chat toolbar before starting a conversation.
            </p>

            {/* Existing prompts */}
            <div className="space-y-3">
              {prompts.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-6 border border-dashed border-gray-800 rounded-xl">
                  No system prompts yet — create one below.
                </p>
              )}
              {prompts.map((p) => (
                <PromptRow
                  key={p.id}
                  prompt={p}
                  onSave={(id, data) => updatePrompt.mutate({ id, ...data })}
                  onDelete={(id) => deletePrompt.mutate(id)}
                />
              ))}
            </div>

            {/* New prompt form */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New System Prompt</h3>
              <input
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g. Medical Assistant"
              />
              <textarea
                value={newPromptContent}
                onChange={(e) => setNewPromptContent(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
                placeholder="You are a knowledgeable medical assistant. Always recommend consulting a licensed physician for diagnosis and treatment…"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (newPromptName.trim() && newPromptContent.trim()) {
                      createPrompt.mutate({ name: newPromptName.trim(), content: newPromptContent.trim() });
                    }
                  }}
                  disabled={!newPromptName.trim() || !newPromptContent.trim() || createPrompt.isPending}
                  className="btn-primary text-sm"
                >
                  <Plus size={14} /> Add prompt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
