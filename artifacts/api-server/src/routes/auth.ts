import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetMeResponse } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import type { CsrfTokenGenerator } from "csrf-csrf";

const router: IRouter = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Issue a fresh CSRF token on each /me call (lets frontend refresh token after page reload)
  const generateCsrfToken = req.app.locals.generateCsrfToken as CsrfTokenGenerator | undefined;
  const csrfToken = generateCsrfToken ? generateCsrfToken(req, res) : undefined;
  res.json({
    ...GetMeResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    }),
    ...(csrfToken !== undefined ? { csrfToken } : {}),
  });
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password || !isValidEmail(email)) {
    res.status(400).json({ error: "INVALID_INPUT" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  // Set session
  req.session.userId = user.id;

  // Issue CSRF token for subsequent mutations
  const generateCsrfToken = req.app.locals.generateCsrfToken as CsrfTokenGenerator | undefined;
  const csrfToken = generateCsrfToken ? generateCsrfToken(req, res) : undefined;

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    ...(csrfToken !== undefined ? { csrfToken } : {}),
  });
});

// POST /auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name, company } = req.body ?? {};
  if (!email || !password || !name || !company || !isValidEmail(email) || password.length < 8) {
    res.status(400).json({ error: "INVALID_INPUT" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (existing) {
    res.status(409).json({ error: "EMAIL_TAKEN" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [newUser] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    name,
    passwordHash,
  }).returning();

  // Generate a unique slug from the company name
  const baseSlug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${newUser.id}`;

  const [org] = await db.insert(organizationsTable).values({
    name: company,
    slug,
    plan: "free",
    ownerId: newUser.id,
  }).returning();

  await db.insert(teamMembersTable).values({
    organizationId: org.id,
    userId: newUser.id,
    role: "owner",
  });

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    avatarUrl: newUser.avatarUrl ?? null,
    createdAt: newUser.createdAt.toISOString(),
  });
});

export default router;
