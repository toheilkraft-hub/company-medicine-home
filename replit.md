# iHeal AI

**Enterprise-grade AI assistant platform** — investor-quality prototype with Google Gemini integration ready.

## What It Does

iHeal AI is a full-stack web application providing:
- **AI Chat Interface** — ChatGPT-quality UX with conversation history, markdown rendering, code blocks, copy buttons, typing indicators
- **Dashboard** — analytics overview, API status, knowledge sources, activity log
- **Integrations Hub** — UI for Gemini, OpenAI, Slack, Discord, Reddit, RSS, CRM, webhooks (most "Coming Soon")
- **Settings** — AI configuration (Gemini API key, model, temperature, max tokens), appearance, notifications, security
- **Profile** — user management, avatar, bio, password change
- **Authentication** — register, login, session management (frontend + backend)

## Architecture

```
/
├── client/src/         # React 18 frontend
│   ├── pages/          # Landing, Login, Register, Chat, Dashboard, Settings, Profile, Integrations
│   ├── components/     # layout/ (AppShell, Sidebar, TopBar)
│   ├── contexts/       # AuthContext
│   └── lib/            # queryClient (apiFetch), utils
├── server/             # Express.js backend
│   ├── controllers/    # authController, chatController, settingsController, dashboardController
│   ├── routes/         # auth, chat, settings, dashboard
│   ├── services/       # aiService.ts ← Gemini plug-in point
│   ├── utils/          # helpers (requireAuth, asyncHandler, ok/fail)
│   └── config/         # db.ts (Drizzle + Neon), session.ts
└── shared/schema.ts    # Drizzle ORM schema (users, conversations, messages, settings)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Wouter, TanStack Query |
| Backend | Express.js, TypeScript, tsx |
| Database | PostgreSQL (Replit built-in), Drizzle ORM, @neondatabase/serverless |
| Auth | express-session + connect-pg-simple, bcryptjs |
| AI | Placeholder service layer, ready for Google Gemini SDK |

## How to Run

```bash
npm run dev   # starts the Express server on port 5000
npm run build # builds the React SPA to dist/public/
```

The server serves both the API (`/api/*`) and the built React app on port 5000.

During development, Vite proxies `/api` → `http://localhost:5000`.

## Connecting Google Gemini

The AI service is at `server/services/aiService.ts`. Every function has a `TODO: GEMINI` comment with the exact SDK calls to add:

1. `npm install @google/generative-ai`
2. Replace placeholders in `generateResponse()`, `summarizeText()`, `analyzeContent()`, `classifyIntent()`
3. Enter API key in **Settings → AI Configuration** in the app

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `SESSION_SECRET` | Secret for signing session cookies (set in Replit Secrets) |
| `PORT` | Server port (defaults to 5000) |

## User Preferences

- Keep the modular architecture — routes → controllers → services → utils
- AI service layer (`server/services/aiService.ts`) is the single point for all LLM calls
- Use `apiFetch` from `client/src/lib/queryClient.ts` for all API calls
- Brand color: `brand-600` (#1d7762 — medical green)
