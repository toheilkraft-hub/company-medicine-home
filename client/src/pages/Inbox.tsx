import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { apiFetch } from "../lib/queryClient";
import { timeAgo, cn } from "../lib/utils";
import {
  Inbox as InboxIcon, MessageSquare, Rss, Mail, Webhook,
  Database, Globe, RefreshCw, ExternalLink, Clock,
  CheckCircle, Archive, AlertCircle, Loader2,
  Brain, Building2, FolderOpen, Smile, Send,
  User, Calendar, Hash, Activity,
  Play, Pause, Square, Plus, ChevronDown, ChevronUp,
  Trash2, Wifi, Download, Bell, X,
} from "lucide-react";
import type { CollectedItemRow, ItemStatus, MonitorRow } from "@shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListData {
  items: CollectedItemRow[];
  counts: { new: number; processing: number; reviewed: number; archived: number; all: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  reddit:  { label: "Reddit",  color: "bg-orange-100 text-orange-700 border-orange-200", Icon: MessageSquare },
  rss:     { label: "RSS",     color: "bg-yellow-100 text-yellow-700 border-yellow-200", Icon: Rss },
  email:   { label: "Email",   color: "bg-blue-100 text-blue-700 border-blue-200",       Icon: Mail },
  webhook: { label: "Webhook", color: "bg-purple-100 text-purple-700 border-purple-200", Icon: Webhook },
  crm:     { label: "CRM",     color: "bg-green-100 text-green-700 border-green-200",    Icon: Database },
  manual:  { label: "Manual",  color: "bg-gray-100 text-gray-600 border-gray-200",       Icon: Globe },
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  new:        { label: "New",        color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"  },
  processing: { label: "Processing", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  reviewed:   { label: "Reviewed",   color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  archived:   { label: "Archived",   color: "bg-gray-100 text-gray-500",   dot: "bg-gray-400"  },
};

const SENTIMENT_META: Record<string, { color: string; bg: string }> = {
  Positive: { color: "text-green-700", bg: "bg-green-100" },
  Negative: { color: "text-red-700",   bg: "bg-red-100"   },
  Neutral:  { color: "text-gray-600",  bg: "bg-gray-100"  },
  Mixed:    { color: "text-amber-700", bg: "bg-amber-100" },
};

function priorityColor(score: number): string {
  if (score >= 80) return "text-red-700 bg-red-50 border-red-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-gray-600 bg-gray-50 border-gray-200";
}

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual;
  const Icon = meta.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", meta.color)}>
      <Icon size={9} />{meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", meta.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />{meta.label}
    </span>
  );
}

// ── XLS export ────────────────────────────────────────────────────────────────

function exportToXLS(items: CollectedItemRow[]) {
  const rows = items.map((item) => ({
    "Title":           item.title,
    "Source":          item.source,
    "URL":             item.url ?? "",
    "Author":          item.author ?? "",
    "Collected At":    new Date(item.collectedAt).toLocaleString(),
    "Status":          item.status,
    "Tags":            (item.tags ?? []).join(", "),
    "Summary":         item.analysis?.summary ?? "",
    "Priority Score":  item.analysis?.priorityScore ?? "",
    "Sentiment":       item.analysis?.sentiment ?? "",
    "Intent":          item.analysis?.intent ?? "",
    "Industry":        item.analysis?.industry ?? "",
    "Category":        item.analysis?.category ?? "",
    "Suggested Reply": item.analysis?.suggestedReply ?? "",
    "Content":         item.content,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.min(
      60,
      Math.max(
        key.length + 2,
        ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length),
      ),
    ),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Intelligence Items");
  XLSX.writeFile(wb, `iheal-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Monitors panel ────────────────────────────────────────────────────────────

function MonitorsPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [formTopic, setFormTopic]   = useState("");
  const [formSource, setFormSource] = useState<"reddit" | "rss">("reddit");
  const [formSubreddit, setFormSubreddit] = useState("");
  const [formRssUrl, setFormRssUrl]       = useState("");
  const [creating, setCreating]           = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery<{ monitors: MonitorRow[] }>({
    queryKey: ["monitors"],
    queryFn: () => apiFetch("/api/monitors") as Promise<{ monitors: MonitorRow[] }>,
    refetchInterval: 15_000,
  });

  const monitorList: MonitorRow[] = data?.monitors ?? [];
  const activeCount = monitorList.filter((m) => m.status === "active").length;
  const pausedCount = monitorList.filter((m) => m.status === "paused").length;

  const updateMonitor = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/monitors/${id}`, "PATCH", { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });
  const deleteMonitor = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/monitors/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });
  const pauseAll = useMutation({
    mutationFn: () => apiFetch("/api/monitors/pause-all", "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });
  const stopAll = useMutation({
    mutationFn: () => apiFetch("/api/monitors/stop-all", "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });

  async function handleCreate() {
    if (!formTopic.trim()) return;
    if (formSource === "rss" && !formRssUrl.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/monitors", "POST", {
        name: formTopic.trim(),
        topic: formTopic.trim(),
        source: formSource,
        sourceConfig:
          formSource === "reddit"
            ? { subreddit: formSubreddit.trim() }
            : { url: formRssUrl.trim() },
      });
      await qc.invalidateQueries({ queryKey: ["monitors"] });
      setFormTopic(""); setFormSubreddit(""); setFormRssUrl(""); setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button onClick={() => setIsExpanded((v) => !v)} className="flex items-center gap-1.5 flex-1 min-w-0">
          <Wifi size={11} className={cn("shrink-0", activeCount > 0 ? "text-green-500" : "text-gray-400")} />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Monitors</span>
          {monitorList.length > 0 && (
            <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
              activeCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
              {activeCount} active
            </span>
          )}
          {isExpanded ? <ChevronUp size={11} className="text-gray-400 ml-auto shrink-0" />
                      : <ChevronDown size={11} className="text-gray-400 ml-auto shrink-0" />}
        </button>
        <button
          onClick={() => { setShowForm((v) => !v); setIsExpanded(true); }}
          className={cn("p-1 rounded-md transition-colors shrink-0",
            showForm ? "bg-brand-100 text-brand-700" : "text-gray-400 hover:text-brand-600 hover:bg-gray-100")}
          title="Add monitor"
        >
          <Plus size={12} />
        </button>
      </div>

      {isExpanded && (
        <div className="pb-2">
          {showForm && (
            <div className="mx-3 mb-2 bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-2.5">
              <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">New Monitor</p>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 font-medium">Topic / search query</label>
                <input type="text" value={formTopic} onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="e.g. AI in healthcare"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  autoFocus />
              </div>
              <div className="flex gap-3">
                {(["reddit", "rss"] as const).map((s) => (
                  <label key={s} className={cn("flex items-center gap-1.5 text-xs cursor-pointer",
                    formSource === s ? "text-brand-700 font-semibold" : "text-gray-500")}>
                    <input type="radio" name="mon-source" checked={formSource === s}
                      onChange={() => setFormSource(s)} className="accent-brand-600" />
                    {s === "reddit" ? "Reddit" : "RSS Feed"}
                  </label>
                ))}
              </div>
              {formSource === "reddit" && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 font-medium">Subreddit <span className="text-gray-400">(optional)</span></label>
                  <input type="text" value={formSubreddit} onChange={(e) => setFormSubreddit(e.target.value)}
                    placeholder="e.g. MachineLearning"
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white" />
                </div>
              )}
              {formSource === "rss" && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 font-medium">Feed URL <span className="text-red-400">*</span></label>
                  <input type="url" value={formRssUrl} onChange={(e) => setFormRssUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white" />
                </div>
              )}
              <div className="flex gap-2 pt-0.5">
                <button onClick={handleCreate}
                  disabled={creating || !formTopic.trim() || (formSource === "rss" && !formRssUrl.trim())}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                  {creating ? "Starting…" : "Start Monitoring"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {monitorList.length === 0 ? (
            <p className="px-4 py-2 text-[10px] text-gray-400">
              No monitors yet —{" "}
              <button onClick={() => setShowForm(true)} className="text-brand-600 hover:underline font-medium">
                + Add Monitor
              </button>{" "}
              to start collecting.
            </p>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto space-y-px px-2">
                {monitorList.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      m.status === "active" ? "bg-green-500 animate-pulse"
                      : m.status === "paused" ? "bg-amber-400" : "bg-gray-300")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{m.name}</p>
                      <span className={cn("text-[9px] font-semibold uppercase",
                        m.source === "reddit" ? "text-orange-500" : "text-yellow-600")}>
                        {m.source}
                      </span>
                      {m.lastRunAt && <span className="text-[9px] text-gray-400 ml-1">· {timeAgo(m.lastRunAt)}</span>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.status === "active" ? (
                        <button onClick={() => updateMonitor.mutate({ id: m.id, status: "paused" })} title="Pause"
                          className="p-1 rounded hover:bg-amber-100 text-gray-400 hover:text-amber-600 transition-colors">
                          <Pause size={10} />
                        </button>
                      ) : (
                        <button onClick={() => updateMonitor.mutate({ id: m.id, status: "active" })} title="Resume"
                          className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors">
                          <Play size={10} />
                        </button>
                      )}
                      {m.status !== "stopped" ? (
                        <button onClick={() => updateMonitor.mutate({ id: m.id, status: "stopped" })} title="Stop"
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                          <Square size={10} />
                        </button>
                      ) : (
                        <button onClick={() => deleteMonitor.mutate(m.id)} title="Delete"
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {(activeCount > 0 || pausedCount > 0) && (
                <div className="flex gap-1.5 px-3 pt-2">
                  {activeCount > 0 && (
                    <button onClick={() => pauseAll.mutate()} disabled={pauseAll.isPending}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-[10px] font-medium text-gray-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-colors">
                      <Pause size={9} />Pause All
                    </button>
                  )}
                  <button onClick={() => stopAll.mutate()} disabled={stopAll.isPending}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-[10px] font-medium text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                    <Square size={9} />Stop All
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS: { key: string; label: string }[] = [
  { key: "all",        label: "All Items"   },
  { key: "new",        label: "New"         },
  { key: "processing", label: "Processing"  },
  { key: "reviewed",   label: "Reviewed"    },
  { key: "archived",   label: "Archived"    },
];

// ── Item list entry ───────────────────────────────────────────────────────────

function ItemEntry({
  item, active, selected, isNew,
  onClick, onToggleSelect,
}: {
  item: CollectedItemRow;
  active: boolean;
  selected: boolean;
  isNew: boolean;
  onClick: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "w-full text-left border-b border-gray-100 transition-colors relative flex items-stretch",
        active   ? "bg-brand-50 border-l-2 border-l-brand-500" : "hover:bg-gray-50",
        selected ? "bg-blue-50 border-l-2 border-l-blue-400" : "",
        isNew && !active && !selected ? "border-l-2 border-l-blue-300" : "",
      )}
    >
      {/* Checkbox column */}
      <div
        className="flex items-center pl-2 pr-1 shrink-0 cursor-pointer"
        onClick={onToggleSelect}
      >
        <div className={cn(
          "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
          selected ? "bg-blue-500 border-blue-500" : "border-gray-300 hover:border-blue-400",
        )}>
          {selected && <CheckCircle size={10} className="text-white" />}
        </div>
      </div>

      {/* Item content */}
      <button className="flex-1 text-left px-2 py-3 min-w-0" onClick={onClick}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className={cn("text-xs font-semibold leading-snug line-clamp-2 flex-1",
            active ? "text-brand-800" : "text-gray-800")}>
            {isNew && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle" />
            )}
            {item.title}
          </p>
          {item.analysis && (
            <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border",
              priorityColor(item.analysis.priorityScore))}>
              {item.analysis.priorityScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourceBadge source={item.source} />
          <StatusBadge status={item.status} />
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-[10px] text-brand-500 hover:text-brand-700 ml-0.5"
              title="View source">
              <ExternalLink size={9} />
            </a>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(item.collectedAt)}</span>
        </div>
        {item.author && <p className="text-[10px] text-gray-400 mt-1 truncate">{item.author}</p>}
      </button>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
      <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
        <InboxIcon size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">Select an item</p>
      <p className="text-xs text-gray-400 mt-1">Choose an item from the list to view its content and AI analysis</p>
    </div>
  );
}

function EmptyList({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <InboxIcon size={18} className="text-gray-400" />
      </div>
      <p className="text-xs font-medium text-gray-500">No {status === "all" ? "" : status} items</p>
      <p className="text-xs text-gray-400 mt-1">New items from monitors will appear here</p>
    </div>
  );
}

// ── Item detail ───────────────────────────────────────────────────────────────

function ItemDetail({
  item, onStatusChange, isPending,
}: {
  item: CollectedItemRow;
  onStatusChange: (status: ItemStatus) => void;
  isPending: boolean;
}) {
  const a = item.analysis;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-snug">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <SourceBadge source={item.source} />
              <StatusBadge status={item.status} />
              {a && (
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", priorityColor(a.priorityScore))}>
                  Priority {a.priorityScore}
                </span>
              )}
              <span className="text-xs text-gray-400">{timeAgo(item.collectedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 text-xs font-semibold transition-colors">
                <ExternalLink size={12} />View Source
              </a>
            )}
            {item.status !== "reviewed" && (
              <button onClick={() => onStatusChange("reviewed")} disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                <CheckCircle size={13} />Mark Reviewed
              </button>
            )}
            {item.status !== "archived" && (
              <button onClick={() => onStatusChange("archived")} disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-60">
                <Archive size={13} />Archive
              </button>
            )}
            {item.status === "archived" && (
              <button onClick={() => onStatusChange("new")} disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-60">
                <RefreshCw size={13} />Restore
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          {item.status === "processing" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <Loader2 size={16} className="text-amber-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">AI analysis in progress</p>
                <p className="text-xs text-amber-600">This item is being processed through the intelligence pipeline…</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FolderOpen size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Original Content</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Source</p>
                    <p className="text-gray-700 font-medium capitalize">{item.source}</p>
                  </div>
                </div>
                {item.author && (
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase font-semibold">Author</p>
                      <p className="text-gray-700 font-medium truncate">{item.author}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Collected</p>
                    <p className="text-gray-700 font-medium">{new Date(item.collectedAt).toLocaleString()}</p>
                  </div>
                </div>
                {item.url && (
                  <div className="flex items-center gap-2 col-span-2">
                    <ExternalLink size={12} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold">Source URL</p>
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-brand-600 hover:underline font-medium text-xs truncate block">
                        {item.url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {item.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                      <Hash size={8} />{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-4">
                {item.content}
              </div>
            </div>
          </div>

          {a ? (
            <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-100 bg-brand-50 flex items-center gap-2">
                <Brain size={13} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">AI Analysis</span>
                <span className="ml-auto text-[10px] text-brand-400">Processed {timeAgo(a.processedAt)}</span>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{a.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Activity,   label: "Intent",    val: a.intent   },
                    { icon: Building2,  label: "Industry",  val: a.industry  },
                    { icon: FolderOpen, label: "Category",  val: a.category  },
                  ].map(({ icon: Icon, label, val }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={11} className="text-gray-400" />
                        <p className="text-[10px] uppercase font-semibold text-gray-400">{label}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{val}</p>
                    </div>
                  ))}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Smile size={11} className="text-gray-400" />
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Sentiment</p>
                    </div>
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-semibold",
                      SENTIMENT_META[a.sentiment]?.bg ?? "bg-gray-100",
                      SENTIMENT_META[a.sentiment]?.color ?? "text-gray-700")}>
                      {a.sentiment}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Priority Score", val: a.priorityScore,
                      barColor: a.priorityScore >= 80 ? "bg-red-500" : a.priorityScore >= 60 ? "bg-amber-500" : "bg-gray-400",
                      textColor: a.priorityScore >= 80 ? "text-red-600" : a.priorityScore >= 60 ? "text-amber-600" : "text-gray-600" },
                    { label: "Confidence Score", val: a.confidenceScore, barColor: "bg-brand-500", textColor: "text-brand-600" },
                  ].map(({ label, val, barColor, textColor }) => (
                    <div key={label} className="rounded-lg border p-3 text-center">
                      <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">{label}</p>
                      <p className={cn("text-2xl font-bold", textColor)}>{val}</p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Send size={11} className="text-brand-500" />
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Suggested Professional Reply</p>
                  </div>
                  <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                    {a.suggestedReply}
                  </div>
                </div>
              </div>
            </div>
          ) : item.status === "new" ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
              <Clock size={15} className="text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Queued for analysis</p>
                <p className="text-xs text-blue-600">This item will be processed by the AI pipeline shortly.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Inbox page ───────────────────────────────────────────────────────────

export default function Inbox() {
  const [selectedId, setSelectedId]         = useState<number | null>(null);
  const [statusFilter, setStatusFilter]     = useState<string>("all");
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
  const [newItemsAlert, setNewItemsAlert]   = useState(0);  // count of newly arrived items
  const prevAllCount                        = useRef<number | null>(null);
  const prevNewIds                          = useRef<Set<number>>(new Set());  // IDs seen as "new" last tick
  const qc = useQueryClient();

  const { data: listData, isLoading, dataUpdatedAt } = useQuery<ListData>({
    queryKey: ["inbox", statusFilter],
    queryFn: () => apiFetch(`/api/inbox?status=${statusFilter}&limit=100`) as Promise<ListData>,
    refetchInterval: 7000,
  });

  const { data: selectedItem, isLoading: itemLoading } = useQuery<CollectedItemRow>({
    queryKey: ["inbox-item", selectedId],
    queryFn: () => apiFetch(`/api/inbox/${selectedId}`) as Promise<CollectedItemRow>,
    enabled: selectedId !== null,
    refetchInterval: (query) => query.state.data?.status === "processing" ? 2000 : false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ItemStatus }) =>
      apiFetch(`/api/inbox/${id}`, "PATCH", { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-item", selectedId] });
    },
  });

  const items  = listData?.items  ?? [];
  const counts = listData?.counts ?? { new: 0, processing: 0, reviewed: 0, archived: 0, all: 0 };

  // ── Detect newly arrived items ──────────────────────────────────────────────
  useEffect(() => {
    if (prevAllCount.current === null) {
      prevAllCount.current = counts.all;
      return;
    }
    if (counts.all > prevAllCount.current) {
      setNewItemsAlert(counts.all - prevAllCount.current);
    }
    prevAllCount.current = counts.all;
  }, [counts.all]);

  // Items that are currently "new" status (recently arrived)
  const newStatusIds = new Set(items.filter((i) => i.status === "new").map((i) => i.id));

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function handleExport() {
    const toExport = items.filter((i) => selectedIds.has(i.id));
    if (toExport.length === 0) return;
    exportToXLS(toExport);
  }

  // Format last-updated time
  const secondsAgo = dataUpdatedAt ? Math.round((Date.now() - dataUpdatedAt) / 1000) : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-white min-h-0">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 shrink-0">Intelligence Inbox</h1>
              {/* LIVE badge */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-[9px] font-bold text-green-700 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {secondsAgo !== null && (
                <span className="text-[9px] text-gray-400 hidden sm:block">
                  {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
                </span>
              )}
              <button onClick={() => qc.invalidateQueries({ queryKey: ["inbox"] })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Refresh">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* New items alert */}
        {newItemsAlert > 0 && (
          <div className="mx-3 mt-2 mb-1 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl shrink-0">
            <Bell size={12} className="text-blue-500 shrink-0 animate-bounce" />
            <p className="text-xs text-blue-700 font-semibold flex-1">
              {newItemsAlert} new item{newItemsAlert > 1 ? "s" : ""} arrived
            </p>
            <button onClick={() => { setStatusFilter("new"); setNewItemsAlert(0); }}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline">
              View
            </button>
            <button onClick={() => setNewItemsAlert(0)} className="text-blue-400 hover:text-blue-600">
              <X size={11} />
            </button>
          </div>
        )}

        {/* Monitors panel */}
        <div className="shrink-0">
          <MonitorsPanel />
        </div>

        {/* Filter tabs + select-all row */}
        <div className="flex flex-col px-2 py-2 gap-0.5 border-b border-gray-100 shrink-0">
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div onClick={toggleSelectAll}
              className={cn("w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0",
                allSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 hover:border-blue-400")}>
              {allSelected && <CheckCircle size={10} className="text-white" />}
              {!allSelected && someSelected && (
                <span className="w-2 h-0.5 bg-blue-400 rounded" />
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-medium flex-1">
              {someSelected
                ? `${selectedIds.size} of ${items.length} selected`
                : `Select all (${items.length})`}
            </span>
            {someSelected && (
              <button onClick={handleExport}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-bold transition-colors">
                <Download size={10} />
                Export XLS
              </button>
            )}
          </div>

          {FILTERS.map(({ key, label }) => {
            const count = counts[key as keyof typeof counts] ?? 0;
            const isActive = statusFilter === key;
            return (
              <button key={key} onClick={() => { setStatusFilter(key); setSelectedIds(new Set()); }}
                className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50")}>
                <span>{label}</span>
                {count > 0 && (
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    key === "new" ? "bg-blue-500 text-white"
                    : key === "processing" ? "bg-amber-500 text-white"
                    : isActive ? "bg-brand-200 text-brand-700"
                    : "bg-gray-100 text-gray-500")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="text-gray-300 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyList status={statusFilter} />
          ) : (
            items.map((item) => (
              <ItemEntry
                key={item.id}
                item={item}
                active={item.id === selectedId}
                selected={selectedIds.has(item.id)}
                isNew={newStatusIds.has(item.id)}
                onClick={() => setSelectedId(item.id)}
                onToggleSelect={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
              />
            ))
          )}
        </div>

        {/* Bulk action bar — fixed at bottom */}
        {someSelected && (
          <div className="shrink-0 border-t border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs font-bold text-blue-700 flex-1">
              {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors">
              <Download size={12} />
              Export XLS
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel: detail ───────────────────────────────────────── */}
      {selectedId === null ? (
        <NoSelection />
      ) : itemLoading ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <Loader2 size={24} className="text-gray-300 animate-spin" />
        </div>
      ) : selectedItem ? (
        <ItemDetail
          item={selectedItem}
          onStatusChange={(status) => updateStatus.mutate({ id: selectedItem.id, status })}
          isPending={updateStatus.isPending}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Item not found</p>
          </div>
        </div>
      )}
    </div>
  );
}
