import { useState, useRef, useEffect, useCallback } from "react";
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
  Trash2, Wifi, Download, Bell, X, Search, Timer,
  Stethoscope, ShieldCheck, TrendingUp, BarChart3,
  Filter, Tag, Star, AlertTriangle, Zap,
} from "lucide-react";
import type { CollectedItemRow, ItemStatus, MonitorRow, ProcessingStep } from "@shared/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and decode common entities from a string */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ListData {
  items: CollectedItemRow[];
  counts: { new: number; processing: number; reviewed: number; archived: number; all: number };
}

// ── Source / Status / Sentiment meta ─────────────────────────────────────────

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

function seoColor(score: number): { bar: string; text: string; bg: string; label: string } {
  if (score >= 75) return { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200", label: "Excellent" };
  if (score >= 55) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Good" };
  if (score >= 35) return { bar: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "Fair" };
  return { bar: "bg-red-400", text: "text-red-600", bg: "bg-red-50 border-red-200", label: "Low" };
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
    "Title":            item.title,
    "Source":           item.source,
    "URL":              item.url ?? "",
    "Author":           item.author ?? "",
    "Collected At":     new Date(item.collectedAt).toLocaleString(),
    "Status":           item.status,
    "Tags":             (item.tags ?? []).join(", "),
    "Summary":          item.analysis?.summary ?? "",
    "Description":      item.analysis?.description ?? stripHtml(item.content).slice(0, 300),
    "SEO Score":        item.analysis?.seoScore ?? "",
    "SEO Keywords":     (item.analysis?.seoKeywords ?? []).join(", "),
    "Author Authority": item.analysis?.authorAuthority ?? "",
    "Merit Passed":     item.analysis?.meritPassed ?? "",
    "Priority Score":   item.analysis?.priorityScore ?? "",
    "Sentiment":        item.analysis?.sentiment ?? "",
    "Intent":           item.analysis?.intent ?? "",
    "Industry":         item.analysis?.industry ?? "",
    "Category":         item.analysis?.category ?? "",
    "Suggested Reply":  item.analysis?.suggestedReply ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.min(60, Math.max(key.length + 2, ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length))),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Medical Intelligence");
  XLSX.writeFile(wb, `iheal-medical-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Source / Timeline configs ─────────────────────────────────────────────────

const SOURCES = [
  { id: "reddit", label: "Reddit",  color: "text-orange-600" },
  { id: "quora",  label: "Quora",   color: "text-red-600"    },
  { id: "web",    label: "Web",     color: "text-blue-600"   },
] as const;

const TIMELINES = [
  { value: "hour",  label: "Past hour"     },
  { value: "day",   label: "Past 24 hours" },
  { value: "week",  label: "Past week"     },
  { value: "month", label: "Past month"    },
] as const;

// ── Monitors panel ────────────────────────────────────────────────────────────

function MonitorsPanel({ onSearchDone }: { onSearchDone: () => void }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showForm, setShowForm]     = useState(false);

  const [formTopic,     setFormTopic]     = useState("");
  const [formSources,   setFormSources]   = useState<Set<string>>(new Set(["web"]));
  const [formTimeline,  setFormTimeline]  = useState("week");
  const [formSubreddit, setFormSubreddit] = useState("");
  const [searching, setSearching]         = useState<number | null>(null);

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

  function toggleSource(id: string) {
    setFormSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSearch() {
    if (!formTopic.trim()) return;
    setSearching(-1);

    const srcArr = [...formSources];
    const primarySource = srcArr.length === 1 ? srcArr[0] : "multi";

    let monitor: MonitorRow;
    try {
      const resp = await apiFetch<{ monitor: MonitorRow }>("/api/monitors", "POST", {
        name: formTopic.trim(),
        topic: formTopic.trim(),
        source: primarySource,
        sourceConfig: {
          sources: JSON.stringify(srcArr),
          timeFilter: formTimeline,
          subreddit: formSubreddit.trim(),
        },
      });
      monitor = resp.monitor;
    } catch {
      setSearching(null);
      return;
    }

    await qc.invalidateQueries({ queryKey: ["monitors"] });

    setSearching(monitor.id);
    try {
      await apiFetch(`/api/monitors/${monitor.id}/run`, "POST");
      await qc.invalidateQueries({ queryKey: ["inbox"] });
      await qc.invalidateQueries({ queryKey: ["monitors"] });
      // Auto-switch to processing tab to watch merit filtering
      onSearchDone();
    } finally {
      setSearching(null);
      setFormTopic("");
      setFormSubreddit("");
      setFormSources(new Set(["web"]));
      setFormTimeline("week");
      setShowForm(false);
    }
  }

  function monitorSources(m: MonitorRow): string {
    const cfg = m.sourceConfig as Record<string, string>;
    if (cfg?.sources) {
      try { return JSON.parse(cfg.sources).join(", "); } catch { /* */ }
    }
    return m.source;
  }

  return (
    <div className="border-b border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button onClick={() => setIsExpanded((v) => !v)} className="flex items-center gap-1.5 flex-1 min-w-0">
          <Wifi size={11} className={cn("shrink-0", activeCount > 0 ? "text-green-500" : "text-gray-400")} />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Medical Research</span>
          {activeCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-700">
              {activeCount} live · 5min
            </span>
          )}
          {isExpanded
            ? <ChevronUp size={11} className="text-gray-400 ml-auto shrink-0" />
            : <ChevronDown size={11} className="text-gray-400 ml-auto shrink-0" />}
        </button>
        <button
          onClick={() => { setShowForm((v) => !v); setIsExpanded(true); }}
          className={cn("p-1 rounded-md transition-colors shrink-0",
            showForm ? "bg-brand-100 text-brand-700" : "text-gray-400 hover:text-brand-600 hover:bg-gray-100")}
          title="New medical search"
        >
          <Plus size={12} />
        </button>
      </div>

      {isExpanded && (
        <div className="pb-2">

          {/* ── New search form ───────────────────────────────────────── */}
          {showForm && (
            <div className="mx-3 mb-2 bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-2.5">
              {/* Medical focus badge */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={10} /> Medical Research Search
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 border border-teal-200 text-[9px] font-bold text-teal-700">
                  <Stethoscope size={8} /> Medical Only
                </span>
              </div>

              {/* Medical context notice */}
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-teal-50 rounded-lg border border-teal-100 text-[10px] text-teal-700">
                <ShieldCheck size={10} className="shrink-0 mt-0.5 text-teal-500" />
                Searches are automatically scoped to human medical conditions, diagnoses, and treatments.
              </div>

              {/* Topic input */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 font-medium">Medical topic or condition</label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. diabetes insulin resistance, COPD treatment"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  autoFocus
                />
              </div>

              {/* Source checkboxes */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 font-medium">Search in</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map(({ id, label, color }) => (
                    <label
                      key={id}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none",
                        formSources.has(id)
                          ? "bg-white border-brand-400 text-brand-700 shadow-sm"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formSources.has(id)}
                        onChange={() => toggleSource(id)}
                        className="accent-brand-600 w-3 h-3"
                      />
                      <span className={cn("font-semibold", formSources.has(id) ? color : "")}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formSources.has("reddit") && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 font-medium">
                    Subreddit <span className="text-gray-400">(optional, e.g. medicine)</span>
                  </label>
                  <input
                    type="text"
                    value={formSubreddit}
                    onChange={(e) => setFormSubreddit(e.target.value)}
                    placeholder="e.g. medicine, askdocs, healthcareworkers"
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                </div>
              )}

              {/* Timeline */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 font-medium">Publication timeline</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIMELINES.map(({ value, label }) => (
                    <label
                      key={value}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors select-none",
                        formTimeline === value
                          ? "bg-white border-brand-400 text-brand-700 shadow-sm"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="mon-timeline"
                        checked={formTimeline === value}
                        onChange={() => setFormTimeline(value)}
                        className="accent-brand-600 w-3 h-3"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Process notice */}
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-white rounded-lg border border-gray-200 text-[10px] text-gray-500">
                <Zap size={10} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Results auto-route to <strong className="text-gray-700">Processing</strong> where merit filters (date, authority, SEO ≥ 30) run before passing to <strong className="text-gray-700">Review</strong>.</span>
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={handleSearch}
                  disabled={searching !== null || !formTopic.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {searching !== null ? (
                    <><Loader2 size={11} className="animate-spin" />Searching…</>
                  ) : (
                    <><Search size={11} />Search Medical Sources</>
                  )}
                </button>
                <button
                  onClick={() => { setShowForm(false); setSearching(null); }}
                  className="px-2.5 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Monitor list ──────────────────────────────────────────── */}
          {monitorList.length === 0 ? (
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1.5">No medical searches running yet</p>
              <button
                onClick={() => { setShowForm(true); setIsExpanded(true); }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:underline"
              >
                <Search size={10} /> Start a medical research search
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-52 overflow-y-auto space-y-px px-2">
                {monitorList.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      searching === m.id
                        ? "bg-brand-500 animate-pulse"
                        : m.status === "active"
                          ? "bg-green-500 animate-pulse"
                          : m.status === "paused" ? "bg-amber-400" : "bg-gray-300",
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{m.name}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-semibold text-gray-400 uppercase">
                          {monitorSources(m)}
                        </span>
                        {m.lastRunAt && (
                          <span className="text-[9px] text-gray-400">· {timeAgo(m.lastRunAt)}</span>
                        )}
                        {searching === m.id && (
                          <span className="text-[9px] text-brand-500 font-semibold">· Searching…</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          setSearching(m.id);
                          try {
                            await apiFetch(`/api/monitors/${m.id}/run`, "POST");
                            await qc.invalidateQueries({ queryKey: ["inbox"] });
                            await qc.invalidateQueries({ queryKey: ["monitors"] });
                            onSearchDone();
                          } finally { setSearching(null); }
                        }}
                        disabled={searching !== null}
                        title="Search now"
                        className="p-1 rounded hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-30"
                      >
                        <Search size={9} />
                      </button>

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

const FILTERS: { key: string; label: string; description: string }[] = [
  { key: "all",        label: "All Items",     description: "All collected items" },
  { key: "new",        label: "New",           description: "Awaiting processing" },
  { key: "processing", label: "Processing",    description: "Merit filter running" },
  { key: "reviewed",   label: "Final Review",  description: "Passed all merit checks" },
  { key: "archived",   label: "Filtered",      description: "Did not meet merit criteria" },
];

// ── Processing step metadata ──────────────────────────────────────────────────

const STEP_ORDER: ProcessingStep[] = [
  "pending", "fetching_page", "extracting_metadata",
  "checking_medical", "checking_date", "running_seo",
  "completed", "rejected",
];

const STEP_META: Record<ProcessingStep, { label: string; color: string; bg: string; dot: string }> = {
  pending:              { label: "Pending",                    color: "text-gray-500",   bg: "bg-gray-100",   dot: "bg-gray-400"   },
  fetching_page:        { label: "Fetching page",              color: "text-blue-600",   bg: "bg-blue-50",    dot: "bg-blue-400"   },
  extracting_metadata:  { label: "Extracting metadata",        color: "text-indigo-600", bg: "bg-indigo-50",  dot: "bg-indigo-400" },
  checking_medical:     { label: "Checking medical relevance", color: "text-teal-700",   bg: "bg-teal-50",    dot: "bg-teal-500"   },
  checking_date:        { label: "Checking publish date",      color: "text-cyan-700",   bg: "bg-cyan-50",    dot: "bg-cyan-500"   },
  running_seo:          { label: "Running SEO analysis",       color: "text-amber-700",  bg: "bg-amber-50",   dot: "bg-amber-500"  },
  completed:            { label: "Completed",                  color: "text-green-700",  bg: "bg-green-50",   dot: "bg-green-500"  },
  rejected:             { label: "Rejected",                   color: "text-red-600",    bg: "bg-red-50",     dot: "bg-red-400"    },
};

function ProcessingStepBadge({ step }: { step: ProcessingStep }) {
  const meta  = STEP_META[step] ?? STEP_META.pending;
  const isDone = step === "completed" || step === "rejected";
  const isActive = !isDone && step !== "pending";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border",
      meta.bg, meta.color,
      isDone ? "border-transparent" : "border-current border-opacity-20",
    )}>
      {isActive && <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse shrink-0", meta.dot)} />}
      {meta.label}
    </span>
  );
}

// ── Item list entry ───────────────────────────────────────────────────────────

function ItemEntry({
  item, active, selected, isNew, onClick, onToggleSelect,
}: {
  item: CollectedItemRow;
  active: boolean;
  selected: boolean;
  isNew: boolean;
  onClick: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
}) {
  const seo = item.analysis ? seoColor(item.analysis.seoScore) : null;

  return (
    <div
      className={cn(
        "w-full text-left border-b border-gray-100 transition-colors relative flex items-stretch",
        active   ? "bg-brand-50 border-l-2 border-l-brand-500" : "hover:bg-gray-50",
        selected ? "bg-blue-50 border-l-2 border-l-blue-400" : "",
        isNew && !active && !selected ? "border-l-2 border-l-blue-300" : "",
      )}
    >
      {/* Checkbox */}
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
          <p className={cn("text-xs font-semibold leading-snug line-clamp-2 flex-1 min-w-0 break-words",
            active ? "text-brand-800" : "text-gray-800")}>
            {isNew && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle shrink-0" />
            )}
            {item.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {seo && (
              <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded border", seo.bg, seo.text)}>
                SEO {item.analysis!.seoScore}
              </span>
            )}
            {item.analysis && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border",
                priorityColor(item.analysis.priorityScore))}>
                {item.analysis.priorityScore}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourceBadge source={item.source} />
          <StatusBadge status={item.status} />
          {item.status === "processing" && (
            <ProcessingStepBadge step={item.processingStep} />
          )}
          {item.analysis?.meritPassed === false && (
            <span className="inline-flex items-center gap-1 text-[9px] text-red-500 font-semibold">
              <AlertTriangle size={8} />Filtered
            </span>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-[10px] text-brand-500 hover:text-brand-700 ml-0.5"
              title="View source">
              <ExternalLink size={9} />
            </a>
          )}
          <span className="text-[10px] text-gray-400 ml-auto shrink-0">{timeAgo(item.collectedAt)}</span>
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
        <Stethoscope size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">Select a medical item</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">Choose an item from the list to view its content, AI analysis, and SEO metrics</p>
    </div>
  );
}

function EmptyList({ status }: { status: string }) {
  const msg: Record<string, { title: string; sub: string }> = {
    processing: { title: "Nothing processing right now", sub: "Start a medical search — items will appear here while merit filters run" },
    reviewed:   { title: "No items in Review", sub: "Items that pass all merit checks (medical + SEO ≥ 30) appear here" },
    archived:   { title: "No filtered items", sub: "Items that fail medical relevance or SEO checks are archived here" },
    new:        { title: "No new items", sub: "New items from medical monitors will appear here" },
    all:        { title: "No items yet", sub: "Start a medical research search to begin collecting intelligence" },
  };
  const { title, sub } = msg[status] ?? msg.all;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <InboxIcon size={18} className="text-gray-400" />
      </div>
      <p className="text-xs font-semibold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ── Processing merit panel ────────────────────────────────────────────────────

const PIPELINE_STEPS: { step: ProcessingStep; label: string }[] = [
  { step: "fetching_page",       label: "Fetching page content"       },
  { step: "extracting_metadata", label: "Extracting metadata"         },
  { step: "checking_medical",    label: "Checking medical relevance"  },
  { step: "checking_date",       label: "Checking publish date"       },
  { step: "running_seo",         label: "Running SEO analysis"        },
];

function ProcessingMeritPanel({ item }: { item: CollectedItemRow }) {
  const currentIdx = STEP_ORDER.indexOf(item.processingStep);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-amber-500 shrink-0 animate-pulse" />
        <p className="text-sm font-semibold text-amber-800">Processing Pipeline</p>
        <Loader2 size={12} className="text-amber-500 animate-spin ml-auto" />
      </div>
      <p className="text-xs text-amber-600">
        Live view — each step runs in sequence. Items that pass all checks advance to Final Review.
      </p>

      {/* Step-by-step pipeline */}
      <div className="space-y-1.5">
        {PIPELINE_STEPS.map(({ step, label }) => {
          const stepIdx    = STEP_ORDER.indexOf(step);
          const isDone     = currentIdx > stepIdx;
          const isActive   = currentIdx === stepIdx;
          const isPending  = currentIdx < stepIdx;

          return (
            <div key={step} className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all",
              isActive  ? "bg-white border-amber-300 shadow-sm" :
              isDone    ? "bg-green-50 border-green-200" :
                          "bg-white/50 border-gray-100",
            )}>
              <div className="shrink-0">
                {isDone    ? <CheckCircle size={13} className="text-green-500" /> :
                 isActive  ? <Loader2    size={13} className="text-amber-500 animate-spin" /> :
                             <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 inline-block" />}
              </div>
              <span className={cn("text-[11px] font-medium flex-1",
                isDone   ? "text-green-700" :
                isActive ? "text-amber-800 font-semibold" :
                           "text-gray-400")}>
                {label}
              </span>
              {isDone && (
                <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                  DONE
                </span>
              )}
              {isActive && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full animate-pulse">
                  RUNNING
                </span>
              )}
              {isPending && (
                <span className="text-[9px] text-gray-400 px-1.5 py-0.5 rounded-full">
                  QUEUED
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current step callout */}
      {item.processingStep !== "completed" && item.processingStep !== "rejected" && (
        <div className="flex items-center gap-2 pt-1">
          <ProcessingStepBadge step={item.processingStep} />
          <span className="text-[10px] text-amber-600">in progress…</span>
        </div>
      )}
    </div>
  );
}

// ── Final Review Panel (for reviewed/passed items) ────────────────────────────

function FinalReviewPanel({ item }: { item: CollectedItemRow }) {
  const a = item.analysis!;
  const seo = seoColor(a.seoScore);

  const passReasons: string[] = [];
  if (a.isMedical)            passReasons.push("Medical content confirmed");
  if (a.seoScore >= 30)       passReasons.push(`SEO score ${a.seoScore}% (≥ 30 threshold)`);
  if (a.authorAuthority >= 40) passReasons.push(`Source authority ${a.authorAuthority}/100`);
  passReasons.push("Published within monitoring window");

  const hostname = (() => {
    try { return new URL(item.url!).hostname.replace(/^www\./, ""); } catch { return item.source; }
  })();

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 flex items-center gap-2">
        <CheckCircle size={15} className="text-white shrink-0" />
        <span className="text-sm font-bold text-white">Passed Final Review</span>
        <span className="ml-auto text-[10px] text-green-100 font-medium">All merit checks passed</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Scores row */}
        <div className="grid grid-cols-3 gap-2">
          <div className={cn("rounded-lg border p-2.5 text-center", seo.bg)}>
            <p className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">SEO Score</p>
            <p className={cn("text-xl font-bold", seo.text)}>{a.seoScore}%</p>
            <p className={cn("text-[9px] font-semibold", seo.text)}>{seo.label}</p>
          </div>
          <div className="rounded-lg border bg-teal-50 border-teal-200 p-2.5 text-center">
            <p className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Medical</p>
            <p className="text-xl font-bold text-teal-700">{a.confidenceScore}%</p>
            <p className="text-[9px] font-semibold text-teal-600">Relevance</p>
          </div>
          <div className="rounded-lg border bg-blue-50 border-blue-200 p-2.5 text-center">
            <p className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Date</p>
            <p className="text-xl font-bold text-blue-700">✓</p>
            <p className="text-[9px] font-semibold text-blue-600">In range</p>
          </div>
        </div>

        {/* Article metadata */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
          {item.url && (
            <div className="flex items-start gap-2">
              <Globe size={11} className="text-gray-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase font-bold text-gray-400">Website</p>
                <p className="text-xs font-semibold text-gray-700">{hostname}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Calendar size={11} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] uppercase font-bold text-gray-400">Published</p>
              <p className="text-xs font-semibold text-gray-700">
                {new Date(item.collectedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {a.description && (
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Article Summary</p>
            <p className="text-xs text-gray-700 leading-relaxed">{a.description}</p>
          </div>
        )}

        {/* Reasons it passed */}
        <div>
          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Why it passed</p>
          <div className="space-y-1">
            {passReasons.map((reason) => (
              <div key={reason} className="flex items-center gap-1.5">
                <CheckCircle size={10} className="text-green-500 shrink-0" />
                <span className="text-[11px] text-green-800">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SEO Keywords */}
        {a.seoKeywords && a.seoKeywords.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Medical Keywords</p>
            <div className="flex flex-wrap gap-1">
              {a.seoKeywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 text-[9px] font-semibold">
                  <Hash size={7} />{kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SEO Panel ─────────────────────────────────────────────────────────────────

function SEOPanel({ analysis }: { analysis: NonNullable<CollectedItemRow["analysis"]> }) {
  const seo = seoColor(analysis.seoScore);

  const metrics = [
    {
      label: "Overall SEO Score",
      value: `${analysis.seoScore}/100`,
      sub: seo.label,
      color: seo.text,
      bg: seo.bg,
      bar: analysis.seoScore,
      barColor: seo.bar,
      icon: BarChart3,
    },
    {
      label: "Author Authority",
      value: `${analysis.authorAuthority}/100`,
      sub: analysis.authorAuthority >= 70 ? "High authority" : analysis.authorAuthority >= 50 ? "Moderate" : "Low authority",
      color: analysis.authorAuthority >= 70 ? "text-green-700" : analysis.authorAuthority >= 50 ? "text-amber-700" : "text-red-600",
      bg: analysis.authorAuthority >= 70 ? "bg-green-50 border-green-200" : analysis.authorAuthority >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200",
      bar: analysis.authorAuthority,
      barColor: analysis.authorAuthority >= 70 ? "bg-green-500" : analysis.authorAuthority >= 50 ? "bg-amber-500" : "bg-red-400",
      icon: Star,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-brand-50 flex items-center gap-2">
        <TrendingUp size={13} className="text-teal-600" />
        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">SEO & Authority Analysis</span>
        <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border", seo.bg, seo.text)}>
          {seo.label}
        </span>
      </div>
      <div className="p-5 space-y-4">

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map(({ label, value, sub, color, bg, bar, barColor, icon: Icon }) => (
            <div key={label} className={cn("rounded-xl border p-3", bg)}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} className={color} />
                <p className="text-[10px] uppercase font-semibold text-gray-400">{label}</p>
              </div>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              <p className={cn("text-[10px] font-medium mt-0.5", color)}>{sub}</p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${bar}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* SEO Keywords */}
        {analysis.seoKeywords && analysis.seoKeywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag size={11} className="text-teal-500" />
              <p className="text-[10px] uppercase font-semibold text-gray-400">Medical SEO Keywords Detected</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.seoKeywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold">
                  <Hash size={8} />{kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SEO breakdown */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">On-Page SEO Metrics</p>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { metric: "Medical Relevance", value: analysis.isMedical ? "✓ Confirmed medical content" : "✗ Non-medical content", good: analysis.isMedical },
              { metric: "SEO Score Rating", value: `${analysis.seoScore}/100 — ${seo.label}`, good: analysis.seoScore >= 55 },
              { metric: "Authority Tier", value: analysis.authorAuthority >= 70 ? "High — reputable source" : analysis.authorAuthority >= 50 ? "Moderate — general source" : "Low — unverified source", good: analysis.authorAuthority >= 50 },
              { metric: "Merit Status", value: analysis.meritPassed ? "✓ Passed all merit filters" : "✗ Failed merit filters", good: analysis.meritPassed },
            ].map(({ metric, value, good }) => (
              <div key={metric} className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] text-gray-500">{metric}</span>
                <span className={cn("text-[11px] font-medium", good ? "text-green-700" : "text-red-600")}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-gray-400 italic">
          SEO metrics calculated from medical keyword density, title quality, content length, and source authority. Items scoring below 30 are automatically filtered out.
        </p>
      </div>
    </div>
  );
}

// ── Item detail ───────────────────────────────────────────────────────────────

function ItemDetail({
  item, onStatusChange, onDelete, isPending,
}: {
  item: CollectedItemRow;
  onStatusChange: (status: ItemStatus) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const a = item.analysis;
  // Clean description: prefer AI-generated description, then strip HTML from content
  const cleanDescription = a?.description || stripHtml(item.content);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0">
        {/* Row 1: title + action buttons */}
        <div className="flex items-start gap-3">
          <h2 className="flex-1 min-w-0 text-sm font-bold text-gray-900 leading-snug break-words">
            {item.title}
          </h2>
          {/* Actions — icon-only with tooltips to save space */}
          <div className="flex items-center gap-1 shrink-0">
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" title="View source"
                className="p-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 text-brand-600 transition-colors">
                <ExternalLink size={13} />
              </a>
            )}
            {item.status !== "reviewed" && item.status !== "archived" && (
              <button onClick={() => onStatusChange("reviewed")} disabled={isPending} title="Approve"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                <CheckCircle size={12} />Approve
              </button>
            )}
            {item.status === "reviewed" && (
              <button onClick={() => onStatusChange("archived")} disabled={isPending} title="Archive"
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-60">
                <Archive size={13} />
              </button>
            )}
            {item.status === "archived" && (
              <button onClick={() => onStatusChange("new")} disabled={isPending} title="Restore"
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-60">
                <RefreshCw size={13} />
              </button>
            )}
            <button onClick={onDelete} disabled={isPending} title="Delete"
              className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 transition-colors disabled:opacity-60">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        {/* Row 2: badges */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <SourceBadge source={item.source} />
          <StatusBadge status={item.status} />
          {a && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", priorityColor(a.priorityScore))}>
              P·{a.priorityScore}
            </span>
          )}
          {a && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", seoColor(a.seoScore).bg, seoColor(a.seoScore).text)}>
              SEO·{a.seoScore}
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(item.collectedAt)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* Final Review panel — shown for reviewed items */}
          {item.status === "reviewed" && a && (
            <FinalReviewPanel item={item} />
          )}

          {/* Processing merit panel */}
          {item.status === "processing" && (
            <ProcessingMeritPanel item={item} />
          )}

          {/* Filtered out notice */}
          {item.status === "archived" && a?.meritPassed === false && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Filtered Out — Did Not Pass Merit Checks</p>
                <p className="text-xs text-red-600 mt-1">
                  {!a.isMedical ? "This item was not identified as medically relevant content. " : ""}
                  {a.seoScore < 30 ? `SEO score (${a.seoScore}) is below the threshold of 30. ` : ""}
                  Items must be medical and score ≥ 30 to advance to Review.
                </p>
              </div>
            </div>
          )}

          {/* Original Content */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FolderOpen size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Article Details</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
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
                    <div className="min-w-0">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold">Author</p>
                      <p className="text-gray-700 font-medium truncate">{item.author}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-semibold">Published</p>
                    <p className="text-gray-700 font-medium">{new Date(item.collectedAt).toLocaleString()}</p>
                  </div>
                </div>
                {item.url && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <ExternalLink size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold">Source URL</p>
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-brand-600 hover:underline font-medium text-xs break-all">
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
              {/* Clean description — no HTML */}
              <div className="text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-4 break-words">
                <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2">Description</p>
                <p>{cleanDescription}</p>
              </div>
            </div>
          </div>

          {/* SEO Panel — shown when we have analysis */}
          {a && <SEOPanel analysis={a} />}

          {/* AI Analysis */}
          {a ? (
            <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-100 bg-brand-50 flex items-center gap-2">
                <Brain size={13} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Medical AI Analysis</span>
                <span className="ml-auto text-[10px] text-brand-400">Processed {timeAgo(a.processedAt)}</span>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{a.summary}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Activity,   label: "Intent",   val: a.intent   },
                    { icon: Building2,  label: "Industry", val: a.industry  },
                    { icon: FolderOpen, label: "Category", val: a.category  },
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
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Suggested Professional Response</p>
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
                <p className="text-sm font-semibold text-blue-800">Queued for medical analysis</p>
                <p className="text-xs text-blue-600">This item will be processed through the AI pipeline shortly (every 6 seconds).</p>
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
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [statusFilter, setStatusFilter]   = useState<string>("all");
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [newItemsAlert, setNewItemsAlert] = useState(0);
  const prevAllCount                      = useRef<number | null>(null);
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

  const deleteItem = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/inbox/${id}`, "DELETE"),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => apiFetch("/api/inbox/bulk-delete", "POST", { ids }),
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const items  = listData?.items  ?? [];
  const counts = listData?.counts ?? { new: 0, processing: 0, reviewed: 0, archived: 0, all: 0 };

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

  const newStatusIds = new Set(items.filter((i) => i.status === "new").map((i) => i.id));
  const allSelected  = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  }

  function handleExport() {
    const toExport = items.filter((i) => selectedIds.has(i.id));
    if (toExport.length === 0) return;
    exportToXLS(toExport);
  }

  // Called by MonitorsPanel after a search run — auto-switch to processing tab
  const handleSearchDone = useCallback(() => {
    setStatusFilter("processing");
    setSelectedIds(new Set());
  }, []);

  const secondsAgo = dataUpdatedAt ? Math.round((Date.now() - dataUpdatedAt) / 1000) : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-white min-h-0">
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="w-72 sm:w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 shrink-0">Medical Intelligence</h1>
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
            <button onClick={() => { setStatusFilter("processing"); setNewItemsAlert(0); }}
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
          <MonitorsPanel onSearchDone={handleSearchDone} />
        </div>

        {/* Filter tabs + select-all */}
        <div className="flex flex-col px-2 py-2 gap-0.5 border-b border-gray-100 shrink-0">
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div onClick={toggleSelectAll}
              className={cn("w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0",
                allSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 hover:border-blue-400")}>
              {allSelected && <CheckCircle size={10} className="text-white" />}
              {!allSelected && someSelected && <span className="w-2 h-0.5 bg-blue-400 rounded" />}
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

          {FILTERS.map(({ key, label, description }) => {
            const count = counts[key as keyof typeof counts] ?? 0;
            const isActive = statusFilter === key;
            return (
              <button key={key} onClick={() => { setStatusFilter(key); setSelectedIds(new Set()); }}
                className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50")}
                title={description}>
                <span>{label}</span>
                {count > 0 && (
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    key === "new"        ? "bg-blue-500 text-white"
                    : key === "processing" ? "bg-amber-500 text-white"
                    : key === "archived"   ? "bg-red-100 text-red-600"
                    : isActive             ? "bg-brand-200 text-brand-700"
                    : "bg-gray-100 text-gray-500")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Processing merit info banner */}
        {statusFilter === "processing" && counts.processing > 0 && (
          <div className="mx-2 mt-1.5 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg shrink-0">
            <div className="flex items-center gap-1.5">
              <Filter size={10} className="text-amber-500 animate-pulse" />
              <p className="text-[10px] text-amber-700 font-semibold">Merit filter running on {counts.processing} item{counts.processing !== 1 ? "s" : ""}…</p>
            </div>
            <p className="text-[9px] text-amber-500 mt-0.5">Checking medical relevance, date, authority &amp; SEO</p>
          </div>
        )}

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

        {/* Bulk action bar */}
        {someSelected && (
          <div className="shrink-0 border-t border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-blue-700 flex-1">
              {selectedIds.size} selected
            </span>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors">
              <Download size={11} />XLS
            </button>
            <button
              onClick={() => { if (confirm(`Delete ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}?`)) bulkDelete.mutate([...selectedIds]); }}
              disabled={bulkDelete.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-60">
              <Trash2 size={11} />{bulkDelete.isPending ? "Deleting…" : "Delete"}
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
          onDelete={() => { if (confirm("Delete this item?")) deleteItem.mutate(selectedItem.id); }}
          isPending={updateStatus.isPending || deleteItem.isPending}
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
