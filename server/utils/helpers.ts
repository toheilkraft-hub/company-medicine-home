import { Request, Response, NextFunction } from "express";

// ─── Auth guard ───────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId || req.session?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ─── Response helpers ─────────────────────────────────────────────────────────
export function ok(res: Response, data: unknown) {
  return res.json({ ok: true, data });
}

export function fail(res: Response, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: message });
}

// ─── Async wrapper ────────────────────────────────────────────────────────────
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
