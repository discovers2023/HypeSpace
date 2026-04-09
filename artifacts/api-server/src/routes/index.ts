import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

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

export default router;
