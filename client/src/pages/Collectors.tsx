import { useState } from "react";
import AppShell from "../components/layout/AppShell";
import {
  MessageSquare, Rss, Mail, Webhook, Database, Globe,
  MessageCircle, Users, Bot, Slack, CheckCircle2,
} from "lucide-react";

interface Collector {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
  status: "not_connected" | "coming_soon";
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
    status: "coming_soon",
    tags: ["Subreddits", "Keyword monitoring", "Comment threads"],
  },
  {
    id: "rss",
    name: "RSS Feeds",
    description: "Subscribe to RSS and Atom feeds from news sites, blogs, and industry publications. New articles are collected and analysed automatically.",
    icon: Rss,
    color: "bg-yellow-100 text-yellow-600",
    category: "Content",
    status: "coming_soon",
    tags: ["News sites", "Blogs", "Trade publications", "Atom feeds"],
  },
  {
    id: "email",
    name: "Email Inbox",
    description: "Connect a dedicated inbox to collect incoming emails. Parse sender, subject, and body into the intelligence pipeline.",
    icon: Mail,
    color: "bg-blue-100 text-blue-600",
    category: "Communication",
    status: "coming_soon",
    tags: ["IMAP / SMTP", "Gmail", "Outlook", "Forwarding rules"],
  },
  {
    id: "webhook",
    name: "Webhooks",
    description: "Accept real-time data pushes from any external system. Send a POST request with title and content to ingest immediately.",
    icon: Webhook,
    color: "bg-purple-100 text-purple-600",
    category: "Developer",
    status: "coming_soon",
    tags: ["REST API", "Real-time", "Any source", "Custom headers"],
  },
  {
    id: "crm",
    name: "CRM Integration",
    description: "Sync contacts, leads, and activity logs from your CRM. Surface high-priority accounts and track engagement signals.",
    icon: Database,
    color: "bg-green-100 text-green-600",
    category: "Business",
    status: "coming_soon",
    tags: ["Salesforce", "HubSpot", "Pipedrive", "Custom CRM"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Monitor channels and direct messages for relevant discussions. Surface action items and insights from team conversations.",
    icon: Slack,
    color: "bg-pink-100 text-pink-600",
    category: "Communication",
    status: "coming_soon",
    tags: ["Channels", "DMs", "Keywords", "Bot integration"],
  },
  {
    id: "web_scraper",
    name: "Web Monitor",
    description: "Track changes on specific URLs — competitor pages, regulatory announcements, or any public web content.",
    icon: Globe,
    color: "bg-teal-100 text-teal-600",
    category: "Content",
    status: "coming_soon",
    tags: ["Page monitoring", "Change detection", "Scheduling"],
  },
  {
    id: "twitter",
    name: "X / Twitter",
    description: "Monitor hashtags, keywords, and account mentions. Collect tweets and threads matching your intelligence topics.",
    icon: MessageCircle,
    color: "bg-sky-100 text-sky-600",
    category: "Social Media",
    status: "coming_soon",
    tags: ["Hashtags", "Mentions", "Keywords", "Lists"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Track company updates, industry posts, and professional discussions relevant to your intelligence focus areas.",
    icon: Users,
    color: "bg-indigo-100 text-indigo-600",
    category: "Social Media",
    status: "coming_soon",
    tags: ["Company pages", "Industry posts", "Job signals"],
  },
  {
    id: "api",
    name: "Custom API",
    description: "Connect any external API using our configurable connector framework. Define endpoints, authentication, and field mapping.",
    icon: Bot,
    color: "bg-gray-100 text-gray-600",
    category: "Developer",
    status: "coming_soon",
    tags: ["REST", "GraphQL", "OAuth", "API key"],
  },
];

const CATEGORIES = ["All", "Social Media", "Content", "Communication", "Business", "Developer"];

export default function Collectors() {
  const [filter, setFilter] = useState("All");

  const filtered = filter === "All"
    ? COLLECTORS
    : COLLECTORS.filter((c) => c.category === filter);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Intelligence Collectors</h1>
            <p className="mt-1 text-sm text-gray-500">
              Future integrations that will feed data into your AI processing pipeline. Each collector sends data through the same standard interface — enabling automatic analysis without pipeline changes.
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
                Every collector below will POST to the same <code className="bg-brand-100 px-1 rounded text-brand-800">/api/collect</code> endpoint with a standard payload — title, content, source, URL, author, and tags. The AI processing engine never needs to change when new collectors are added.
              </p>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === cat
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Collector grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((collector) => {
              const Icon = collector.icon;
              return (
                <div
                  key={collector.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden"
                >
                  {/* Not connected badge */}
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Not Connected
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${collector.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-sm font-semibold text-gray-900">{collector.name}</h3>
                      <span className="text-xs text-gray-400">{collector.category}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{collector.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {collector.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-gray-50 text-gray-500 border border-gray-100">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-gray-300" />
                    <span className="text-xs text-gray-400">Available after business & legal requirements are defined</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manual collection CTA */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Need data now?</h3>
            <p className="text-xs text-gray-500 mb-4">
              Use the Collection API to manually submit intelligence items, or add test data directly to your inbox.
            </p>
            <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-700 font-mono text-left">
              POST /api/collect<br />
              {"{"} "title": "...", "content": "...", "source": "reddit" {"}"}
            </code>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
