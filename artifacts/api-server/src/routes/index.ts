import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { db, teamMembersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import teamRouter from "./team";
import eventsRouter from "./events";
import guestsRouter from "./guests";
import campaignsRouter from "./campaigns";
import socialRouter from "./social";
import dashboardRouter from "./dashboard";
import remindersRouter from "./reminders";
import integrationsRouter from "./integrations";
import sendingDomainsRouter from "./sending-domains";
import plansRouter from "./plans";
import emailProviderRouter from "./email-provider";
import adminRouter from "./admin";
import trackingRouter from "./tracking";

const router: IRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for AI generation." },
});

router.use("/auth", authLimiter);
router.use("/organizations/:orgId/campaigns/ai-generate", aiLimiter);
router.use("/organizations/:orgId/campaigns/ai-generate-image", aiLimiter);

// Auth guard: blocks all routes except auth, health, and public endpoints
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Apply requireAuth to everything EXCEPT open paths
// Open paths: /auth/* (login/register/logout/me), /healthz, /health, /public/*, /track/*
// Tracking endpoints are unauthenticated by design — email clients load them without sessions
const openPaths = ["/auth/", "/healthz", "/health", "/public/", "/track/", "/plans", "/admin/"];
router.use((req: Request, res: Response, next: NextFunction) => {
  if (openPaths.some((p) => req.path.startsWith(p))) return next();
  return requireAuth(req, res, next);
});

// Cross-org IDOR guard: every /organizations/:orgId/* request must come from a
// member of that org. requireAuth above guarantees session.userId is set by the
// time we reach here — we just need to verify membership.
async function requireOrgMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgIdRaw = req.params.orgId;
    const orgId = parseInt(Array.isArray(orgIdRaw) ? orgIdRaw[0] : orgIdRaw, 10);
    if (!Number.isFinite(orgId) || orgId <= 0) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }
    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [membership] = await db
      .select({ orgId: teamMembersTable.organizationId })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.userId, userId), eq(teamMembersTable.organizationId, orgId)))
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "FORBIDDEN", message: "You do not have access to this organization" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
router.use("/organizations/:orgId", requireOrgMembership);

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(teamRouter);
router.use(eventsRouter);
router.use(guestsRouter);
router.use(campaignsRouter);
router.use(socialRouter);
router.use(dashboardRouter);
router.use(remindersRouter);
router.use(integrationsRouter);
router.use(sendingDomainsRouter);
router.use(plansRouter);
router.use(emailProviderRouter);
router.use("/track", trackingRouter);
router.use(adminRouter);

export default router;
