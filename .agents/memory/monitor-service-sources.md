---
name: Monitor Service Data Sources
description: Which data sources work for the Research Monitor and why Reddit/DDG were replaced.
---

# Monitor Service Data Sources

## What works
- **Google News RSS** (`https://news.google.com/rss/search?q=<topic>`) — search-engine backed, always on-topic, no auth, free. Used as the primary `web` source.
- **Reddit direct JSON API** — try first; falls back to HN Algolia on 403/429. Replit's outbound IPs are frequently blocked/rate-limited by Reddit.
- **HN Algolia** (`https://hn.algolia.com/api/v1/search`) — used as the Reddit fallback. Good for tech/discussion topics.

## What does NOT work from Replit servers
- **Reddit JSON API** — returns 403 from Replit IPs.
- **Reddit RSS** — returns 429 from Replit IPs.
- **DuckDuckGo HTML scraper** — returns 202 with empty body (bot-blocked).
- **The Guardian `test` API key** — does not honour exact-phrase `"query"` search; returns loosely-matched off-topic articles.

## Critical: clearSeedData removed
`clearSeedData()` was deleting ALL `collected_items` on every server restart. It was removed from `server/index.ts`. Do NOT add it back — it destroys user inbox data.

**Why:** It was originally a one-time migration step to remove mock seed data. Once removed, user-collected items persist across restarts as expected.
