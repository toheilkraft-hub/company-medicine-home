import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { sessionMiddleware } from "./config/session.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";
import promptRoutes from "./routes/prompts.js";
import inboxRoutes from "./routes/inbox.js";
import collectRoutes from "./routes/collect.js";
import { db } from "./config/db.js";
import { users, settings } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { startQueue } from "./services/queueService.js";
import { seedMockData } from "./services/seeder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(requestLogger);

// ─── Auto-guest session ───────────────────────────────────────────────────────
// Inject a guest session so the app works without login.
// Guest user is bootstrapped at startup; ID is cached in memory.
let guestUserId: number | null = null;

async function bootstrapGuestUser() {
  try {
    const GUEST_EMAIL = "guest@iheal.local";
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, GUEST_EMAIL))
      .limit(1);
    if (existing.length > 0) {
      guestUserId = existing[0].id;
      logger.info("Guest user found", { id: guestUserId });
    } else {
      const created = await db
        .insert(users)
        .values({ name: "Guest", email: GUEST_EMAIL, password: "guest-no-password", role: "user" })
        .returning({ id: users.id });
      guestUserId = created[0].id;
      await db
        .insert(settings)
        .values({ userId: guestUserId })
        .onConflictDoNothing();
      logger.info("Created guest user", { id: guestUserId });
    }
  } catch (err: any) {
    logger.warn("bootstrapGuestUser failed — guest session unavailable", {
      err: err?.message ?? String(err),
    });
  }
}

// Auto-inject guest session for requests that have no session yet
app.use((req, _res, next) => {
  if (!req.session?.userId && guestUserId !== null) {
    req.session.userId = guestUserId;
    req.session.role = "user";
  }
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api/collect", collectRoutes);

// ─── Health / info ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "iHeal AI",
    version: "1.0.0",
  });
});

// ─── Static SPA (production build) ───────────────────────────────────────────
const distPath = path.join(__dirname, "../dist/public");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) res.status(200).send("iHeal AI API running. Start Vite for the frontend.");
  });
});

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`iHeal AI server listening on port ${PORT}`);
  await bootstrapGuestUser();
  if (guestUserId !== null) {
    await seedMockData(guestUserId);
    startQueue(guestUserId);
  }
});

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export default app;
