import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { users, settings } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { ok, fail, asyncHandler } from "../utils/helpers.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return fail(res, "Name, email, and password are required");
  }
  if (password.length < 8) {
    return fail(res, "Password must be at least 8 characters");
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return fail(res, "An account with this email already exists");
  }

  const hashed = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ name, email, password: hashed })
    .returning();

  // Create default settings for new user
  await db.insert(settings).values({ userId: user.id });

  req.session.userId = user.id;
  req.session.role = user.role;

  return ok(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return fail(res, "Email and password are required");
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    return fail(res, "Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return fail(res, "Invalid credentials", 401);
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  return ok(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.clearCookie("connect.sid");
  return ok(res, { message: "Logged out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.session.userId!),
    columns: { password: false },
  });
  if (!user) return fail(res, "User not found", 404);
  return ok(res, user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, bio, avatar } = req.body;
  const [updated] = await db
    .update(users)
    .set({ name, bio, avatar, updatedAt: new Date() })
    .where(eq(users.id, req.session.userId!))
    .returning({ id: users.id, name: users.name, bio: users.bio, avatar: users.avatar, email: users.email, role: users.role });
  return ok(res, updated);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return fail(res, "Current and new password are required");
  }
  if (newPassword.length < 8) {
    return fail(res, "New password must be at least 8 characters");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, req.session.userId!) });
  if (!user) return fail(res, "User not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return fail(res, "Current password is incorrect", 401);

  const hashed = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, user.id));

  return ok(res, { message: "Password updated" });
});
