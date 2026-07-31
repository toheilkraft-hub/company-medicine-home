import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Prevent unhandled 'error' events from crashing the process when the
// database server terminates an idle connection (e.g. error code 57P01).
pool.on("error", (err) => {
  console.error("[db] pool client error (connection dropped):", err.message);
});

export const db = drizzle(pool, { schema });
