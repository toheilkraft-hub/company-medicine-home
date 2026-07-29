import { ExternalLink, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

type Status = "coming_soon" | "not_connected" | "connected" | "beta";

interface Integration {
  name: string;
  description: string;
  icon: string;
  category: string;
  status: Status;
  docsUrl?: string;
}

const integrations: Integration[] = [
  // AI Models
  { name: "Google Gemini", description: "Plug in your Gemini API key for intelligent responses, summarization, and intent detection.", icon: "🧠", category: "AI Models", status: "not_connected", docsUrl: "https://ai.google.dev/" },
  { name: "OpenAI GPT-4", description: "Connect OpenAI for alternative AI responses and embeddings.", icon: "🤖", category: "AI Models", status: "coming_soon" },
  { name: "Anthropic Claude", description: "High-safety conversational AI for sensitive healthcare contexts.", icon: "🔮", category: "AI Models", status: "coming_soon" },
  // Communication
  { name: "Email (SMTP)", description: "Send AI-assisted email responses and notifications.", icon: "📧", category: "Communication", status: "coming_soon" },
  { name: "Slack", description: "Deploy iHeal AI as a Slack bot for your team workspace.", icon: "💬", category: "Communication", status: "coming_soon" },
  { name: "Discord", description: "Engage communities via Discord with AI-moderated responses.", icon: "🎮", category: "Communication", status: "coming_soon" },
  { name: "Microsoft Teams", description: "Integrate with Teams for enterprise communication workflows.", icon: "💼", category: "Communication", status: "coming_soon" },
  // Social & Data Sources
  { name: "Reddit API", description: "Monitor subreddits, collect posts, and draft AI responses to relevant conversations.", icon: "🔴", category: "Intelligence Sources", status: "coming_soon" },
  { name: "RSS Feeds", description: "Ingest articles and blog posts from RSS/Atom feeds for content analysis.", icon: "📡", category: "Intelligence Sources", status: "coming_soon" },
  { name: "Forum Webhooks", description: "Receive webhook events from phpBB, Discourse, and custom forums.", icon: "🌐", category: "Intelligence Sources", status: "coming_soon" },
  // CRM
  { name: "Salesforce", description: "Sync AI conversation insights with Salesforce CRM records.", icon: "☁️", category: "CRM & Business", status: "coming_soon" },
  { name: "HubSpot", description: "Log AI interactions directly to HubSpot contacts and deals.", icon: "🧡", category: "CRM & Business", status: "coming_soon" },
  { name: "Webhooks (Custom)", description: "Send AI events to any URL. Build custom integrations with zero friction.", icon: "⚡", category: "Developer", status: "coming_soon" },
  { name: "REST API", description: "Embed iHeal AI's chat and AI service layer in your own applications.", icon: "🔌", category: "Developer", status: "beta" },
];

const categories = [...new Set(integrations.map((i) => i.category))];

function StatusBadge({ status }: { status: Status }) {
  if (status === "connected")
    return <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> Connected</span>;
  if (status === "not_connected")
    return <span className="badge bg-amber-100 text-amber-700"><AlertTriangle size={11} /> Not connected</span>;
  if (status === "beta")
    return <span className="badge bg-blue-100 text-blue-700"><CheckCircle2 size={11} /> Beta</span>;
  return <span className="badge bg-gray-100 text-gray-500"><Clock size={11} /> Coming soon</span>;
}

export default function Integrations() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
          <p className="text-gray-500 text-sm mt-1">
            Connect iHeal AI to your existing tools, data sources, and AI models.
            <span className="ml-1 text-amber-600 font-medium">Most integrations are coming soon</span> — they will be
            prioritised based on business and legal requirements.
          </p>
        </div>

        {/* Gemini CTA */}
        <div className="card border-brand-200 bg-brand-50 mb-8 flex items-start gap-4">
          <div className="text-3xl">🧠</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Start with Google Gemini</h3>
            <p className="text-sm text-gray-600 mb-3">
              Add your Gemini API key to enable real AI responses across the entire platform.
              iHeal AI's AI service layer is pre-wired for the Gemini SDK — just add your key.
            </p>
            <a href="/settings" className="btn-primary text-sm">
              Configure in Settings →
            </a>
          </div>
          <StatusBadge status="not_connected" />
        </div>

        {/* Categories */}
        {categories.map((category) => (
          <div key={category} className="mb-8">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              {category}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations
                .filter((i) => i.category === category)
                .map((integration) => (
                  <div
                    key={integration.name}
                    className="card hover:shadow-elevated transition-shadow flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{integration.icon}</span>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{integration.name}</h4>
                          <StatusBadge status={integration.status} />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1">{integration.description}</p>
                    {integration.docsUrl && (
                      <a
                        href={integration.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        View documentation <ExternalLink size={11} />
                      </a>
                    )}
                    {integration.status === "coming_soon" && (
                      <button disabled className="mt-3 btn-secondary text-xs opacity-60 cursor-not-allowed justify-center">
                        Coming soon
                      </button>
                    )}
                    {integration.status === "not_connected" && (
                      <a href="/settings" className="mt-3 btn-primary text-xs justify-center">
                        Connect
                      </a>
                    )}
                    {integration.status === "beta" && (
                      <a href="/settings" className="mt-3 btn-secondary text-xs justify-center">
                        View API docs
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* Intelligence Sources section */}
        <div className="bg-gray-900 rounded-xl p-6 text-white mt-4">
          <h3 className="font-bold text-lg mb-2">Intelligence Sources</h3>
          <p className="text-gray-400 text-sm mb-4">
            Future versions of iHeal AI will support automated data ingestion from social platforms,
            medical journals, and community forums. All integrations will be implemented after
            business requirements, API terms of service, and legal compliance requirements are reviewed.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { title: "Content Discovery", desc: "Reddit, RSS, and forum monitoring — coming after legal review." },
              { title: "AI-Assisted Drafting", desc: "Auto-generate suggested replies with human oversight." },
              { title: "Workflow Automation", desc: "Trigger actions based on AI classification of incoming messages." },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
