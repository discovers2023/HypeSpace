/**
 * Returns the canonical base URL for this deployment.
 *
 * Priority:
 *  1. APP_BASE_URL env var (set explicitly by operator)
 *  2. REPLIT_DOMAINS  (set by Replit for deployed/production apps)
 *  3. REPLIT_DEV_DOMAIN (set by Replit in every development workspace)
 *  4. localhost fallback for plain local development outside Replit
 */
export function getAppBaseUrl(): string {
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
