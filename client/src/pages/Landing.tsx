import { Link } from "wouter";
import {
  Dna,
  MessageSquare,
  BarChart3,
  Plug,
  Shield,
  Zap,
  ChevronRight,
  Star,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "AI Chat Interface",
    desc: "ChatGPT-quality conversation experience with markdown rendering, code blocks, and conversation history.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Monitor AI usage, conversation metrics, team activity, and system health in one place.",
  },
  {
    icon: Plug,
    title: "Integrations Hub",
    desc: "Connect Gemini, OpenAI, Slack, Discord, Reddit, CRM systems, and enterprise workflows.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "Session-based auth, encrypted API keys, role-based access control, and audit logging.",
  },
  {
    icon: Zap,
    title: "Modular AI Layer",
    desc: "Plug in any LLM with a single API key. Designed for Google Gemini with multi-model support planned.",
  },
  {
    icon: Star,
    title: "Extensible Platform",
    desc: "Clean extension points for content discovery, response drafting, workflow automation, and analytics.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<600ms", label: "Avg response" },
  { value: "SOC2", label: "Ready architecture" },
  { value: "Multi-LLM", label: "Model support" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Dna className="text-white" size={18} />
            </div>
            <span className="font-bold text-gray-900 text-xl">iHeal AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 ml-4">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#platform" className="hover:text-gray-900 transition-colors">Platform</a>
            <a href="#architecture" className="hover:text-gray-900 transition-colors">Architecture</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/login">
              <span className="btn-ghost text-sm">Sign in</span>
            </Link>
            <Link href="/register">
              <span className="btn-primary text-sm">Get started free</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Investor-quality prototype · Gemini integration ready
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Enterprise AI platform<br />
          <span className="text-brand-600">built for healthcare</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          iHeal AI brings production-grade AI conversation, analytics, and integrations to your
          organisation — modular, extensible, and ready to connect with Google Gemini.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <span className="btn-primary text-base px-6 py-3 shadow-glow">
              Launch the platform <ArrowRight size={18} />
            </span>
          </Link>
          <Link href="/login">
            <span className="btn-secondary text-base px-6 py-3">
              Sign in to your account
            </span>
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-brand-600">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-white">{s.value}</p>
              <p className="text-brand-200 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            A complete AI operations platform — from chat interface to analytics to integrations.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card hover:shadow-elevated transition-shadow group">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                <Icon size={20} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="bg-gray-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Clean, modular architecture</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Built for extensibility from day one. Swap LLMs, add integrations, and scale without restructuring.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "AI Service Layer",
                items: ["generateResponse()", "summarizeText()", "analyzeContent()", "classifyIntent()", "→ Gemini plug-in point"],
                color: "brand",
              },
              {
                title: "Backend (Express)",
                items: ["Routes → Controllers", "Services → Utils", "Session auth", "PostgreSQL via Drizzle", "Typed API responses"],
                color: "indigo",
              },
              {
                title: "Frontend (React)",
                items: ["Wouter routing", "TanStack Query", "Tailwind CSS", "Dark mode ready", "Responsive layouts"],
                color: "purple",
              },
            ].map((col) => (
              <div key={col.title} className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="font-semibold text-white mb-3">{col.title}</h3>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                      <ChevronRight size={14} className="text-brand-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to explore the platform?</h2>
        <p className="text-gray-500 mb-8 max-w-lg mx-auto">
          Create a free account to access the full dashboard, chat interface, and integrations hub.
        </p>
        <Link href="/register">
          <span className="btn-primary text-base px-8 py-3 shadow-glow">
            Create free account <ArrowRight size={18} />
          </span>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
              <Dna size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">iHeal AI</span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} iHeal AI · Investor prototype · Google Gemini integration ready
          </p>
        </div>
      </footer>
    </div>
  );
}
