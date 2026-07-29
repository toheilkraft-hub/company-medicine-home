import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import { timeAgo, cn } from "../lib/utils";
import {
  Inbox as InboxIcon, MessageSquare, Rss, Mail, Webhook,
  Database, Globe, RefreshCw, ExternalLink, Clock, Tag,
  CheckCircle, Archive, ChevronRight, AlertCircle, Loader2,
  BarChart3, Brain, Building2, FolderOpen, Smile, Send,
  User, Calendar, Hash, Activity,
} from "lucide-react";
import type { CollectedItemRow, ItemStatus } from "@shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListData {
  items: CollectedItemRow[];
  counts: { new: number; processing: number; reviewed: number; archived: number; all: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  reddit: { label: "Reddit", color: "bg-orange-100 text-orange-700 border-orange-200", Icon: MessageSquare },
  rss: { label: "RSS", color: "bg-yellow-100 text-yellow-700 border-yellow-200", Icon: Rss },
  email: { label: "Email", color: "bg-blue-100 text-blue-700 border-blue-200", Icon: Mail },
  webhook: { label: "Webhook", color: "bg-purple-100 text-purple-700 border-purple-200", Icon: Webhook },
  crm: { label: "CRM", color: "bg-green-100 text-green-700 border-green-200", Icon: Database },
  manual: { label: "Manual", color: "bg-gray-100 text-gray-600 border-gray-200", Icon: Globe },
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  processing: { label: "Processing", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  reviewed: { label: "Reviewed", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};

const SENTIMENT_META: Record<string, { color: string; bg: string }> = {
  Positive: { color: "text-green-700", bg: "bg-green-100" },
  Negative: { color: "text-red-700", bg: "bg-red-100" },
  Neutral: { color: "text-gray-600", bg: "bg-gray-100" },
  Mixed: { color: "text-amber-700", bg: "bg-amber-100" },
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
      <Icon size={9} />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", meta.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "new", label: "New" },
  { key: "processing", label: "Processing" },
  { key: "reviewed", label: "Reviewed" },
  { key: "archived", label: "Archived" },
];

// ── Item list entry ───────────────────────────────────────────────────────────

function ItemEntry({
  item,
  active,
  onClick,
}: {
  item: CollectedItemRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
        active && "bg-brand-50 border-l-2 border-l-brand-500 hover:bg-brand-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={cn("text-xs font-semibold leading-snug line-clamp-2 flex-1", active ? "text-brand-800" : "text-gray-800")}>
          {item.title}
        </p>
        {item.analysis && (
          <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border", priorityColor(item.analysis.priorityScore))}>
            {item.analysis.priorityScore}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <SourceBadge source={item.source} />
        <StatusBadge status={item.status} />
        <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(item.collectedAt)}</span>
      </div>
      {item.author && (
        <p className="text-[10px] text-gray-400 mt-1 truncate">{item.author}</p>
      )}
    </button>
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
      <p className="text-xs text-gray-400 mt-1">New items from collectors will appear here</p>
    </div>
  );
}

// ── Item detail ───────────────────────────────────────────────────────────────

function ItemDetail({
  item,
  onStatusChange,
  isPending,
}: {
  item: CollectedItemRow;
  onStatusChange: (status: ItemStatus) => void;
  isPending: boolean;
}) {
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.new;
  const a = item.analysis;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
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
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {item.status !== "reviewed" && (
              <button
                onClick={() => onStatusChange("reviewed")}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <CheckCircle size={13} />
                Mark Reviewed
              </button>
            )}
            {item.status !== "archived" && (
              <button
                onClick={() => onStatusChange("archived")}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <Archive size={13} />
                Archive
              </button>
            )}
            {item.status === "archived" && (
              <button
                onClick={() => onStatusChange("new")}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                <RefreshCw size={13} />
                Restore
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

          {/* Processing indicator */}
          {item.status === "processing" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <Loader2 size={16} className="text-amber-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">AI analysis in progress</p>
                <p className="text-xs text-amber-600">This item is being processed through the intelligence pipeline…</p>
              </div>
            </div>
          )}

          {/* Original content */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FolderOpen size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Original Content</span>
            </div>
            <div className="p-5">
              {/* Metadata row */}
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
                  <div className="flex items-center gap-2">
                    <ExternalLink size={12} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase font-semibold">URL</p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline font-medium truncate block max-w-[180px]"
                      >
                        {item.url}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {item.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                      <Hash size={8} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-4">
                {item.content}
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          {a ? (
            <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-100 bg-brand-50 flex items-center gap-2">
                <Brain size={13} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">AI Analysis</span>
                <span className="ml-auto text-[10px] text-brand-400">
                  Processed {timeAgo(a.processedAt)}
                </span>
              </div>
              <div className="p-5 space-y-5">

                {/* Summary */}
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{a.summary}</p>
                </div>

                {/* Grid: intent + industry + category + sentiment */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity size={11} className="text-gray-400" />
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Intent</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{a.intent}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 size={11} className="text-gray-400" />
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Industry</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{a.industry}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FolderOpen size={11} className="text-gray-400" />
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Category</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{a.category}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Smile size={11} className="text-gray-400" />
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Sentiment</p>
                    </div>
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-semibold", SENTIMENT_META[a.sentiment]?.bg ?? "bg-gray-100", SENTIMENT_META[a.sentiment]?.color ?? "text-gray-700")}>
                      {a.sentiment}
                    </span>
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Priority Score</p>
                    <p className={cn("text-2xl font-bold", a.priorityScore >= 80 ? "text-red-600" : a.priorityScore >= 60 ? "text-amber-600" : "text-gray-600")}>
                      {a.priorityScore}
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", a.priorityScore >= 80 ? "bg-red-500" : a.priorityScore >= 60 ? "bg-amber-500" : "bg-gray-400")}
                        style={{ width: `${a.priorityScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Confidence Score</p>
                    <p className="text-2xl font-bold text-brand-600">{a.confidenceScore}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${a.confidenceScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Suggested reply */}
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery<ListData>({
    queryKey: ["inbox", statusFilter],
    queryFn: () => apiFetch(`/api/inbox?status=${statusFilter}&limit=100`),
    refetchInterval: 7000,
  });

  const { data: selectedItem, isLoading: itemLoading } = useQuery<CollectedItemRow>({
    queryKey: ["inbox-item", selectedId],
    queryFn: () => apiFetch(`/api/inbox/${selectedId}`),
    enabled: selectedId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2000 : false,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ItemStatus }) =>
      apiFetch(`/api/inbox/${id}`, "PATCH", { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-item", selectedId] });
    },
  });

  const items = listData?.items ?? [];
  const counts = listData?.counts ?? { new: 0, processing: 0, reviewed: 0, archived: 0, all: 0 };

  return (
    <div className="flex-1 flex overflow-hidden bg-white min-h-0">
      {/* ── Left panel: filter + list ─────────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white">
        {/* Panel header */}
        <div className="px-4 py-3.5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-gray-900">Intelligence Inbox</h1>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["inbox"] })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-col px-2 py-2 gap-0.5 border-b border-gray-100 shrink-0">
          {FILTERS.map(({ key, label }) => {
            const count = counts[key as keyof typeof counts] ?? 0;
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    key === "new" ? "bg-blue-500 text-white" :
                    key === "processing" ? "bg-amber-500 text-white" :
                    isActive ? "bg-brand-200 text-brand-700" : "bg-gray-100 text-gray-500"
                  )}>
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
                onClick={() => setSelectedId(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: detail ───────────────────────────────────────────── */}
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
