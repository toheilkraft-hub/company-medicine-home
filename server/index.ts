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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(requestLogger);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/prompts", promptRoutes);

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
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`iHeal AI server listening on port ${PORT}`);
});

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export default app;
