import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn("AppError", { message: err.message, code: err.code, path: req.path });
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      code: err.code,
    });
  }

  // Unexpected errors
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message,
  });
}
