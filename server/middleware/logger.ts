/**
 * Structured logger for iHeal AI.
 * Outputs JSON in production, coloured human-readable in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

const isDev = process.env.NODE_ENV !== "production";
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? (isDev ? "debug" : "info");

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[minLevel]) return;

  const ts = new Date().toISOString();

  if (isDev) {
    const color = COLORS[level];
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    console.log(`${color}[${level.toUpperCase()}]${RESET} ${ts} ${message}${metaStr}`);
  } else {
    console.log(JSON.stringify({ level, ts, message, ...meta }));
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};

// ── Express request logger middleware ─────────────────────────────────────────
import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const level: LogLevel = res.statusCode >= 500 ? "error"
      : res.statusCode >= 400 ? "warn"
      : "info";
    log(level, `${req.method} ${req.path}`, {
      status: res.statusCode,
      ms,
      ip: req.ip,
      userId: req.session?.userId,
    });
  });
  next();
}
