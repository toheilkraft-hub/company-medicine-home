---
name: DB driver fix
description: Drizzle neon-http driver fails silently on Replit's standard PostgreSQL; the correct driver is node-postgres.
---

# Drizzle ORM driver on Replit PostgreSQL

## Rule
Always use `drizzle-orm/node-postgres` with a `pg.Pool` when the project is backed by Replit's built-in PostgreSQL. Do not use `drizzle-orm/neon-http` or `@neondatabase/serverless` for runtime queries.

**Why:** Replit's built-in PostgreSQL uses a standard `postgresql://` connection string. The `neon()` tagged-template function from `@neondatabase/serverless` uses an HTTP/WebSocket transport designed for Neon's serverless offering. Against a standard Postgres host it fails with "Cannot read properties of null (reading 'map')" — the result rows come back as null instead of an array. `drizzle-kit push` works regardless (it auto-detects and uses the `pg` driver), so a passing `db:push` does not confirm the runtime driver is correct.

**How to apply:** In `server/config/db.ts`, use:
```ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```
The `pg` package is always pre-installed on Replit Node.js repls.
