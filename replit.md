# iHeal AI — Intelligence Platform

**Enterprise-grade AI intelligence platform** — evolving from a chatbot into a full data ingestion, AI processing, and inbox management system.

## What It Does

iHeal AI is a full-stack web application providing:
- **Intelligence Inbox** — email-client style inbox for collected items from external sources, with AI analysis (summary, intent, industry, category, sentiment, priority score, confidence score, suggested reply)
- **AI Processing Queue** — automatically processes new items through the AI service layer every 6 seconds
- **Collection Service** — standard REST endpoint (`POST /api/collect`) that accepts data from any future integration
- **AI Chat Interface** — ChatGPT-quality UX with conversation history, markdown rendering, streaming responses
- **Collectors Page** — shows all future integration sources (Reddit, RSS, Email, Webhooks, CRM, etc.) — all "Not Connected"
- **Settings** — AI provider configuration (Gemini API key, model, temperature, max tokens)
- **Profile & Auth** — register, login, session management

## Architecture

```
/
├── client/src/
│   ├── pages/           # Inbox, Chat, Collectors, Settings, Profile, Login, Register
│   ├── components/      # layout/ (AppShell, Sidebar [platform nav], TopBar)
│   ├── contexts/        # AuthContext
│   └── lib/             # queryClient (apiFetch), utils
├── server/
│   ├── controllers/     # inboxController, collectController, chatController, authController…
│   ├── routes/          # inbox, collect, chat, auth, settings, dashboard, prompts
│   ├── services/
│   │   ├── aiService.ts      ← Gemini plug-in point (existing chat AI)
│   │   ├── intelService.ts   ← AI analysis for collected items (→ analyzeContent)
│   │   ├── queueService.ts   ← processing queue (polls every 6s for status=new)
│   │   └── seeder.ts         ← seeds 15 mock intelligence items on first run
│   ├── providers/       # IProvider, MockProvider, GeminiProvider, OpenAIProvider
│   ├── utils/           # helpers (requireAuth, asyncHandler, ok/fail)
│   └── config/          # db.ts (Drizzle + node-postgres), session.ts
└── shared/
    ├── schema.ts        # users, conversations, messages, settings, collected_items, item_analysis
    └── types.ts         # AIMessage, CollectedItemRow, ItemAnalysisResult, ItemStatus…
```

## How to Run

```bash
npm run dev      # starts Express (port 3001) + Vite dev server (port 5173)
npm run build    # builds the React SPA to dist/public/
npm run db:push  # push schema changes to database (dev only)
```

## Database Migrations

Schema changes are committed as Drizzle migration files in `drizzle/`. The server applies pending migrations automatically on startup via `drizzle-orm/node-postgres/migrator`.

To generate a new migration after schema changes:
```bash
npx drizzle-kit generate   # creates a new SQL file in drizzle/
# server will apply it on next startup
```

To apply manually without restarting:
```bash
npx drizzle-kit push --force  # dev only — bypasses migration tracking
```

## Intelligence Pipeline Flow

1. External source (or manual) POSTs to `POST /api/collect` with `{ title, content, source, url, author, tags }`
2. Item saved to `collected_items` with `status = "new"`
3. `queueService` polls every 6s, picks up batches of 3 "new" items
4. Each item is sent through `intelService.analyzeCollectedItem()` → `provider.analyzeContent()`
5. Analysis saved to `item_analysis` table
6. Item status updated to `"reviewed"`
7. Inbox page auto-refreshes every 7s to show updated items

## Connecting Google Gemini

The AI service is at `server/services/intelService.ts` and `server/services/aiService.ts`.

For intelligence analysis:
1. `npm install @google/generative-ai`
2. Uncomment the TODO: GEMINI block in `server/providers/GeminiProvider.ts → analyzeContent()`
3. Enter API key in **Settings → AI Configuration**

## Adding a New Collector

Future collectors simply POST to `/api/collect`:
```json
{ "title": "...", "content": "...", "source": "reddit", "url": "...", "author": "...", "tags": [] }
```
No changes to the AI processing engine required.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `SESSION_SECRET` | Secret for signing session cookies (set in Replit Secrets) |
| `PORT` | Server port (defaults to 3001) |

## User Preferences

- Keep the modular architecture — routes → controllers → services → utils
- AI service layer is the single point for all LLM calls (`aiService.ts` for chat, `intelService.ts` for item analysis)
- `IProvider.analyzeContent()` is the hook for plugging in real LLM analysis
- Use `apiFetch` from `client/src/lib/queryClient.ts` for all API calls
- Brand color: `brand-600` (#1d7762 — medical green)
- Database driver: `drizzle-orm/node-postgres` with `pg.Pool` (NOT neon-http — Replit uses standard PostgreSQL)
