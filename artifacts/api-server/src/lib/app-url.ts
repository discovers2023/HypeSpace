import type { Request } from "express";

/**
 * Returns the canonical base URL for this deployment.
 *
 * When an Express request is provided the browser's Origin (or Referer) header
 * is used first — this guarantees the generated link always resolves back to
 * the same host the user is already on (localhost in dev, Replit proxy in
 * Replit, custom domain in production).
 *
 * Static fallback priority (when no request is available):
 *  1. APP_BASE_URL env var (set explicitly by operator)
 *  2. REPLIT_DOMAINS  (set by Replit for deployed/production apps)
 *  3. REPLIT_DEV_DOMAIN (set by Replit in every development workspace)
 *  4. localhost:5173 — plain local development outside Replit
 */
export function getAppBaseUrl(req?: Request): string {
  // Derive from the incoming request's Origin / Referer so the generated link
  // always points back to wherever the browser actually is.
  if (req) {
    const origin = req.headers["origin"] as string | undefined;
    if (origin) return origin.replace(/\/$/, "");

    const referer = req.headers["referer"] as string | undefined;
    if (referer) {
      try {
        const url = new URL(referer);
        return url.origin;
      } catch {
        // ignore malformed referer
      }
    }
  }

  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0].trim();
    return `https://${first}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:5173";
}
