import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import {
  Key, Sliders, Cpu, BookOpen, CheckCircle2,
  AlertCircle, Eye, EyeOff, Plus, Trash2, Edit2, RefreshCw, Zap,
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

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  provider: string;
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

const PROVIDER_META: Record<string, { label: string; keyPlaceholder: string; keyHint: string; docsUrl: string; color: string }> = {
  mock: { label: "Mock (built-in)", keyPlaceholder: "", keyHint: "", docsUrl: "", color: "text-gray-400" },
  gemini: { label: "Google Gemini", keyPlaceholder: "AIza…", keyHint: "Get your key at ai.google.dev", docsUrl: "https://ai.google.dev/", color: "text-blue-400" },
  openai: { label: "OpenAI", keyPlaceholder: "sk-…", keyHint: "Get your key at platform.openai.com", docsUrl: "https://platform.openai.com/api-keys", color: "text-green-400" },
  anthropic: { label: "Anthropic Claude", keyPlaceholder: "sk-ant-…", keyHint: "Coming soon — stub only", docsUrl: "https://console.anthropic.com/", color: "text-orange-400" },
};

function SavedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 p-3 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm mb-4">
      <CheckCircle2 size={15} /> Settings saved.
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm mb-4">
      <AlertCircle size={15} /> {msg}
    </div>
  );
}

// ── System prompt row ─────────────────────────────────────────────────────────
function PromptRow({ prompt, onSave, onDelete }: {
  prompt: SystemPrompt;
  onSave: (id: number, data: Partial<SystemPrompt>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prompt.name);
  const [content, setContent] = useState(prompt.content);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {editing ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Prompt name" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
            placeholder="System prompt content…" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditing(false); setName(prompt.name); setContent(prompt.content); }}
              className="btn-ghost py-1 px-3 text-xs text-gray-400">Cancel</button>
            <button onClick={() => { onSave(prompt.id, { name, content }); setEditing(false); }}
              className="btn-primary py-1 px-3 text-xs">Save</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-800">{prompt.name}</span>
              {prompt.isDefault && (
                <span className="badge bg-brand-950 text-brand-400 border border-brand-800 text-xs">Default</span>
              )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-2 font-mono">{prompt.content}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(prompt.id)}
              className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-950 transition-colors">
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
  const [saveError, setSaveError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const qc = useQueryClient();

  // Form state
  const [provider, setProvider] = useState("mock");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [streamingEnabled, setStreamingEnabled] = useState(true);

  // Model fetching state
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsFetching, setModelsFetching] = useState(false);
  const [modelsFetchError, setModelsFetchError] = useState("");
  const [modelsFetched, setModelsFetched] = useState(false);

  // New prompt form
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");

  const { data, isLoading } = useQuery<{ settings: SettingsData; providers: ProviderInfo[] }>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<{ settings: SettingsData; providers: ProviderInfo[] }>("/api/settings"),
  });

  useEffect(() => {
    if (data?.settings) {
      setProvider(data.settings.provider ?? "mock");
      setGeminiKey(data.settings.geminiApiKey ?? "");
      setOpenaiKey(data.settings.openaiApiKey ?? "");
      setDefaultModel(data.settings.defaultModel ?? "");
      setTemperature(parseFloat(data.settings.temperature ?? "0.7"));
      setMaxTokens(data.settings.maxTokens ?? 2048);
      setStreamingEnabled(data.settings.streamingEnabled ?? true);
    }
  }, [data]);

  // Reset model list when provider changes
  useEffect(() => {
    setAvailableModels([]);
    setModelsFetched(false);
    setModelsFetchError("");
  }, [provider]);

  const activeKey = provider === "gemini" ? geminiKey : provider === "openai" ? openaiKey : "";

  async function handleFetchModels() {
    if (!activeKey || activeKey.startsWith("••••") || provider === "mock") return;
    setModelsFetching(true);
    setModelsFetchError("");
    try {
      const res = await apiFetch<{ models: ModelInfo[]; error?: string }>(
        "/api/settings/models", "POST", { provider, apiKey: activeKey }
      );
      if (res.error) {
        setModelsFetchError(res.error);
        setAvailableModels([]);
      } else {
        setAvailableModels(res.models ?? []);
        setModelsFetched(true);
        // Auto-select first model if none chosen yet or current doesn't match provider
        if (res.models.length > 0) {
          const currentValid = res.models.some((m) => m.id === defaultModel);
          if (!currentValid) setDefaultModel(res.models[0].id);
        }
      }
    } catch (e: any) {
      setModelsFetchError(e?.message ?? "Failed to fetch models");
    } finally {
      setModelsFetching(false);
    }
  }

  const updateSettingsMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<{ settings: SettingsData }>("/api/settings", "PATCH", body),
    onSuccess: (res) => {
      qc.setQueryData(["settings"], (old: any) => ({ ...old, settings: res.settings }));
      setSaved(true);
      setSaveError("");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: any) => setSaveError(e?.message ?? "Failed to save"),
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
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
    mutationFn: (body: { name: string; content: string }) => apiFetch("/api/prompts", "POST", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-prompts"] }); setNewPromptName(""); setNewPromptContent(""); },
  });
  const updatePrompt = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<SystemPrompt>) => apiFetch(`/api/prompts/${id}`, "PATCH", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-prompts"] }),
  });
  const deletePrompt = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/prompts/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-prompts"] }),
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const meta = PROVIDER_META[provider] ?? PROVIDER_META.mock;
  const canFetchModels = provider !== "mock" && provider !== "anthropic" && activeKey && !activeKey.startsWith("••••");

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-50 border border-gray-200 rounded-xl p-1">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                activeTab === id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <SavedBanner show={saved} />
        {saveError && <ErrorBanner msg={saveError} />}

        {/* ── AI Provider tab ──────────────────────────────────────────────── */}
        {activeTab === "provider" && (
          <div className="space-y-4">

            {/* Provider selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Active Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(data?.providers ?? []).map((p) => {
                  const pm = PROVIDER_META[p.id] ?? PROVIDER_META.mock;
                  const isActive = provider === p.id;
                  return (
                    <button key={p.id} onClick={() => setProvider(p.id)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                        isActive ? "border-brand-600 bg-brand-950" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      )}>
                      <div className={cn("w-2 h-2 rounded-full shrink-0", isActive ? "bg-brand-400" : "bg-gray-400")} />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium truncate", isActive ? "text-brand-300" : "text-gray-600")}>
                          {pm.label}
                        </p>
                        {isActive && <p className="text-xs text-brand-500">Active</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API key entry */}
            {provider !== "mock" && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  API Key — {meta.label}
                </label>

                {provider === "anthropic" ? (
                  <p className="text-sm text-orange-400">Anthropic Claude support is coming soon.</p>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder={meta.keyPlaceholder}
                        value={provider === "gemini" ? geminiKey : openaiKey}
                        onChange={(e) => provider === "gemini" ? setGeminiKey(e.target.value) : setOpenaiKey(e.target.value)}
                      />
                      <button type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {meta.keyHint}{" "}
                      {meta.docsUrl && (
                        <a href={meta.docsUrl} target="_blank" rel="noopener" className="text-brand-500 hover:underline">
                          {meta.docsUrl.replace("https://", "")}
                        </a>
                      )}
                    </p>

                    {/* Fetch models button */}
                    <button
                      onClick={handleFetchModels}
                      disabled={!canFetchModels || modelsFetching}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        canFetchModels
                          ? "bg-brand-600 hover:bg-brand-700 text-white"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}>
                      <RefreshCw size={14} className={modelsFetching ? "animate-spin" : ""} />
                      {modelsFetching ? "Fetching models…" : "Fetch available models"}
                    </button>
                    {!canFetchModels && activeKey && !activeKey.startsWith("••••") && (
                      <p className="text-xs text-gray-400">Save your API key first, then fetch models.</p>
                    )}
                    {!activeKey && (
                      <p className="text-xs text-gray-400">Enter your API key above to fetch available models.</p>
                    )}

                    {modelsFetchError && <ErrorBanner msg={`Could not fetch models: ${modelsFetchError}`} />}
                  </>
                )}
              </div>
            )}

            {/* Model selector — appears after fetch */}
            {modelsFetched && availableModels.length > 0 && (
              <div className="bg-white border border-brand-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-brand-500" />
                  <label className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                    Choose Model — {availableModels.length} available
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                  {availableModels.map((m) => (
                    <button key={m.id} onClick={() => setDefaultModel(m.id)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                        defaultModel === m.id
                          ? "border-brand-600 bg-brand-950"
                          : "border-gray-200 hover:border-gray-300 bg-gray-50"
                      )}>
                      <div className={cn("w-2 h-2 mt-1.5 rounded-full shrink-0", defaultModel === m.id ? "bg-brand-400" : "bg-gray-400")} />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", defaultModel === m.id ? "text-brand-300" : "text-gray-700")}>
                          {m.name || m.id}
                        </p>
                        {m.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{m.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {m.maxTokens.toLocaleString()} max tokens
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {defaultModel && (
                  <p className="text-xs text-brand-500 font-medium">
                    ✓ Selected: {availableModels.find((m) => m.id === defaultModel)?.name ?? defaultModel}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={updateSettingsMutation.isPending} className="btn-primary">
                {updateSettingsMutation.isPending ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        )}

        {/* ── Model config tab ─────────────────────────────────────────────── */}
        {activeTab === "model" && (
          <div className="space-y-4">

            {/* Current provider / model status */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-2.5 h-2.5 rounded-full shrink-0",
                provider === "mock" ? "bg-gray-400" : "bg-green-400"
              )} />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {PROVIDER_META[provider]?.label ?? provider}
                  {provider !== "mock" && defaultModel && (
                    <span className="text-gray-400 font-normal"> · {defaultModel}</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {provider === "mock"
                    ? "Using built-in mock — go to AI Provider tab to connect a real provider"
                    : defaultModel
                    ? "Live AI · changes apply to new conversations"
                    : "No model selected — go to AI Provider tab and fetch models"}
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">

              {/* Model field — free text fallback if not fetched via provider tab */}
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Default Model ID</label>
                <input
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder={provider === "gemini" ? "gemini-1.5-flash" : provider === "openai" ? "gpt-4o" : "mock-standard"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the AI Provider tab to fetch and pick from live models, or type a model ID directly.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Temperature: <span className="text-brand-500 font-mono">{temperature}</span>
                  <span className="text-gray-500 text-xs ml-2">(0 = precise · 1 = creative)</span>
                </label>
                <input type="range" min="0" max="1" step="0.05" value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Precise</span><span>Balanced</span><span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Max Output Tokens</label>
                <input type="number" min={256} max={131072} step={256}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))} />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-700">Streaming responses</p>
                  <p className="text-xs text-gray-500">Show tokens as they arrive</p>
                </div>
                <button onClick={() => setStreamingEnabled((v) => !v)}
                  className={cn("w-11 h-6 rounded-full transition-colors relative", streamingEnabled ? "bg-brand-600" : "bg-gray-200")}>
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    streamingEnabled ? "translate-x-6" : "translate-x-1")} />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={updateSettingsMutation.isPending} className="btn-primary">
                {updateSettingsMutation.isPending ? "Saving…" : "Save model config"}
              </button>
            </div>
          </div>
        )}

        {/* ── System prompts tab ───────────────────────────────────────────── */}
        {activeTab === "prompts" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              System prompts set the AI's persona and behaviour. Select one in the Chat toolbar before starting a conversation.
            </p>
            <div className="space-y-3">
              {prompts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-300 rounded-xl">
                  No system prompts yet — create one below.
                </p>
              )}
              {prompts.map((p) => (
                <PromptRow key={p.id} prompt={p}
                  onSave={(id, data) => updatePrompt.mutate({ id, ...data })}
                  onDelete={(id) => deletePrompt.mutate(id)} />
              ))}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New System Prompt</h3>
              <input value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g. Medical Assistant" />
              <textarea value={newPromptContent} onChange={(e) => setNewPromptContent(e.target.value)} rows={4}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
                placeholder="You are a knowledgeable medical assistant…" />
              <div className="flex justify-end">
                <button
                  onClick={() => { if (newPromptName.trim() && newPromptContent.trim()) createPrompt.mutate({ name: newPromptName.trim(), content: newPromptContent.trim() }); }}
                  disabled={!newPromptName.trim() || !newPromptContent.trim() || createPrompt.isPending}
                  className="btn-primary text-sm">
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
