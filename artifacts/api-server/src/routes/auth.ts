import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable, teamMembersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, asc, gt, and, isNull } from "drizzle-orm";
import { GetMeResponse } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";

const router: IRouter = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
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

  // Query org memberships for this user (ordered by join date ascending)
  const memberships = await db
    .select({
      orgId: organizationsTable.id,
      orgName: organizationsTable.name,
      orgSlug: organizationsTable.slug,
      joinedAt: teamMembersTable.createdAt,
    })
    .from(teamMembersTable)
    .innerJoin(organizationsTable, eq(teamMembersTable.organizationId, organizationsTable.id))
    .where(eq(teamMembersTable.userId, userId))
    .orderBy(asc(teamMembersTable.createdAt));

  // A user with no org membership cannot operate — return 401
  if (memberships.length === 0) {
    res.status(401).json({ error: "No organization access" });
    return;
  }

  const orgs = memberships.map(m => ({ id: m.orgId, name: m.orgName, slug: m.orgSlug }));
  const activeOrgId = orgs[0].id;

  // Fetch onboarding status for the active org — spread outside GetMeResponse.parse()
  // to keep @workspace/api-zod untouched (same pattern as orgs/activeOrgId/csrfToken).
  const [activeOrg] = await db
    .select({ onboardingCompletedAt: organizationsTable.onboardingCompletedAt })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, activeOrgId));
  const onboardingCompletedAt = activeOrg?.onboardingCompletedAt?.toISOString() ?? null;

  res.json({
    ...GetMeResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    }),
    orgs,
    activeOrgId,
    onboardingCompletedAt,
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

  // Block unverified accounts (SEC-02)
  if (!user.emailVerified) {
    res.status(403).json({
      error: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email address before logging in. Check your inbox for the verification link.",
    });
    return;
  }

  // Set session
  req.session.userId = user.id;


  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
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

  // Generate verification token and send verification email (SEC-02)
  const verificationToken = crypto.randomBytes(32).toString("hex");
  await db.update(usersTable)
    .set({ emailVerificationToken: verificationToken })
    .where(eq(usersTable.id, newUser.id));

  // Best-effort: don't fail registration if email delivery fails
  try {
    await sendVerificationEmail(newUser.email, newUser.name, verificationToken);
  } catch (err) {
    req.log.error({ err }, "Failed to send verification email — user registered but unverified");
  }

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    avatarUrl: newUser.avatarUrl ?? null,
    createdAt: newUser.createdAt.toISOString(),
    emailVerified: false,
    message: "Registration successful. Please check your email to verify your account.",
  });
});

// GET /auth/verify/:token — verifies email and redirects to login
router.get("/auth/verify/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Invalid verification token" });
    return;
  }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.emailVerificationToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, user.id));

  // Redirect to login page with success indicator
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  res.redirect(`${baseUrl}/login?verified=true`);
});

// POST /auth/resend-verification — resend verification email (rate-limited by authLimiter in index.ts)
router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "INVALID_INPUT" });
    return;
  }

  // Always return same response regardless of whether user exists — prevents email enumeration (T-03-03)
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (user && !user.emailVerified) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.update(usersTable)
      .set({ emailVerificationToken: token })
      .where(eq(usersTable.id, user.id));
    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (err) {
      req.log.error({ err }, "Failed to resend verification email");
    }
  }

  res.json({ message: "If that email is registered and unverified, a new verification link has been sent." });
});

// PATCH /auth/profile — update current user's name and avatar
router.patch("/auth/profile", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, avatarUrl } = req.body ?? {};
  const updates: Record<string, string> = {};
  if (typeof name === "string" && name.trim().length >= 2) updates.name = name.trim();
  if (typeof avatarUrl === "string") updates.avatarUrl = avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  });
});

// POST /auth/change-password — change current user's password
router.post("/auth/change-password", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Current password required and new password must be at least 8 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));

  res.json({ message: "Password updated successfully" });
});

// POST /auth/forgot-password — always returns the same response to prevent email enumeration
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  const generic = { message: "If an account exists with that email, a reset link has been sent." };

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    // Same response shape — DO NOT leak validation outcome to the client
    res.json(generic);
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (user) {
    // Generate token, store hash, send email — best-effort. Failures are logged, not surfaced.
    const token = crypto.randomBytes(32).toString("base64url"); // URL-safe
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    try {
      await db.insert(passwordResetTokensTable).values({ userId: user.id, tokenHash, expiresAt });
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (err) {
      req.log.error({ err }, "Failed to issue password reset token");
    }
  }

  res.json(generic);
});

// POST /auth/reset-password — validates token, sets new password, marks token used
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body ?? {};
  if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "INVALID_INPUT", message: "Invalid or expired reset link." });
    return;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        gt(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(400).json({ error: "INVALID_TOKEN", message: "This reset link is invalid or has expired." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password and mark token used in sequence.
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, row.userId));
  await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, row.id));

  res.json({ message: "Password updated successfully. You can now log in." });
});

export default router;
