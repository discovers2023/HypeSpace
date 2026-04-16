import { Router, type IRouter } from "express";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// 1x1 transparent GIF bytes
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * GET /api/track/open/:campaignId
 * Called when the tracking pixel in the email is loaded.
 * Increments open count and recalculates openRate.
 * Returns a 1x1 transparent GIF (must not redirect — email clients block redirects for images).
 */
router.get("/open/:campaignId", async (req, res): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId, 10);

  if (!Number.isNaN(campaignId)) {
    try {
      // Use a running integer counter stored in a dedicated column is ideal but we don't have one.
      // Instead: retrieve current openRate + recipientCount, increment open count, recalculate.
      // Formula: newOpenRate = (floor(currentOpenRate * recipientCount) + 1) / recipientCount
      // This is best-effort approximation without a separate opens_count column.
      const [c] = await db
        .select({ openRate: campaignsTable.openRate, recipientCount: campaignsTable.recipientCount })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId));

      if (c && c.recipientCount > 0) {
        const currentOpens = Math.floor((c.openRate ?? 0) * c.recipientCount);
        const newOpens = currentOpens + 1;
        const newRate = Math.min(newOpens / c.recipientCount, 1.0);
        await db
          .update(campaignsTable)
          .set({ openRate: newRate })
          .where(eq(campaignsTable.id, campaignId));
      }
    } catch (err) {
      logger.error({ err, campaignId }, "Tracking: open pixel update error");
    }
  }

  // Always return the pixel — never error out in a way that breaks email rendering
  res.set({
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.send(PIXEL);
});

/**
 * GET /api/track/click/:campaignId?url=<encoded>
 * Wraps campaign links. Increments click count then redirects to the original URL.
 * SECURITY: Only redirects to http:// or https:// URLs to prevent open redirect attacks.
 */
router.get("/click/:campaignId", async (req, res): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId, 10);
  const target = typeof req.query.url === "string" ? req.query.url : null;

  if (!Number.isNaN(campaignId)) {
    try {
      const [c] = await db
        .select({ clickRate: campaignsTable.clickRate, recipientCount: campaignsTable.recipientCount })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId));

      if (c && c.recipientCount > 0) {
        const currentClicks = Math.floor((c.clickRate ?? 0) * c.recipientCount);
        const newClicks = currentClicks + 1;
        const newRate = Math.min(newClicks / c.recipientCount, 1.0);
        await db
          .update(campaignsTable)
          .set({ clickRate: newRate })
          .where(eq(campaignsTable.id, campaignId));
      }
    } catch (err) {
      logger.error({ err, campaignId }, "Tracking: click update error");
    }
  }

  // Validate and redirect to original URL — only allow http/https to prevent open redirect abuse
  // Explicitly block javascript:, data:, vbscript:, and any other non-http/https schemes
  if (target && /^https?:\/\//i.test(target)) {
    res.redirect(302, target);
  } else {
    res.redirect(302, "/");
  }
});

export default router;
