import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "../components/layout/AppShell";
import { apiFetch } from "../lib/queryClient";
import { cn } from "../lib/utils";
import type { CollectorConfigRow } from "@shared/types";
import {
  MessageSquare, Rss, Mail, Webhook, Database, Globe,
  MessageCircle, Users, Bot, Slack, CheckCircle,
  Key, ChevronDown, Zap,
} from "lucide-react";

interface Collector {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
  tags: string[];
}

const COLLECTORS: Collector[] = [
  {
    id: "reddit",
    name: "Reddit API",
    description: "Monitor subreddits, mentions, and keyword threads. Automatically ingest posts and comments matching your intelligence criteria.",
    icon: MessageSquare,
    color: "bg-orange-100 text-orange-600",
    category: "Social Media",
    tags: ["Subreddits", "Keyword monitoring", "Comment threads"],
  },
  {
    id: "rss",
    name: "RSS Feeds",
    description: "Subscribe to RSS and Atom feeds from news sites, blogs, and industry publications. New articles are collected and analysed automatically.",
    icon: Rss,
    color: "bg-yellow-100 text-yellow-600",
    category: "Content",
    tags: ["News sites", "Blogs", "Trade publications", "Atom feeds"],
  },
  {
    id: "email",
    name: "Email Inbox",
    description: "Connect a dedicated inbox to collect incoming emails. Parse sender, subject, and body into the intelligence pipeline.",
    icon: Mail,
    color: "bg-blue-100 text-blue-600",
    category: "Communication",
    tags: ["IMAP / SMTP", "Gmail", "Outlook", "Forwarding rules"],
  },
  {
    id: "webhook",
    name: "Webhooks",
    description: "Accept real-time data pushes from any external system. Send a POST request with title and content to ingest immediately.",
    icon: Webhook,
    color: "bg-purple-100 text-purple-600",
    category: "Developer",
    tags: ["REST API", "Real-time", "Any source", "Custom headers"],
  },
  {
    id: "crm",
    name: "CRM Integration",
    description: "Sync contacts, leads, and activity logs from your CRM. Surface high-priority accounts and track engagement signals.",
    icon: Database,
    color: "bg-green-100 text-green-600",
    category: "Business",
    tags: ["Salesforce", "HubSpot", "Pipedrive", "Custom CRM"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Monitor channels and direct messages for relevant discussions. Surface action items and insights from team conversations.",
    icon: Slack,
    color: "bg-pink-100 text-pink-600",
    category: "Communication",
    tags: ["Channels", "DMs", "Keywords", "Bot integration"],
  },
  {
    id: "web_scraper",
    name: "Web Monitor",
    description: "Track changes on specific URLs — competitor pages, regulatory announcements, or any public web content.",
    icon: Globe,
    color: "bg-teal-100 text-teal-600",
    category: "Content",
    tags: ["Page monitoring", "Change detection", "Scheduling"],
  },
  {
    id: "twitter",
    name: "X / Twitter",
    description: "Monitor hashtags, keywords, and account mentions. Collect tweets and threads matching your intelligence topics.",
    icon: MessageCircle,
    color: "bg-sky-100 text-sky-600",
    category: "Social Media",
    tags: ["Hashtags", "Mentions", "Keywords", "Lists"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Track company updates, industry posts, and professional discussions relevant to your intelligence focus areas.",
    icon: Users,
    color: "bg-indigo-100 text-indigo-600",
    category: "Social Media",
    tags: ["Company pages", "Industry posts", "Job signals"],
  },
  {
    id: "api",
    name: "Custom API",
    description: "Connect any external API using our configurable connector framework. Define endpoints, authentication, and field mapping.",
    icon: Bot,
    color: "bg-gray-100 text-gray-600",
    category: "Developer",
    tags: ["REST", "GraphQL", "OAuth", "API key"],
  },
];

const CATEGORIES = ["All", "Social Media", "Content", "Communication", "Business", "Developer"];

// Collectors that work without an API key (public APIs or already active)
const READY_IDS = new Set(["reddit", "rss", "webhook", "web_scraper"]);

const READY_INFO: Record<string, string> = {
  reddit:
    "Uses Reddit's public API — no key needed. Set up a Monitor in the Inbox to start pulling posts on any topic.",
  rss:
    "Works with any public RSS or Atom feed URL — no key needed. Set up a Monitor in the Inbox and paste a feed URL.",
  webhook:
    "Already active. POST to /api/collect with { title, content, source } to ingest any item in real-time.",
  web_scraper:
    "No global key needed. Configure specific URLs when setting up a Monitor in the Inbox.",
};

const API_KEY_LABEL: Record<string, string> = {
  email: "IMAP Password or App Password",
  crm: "CRM API Key",
  slack: "Slack Bot Token (xoxb-…)",
  twitter: "X / Twitter Bearer Token",
  linkedin: "LinkedIn API Key",
  api: "API Key",
};

export default function Collectors() {
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ["collector-configs"],
    queryFn: () => apiFetch("/api/collector-config"),
  });

  const configs: CollectorConfigRow[] = (configData as any)?.configs ?? [];
  const configMap = new Map(configs.map((c) => [c.collectorId, c]));

  const filtered =
    filter === "All" ? COLLECTORS : COLLECTORS.filter((c) => c.category === filter);

  function handleExpand(id: string) {
    const saved = configMap.get(id);
    setApiKeyDraft(saved?.apiKey ?? "");
    setExpandedId(expandedId === id ? null : id);
  }

  async function handleSaveKey(collectorId: string) {
    setSaving(collectorId);
    try {
      await apiFetch(`/api/collector-config/${collectorId}`, "PUT", {
        apiKey: apiKeyDraft.trim(),
        enabled: true,
      });
      await qc.invalidateQueries({ queryKey: ["collector-configs"] });
      setExpandedId(null);
    } finally {
      setSaving(null);
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Intelligence Collectors</h1>
            <p className="mt-1 text-sm text-gray-500">
              Connect data sources to feed your AI processing pipeline. Each collector sends data through the same standard interface — enabling automatic analysis without pipeline changes.
            </p>
          </div>

          {/* Architecture note */}
          <div className="mb-6 rounded-xl bg-brand-50 border border-brand-100 p-4 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-900">Modular Pipeline Architecture</p>
              <p className="text-xs text-brand-700 mt-0.5">
                Every collector POSTs to the same{" "}
                <code className="bg-brand-100 px-1 rounded text-brand-800">/api/collect</code>{" "}
                endpoint — title, content, source, URL, author, and tags. The AI processing engine never
                needs to change when new collectors are added.
              </p>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === cat
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Collector grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((collector) => {
              const Icon = collector.icon;
              const savedConfig = configMap.get(collector.id);
              const isReady = READY_IDS.has(collector.id);
              const isConfigured = !isReady && savedConfig?.enabled;
              const isExpanded = expandedId === collector.id;
              const readyNote = READY_INFO[collector.id];

              return (
                <div
                  key={collector.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden flex flex-col"
                >
                  {/* Status badge */}
                  <div className="absolute top-4 right-4">
                    {isReady ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Ready
                      </span>
                    ) : isConfigured ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
                        <CheckCircle size={10} className="text-brand-600" />
                        Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        Not Configured
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        collector.color,
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-sm font-semibold text-gray-900">{collector.name}</h3>
                      <span className="text-xs text-gray-400">{collector.category}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed mb-3 flex-1">
                    {collector.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {collector.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-xs bg-gray-50 text-gray-500 border border-gray-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer section */}
                  <div className="border-t border-gray-100 pt-3">
                    {isReady ? (
                      /* Green info strip for ready collectors */
                      <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                        <Zap size={11} className="shrink-0 mt-0.5 text-green-500" />
                        <p>{readyNote}</p>
                      </div>
                    ) : !isExpanded ? (
                      /* "Configure" button for API-key collectors */
                      <button
                        onClick={() => handleExpand(collector.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        <Key size={11} />
                        {isConfigured ? "Reconfigure API Key" : "Enter API Key to Connect"}
                        <ChevronDown size={11} />
                      </button>
                    ) : (
                      /* Inline API key form */
                      <div className="space-y-2">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {API_KEY_LABEL[collector.id] ?? "API Key"}
                        </label>
                        <input
                          type="password"
                          value={apiKeyDraft}
                          onChange={(e) => setApiKeyDraft(e.target.value)}
                          placeholder="Paste your key here…"
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-gray-50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && apiKeyDraft.trim()) handleSaveKey(collector.id);
                            if (e.key === "Escape") setExpandedId(null);
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveKey(collector.id)}
                            disabled={!apiKeyDraft.trim() || saving === collector.id}
                            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                          >
                            {saving === collector.id ? "Saving…" : "Save Key"}
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Webhook CTA */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Push data in right now</h3>
            <p className="text-xs text-gray-500 mb-4">
              The webhook endpoint is already live. POST from any external tool, script, or integration — no setup required.
            </p>
            <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-700 font-mono text-left">
              POST /api/collect<br />
              {"{"} "title": "...", "content": "...", "source": "webhook" {"}"}
            </code>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
