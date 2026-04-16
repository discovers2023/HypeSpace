import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
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

// Auth guard: blocks all routes except auth, health, and public endpoints
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Apply requireAuth to everything EXCEPT open paths
// Open paths: /auth/* (login/register/logout/me), /healthz, /health, /public/*
const openPaths = ["/auth/", "/healthz", "/health", "/public/"];
router.use((req: Request, res: Response, next: NextFunction) => {
  if (openPaths.some((p) => req.path.startsWith(p))) return next();
  return requireAuth(req, res, next);
});

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

export default router;
