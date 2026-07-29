import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/queryClient";
import {
  MessageSquare,
  Database,
  Plug,
  BarChart3,
  Zap,
  BookOpen,
  Users,
  Activity,
  Wifi,
  TrendingUp,
  Clock,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "wouter";

interface DashboardStats {
  totalConversations: number;
  totalMessages: number;
  aiUsageRequests: number;
  knowledgeSources: number;
  teamMembers: number;
  promptLibrarySize: number;
  apiStatus: { gemini: string; openai: string; anthropic: string };
}

const SAMPLE_ACTIVITY = [
  { text: "New conversation started", time: "2 min ago", type: "chat" },
  { text: "Settings updated", time: "15 min ago", type: "settings" },
  { text: "Account registered", time: "1 hr ago", type: "auth" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "brand",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    indigo: "bg-indigo-50 text-indigo-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
    pink: "bg-pink-50 text-pink-600",
    teal: "bg-teal-50 text-teal-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-green-50 text-green-600",
  };

  const card = (
    <div className="card hover:shadow-elevated transition-shadow group cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] ?? colorMap.brand}`}>
          <Icon size={20} />
        </div>
        {href && (
          <ArrowUpRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

function ApiStatusBadge({ status }: { status: string }) {
  if (status === "ok") return (
    <span className="badge bg-green-100 text-green-700">
      <CheckCircle2 size={11} /> Connected
    </span>
  );
  if (status === "not_configured") return (
    <span className="badge bg-gray-100 text-gray-500">
      <CircleDashed size={11} /> Not configured
    </span>
  );
  return (
    <span className="badge bg-red-100 text-red-600">
      <AlertCircle size={11} /> Error
    </span>
  );
}

const integrationItems = [
  { name: "Google Gemini", key: "gemini", icon: "🧠" },
  { name: "OpenAI GPT", key: "openai", icon: "🤖" },
  { name: "Anthropic Claude", key: "anthropic", icon: "🔮" },
];

const placeholderCards = [
  {
    icon: Database,
    label: "Knowledge Sources",
    value: 0,
    sub: "No sources indexed yet",
    color: "indigo",
    href: "/integrations",
  },
  {
    icon: BookOpen,
    label: "Prompt Library",
    value: 0,
    sub: "Add reusable prompts",
    color: "purple",
  },
  {
    icon: Users,
    label: "Team Members",
    value: 1,
    sub: "Invite team coming soon",
    color: "teal",
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard/stats"),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">Here's an overview of your iHeal AI platform.</p>
        </div>

        {/* Primary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={MessageSquare}
            label="Conversations"
            value={isLoading ? "–" : (stats?.totalConversations ?? 0)}
            sub="Total sessions"
            href="/chat"
          />
          <StatCard
            icon={Activity}
            label="Messages"
            value={isLoading ? "–" : (stats?.totalMessages ?? 0)}
            sub="All time"
            color="indigo"
          />
          <StatCard
            icon={Zap}
            label="AI Requests"
            value={isLoading ? "–" : (stats?.aiUsageRequests ?? 0)}
            sub="API calls made"
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label="AI Usage"
            value="0 tokens"
            sub="Connect Gemini to track"
            color="sky"
            href="/settings"
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {placeholderCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* API Status + Activity */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* API Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Wifi size={17} className="text-brand-500" />
                API Status
              </h3>
              <Link href="/integrations">
                <span className="text-xs text-brand-600 hover:underline cursor-pointer">
                  Configure →
                </span>
              </Link>
            </div>
            <div className="space-y-3">
              {integrationItems.map(({ name, key, icon }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm font-medium text-gray-700">{name}</span>
                  </div>
                  <ApiStatusBadge status={stats?.apiStatus?.[key as keyof typeof stats.apiStatus] ?? "not_configured"} />
                </div>
              ))}
            </div>
          </div>

          {/* Activity log */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock size={17} className="text-brand-500" />
                Recent Activity
              </h3>
            </div>
            <div className="space-y-3">
              {SAMPLE_ACTIVITY.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-surface-border last:border-0">
                  <div className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.text}</p>
                    <p className="text-xs text-gray-400">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Intelligence Sources CTA */}
        <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg mb-1">Intelligence Sources</h3>
              <p className="text-brand-100 text-sm max-w-lg">
                iHeal AI will support data ingestion from Reddit, RSS feeds, forum APIs, CRM systems,
                and webhooks. Supported sources and platform integrations will be defined based on
                technical feasibility and legal compliance requirements.
              </p>
            </div>
            <Plug size={32} className="text-brand-300 shrink-0 ml-4" />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {["Reddit API", "RSS Feeds", "Forum APIs", "Webhooks", "CRM Systems", "Email"].map((tag) => (
              <span key={tag} className="badge bg-white/10 text-white border border-white/20">
                {tag}
              </span>
            ))}
          </div>
          <Link href="/integrations">
            <button className="mt-4 px-4 py-2 bg-white text-brand-700 rounded-lg text-sm font-semibold hover:bg-brand-50 transition-colors">
              View Integrations Hub →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
