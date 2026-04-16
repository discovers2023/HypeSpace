import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { doubleCsrf } from "csrf-csrf";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// --- Logging ---
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// --- CORS: restrict to known origins ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // required for session cookies
  }),
);

// --- Body parsing + cookie parsing ---
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- Session ---
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET env var is required in production");
}

// TODO: Replace MemoryStore with connect-pg-simple for production
// pnpm add connect-pg-simple @types/connect-pg-simple
app.use(
  session({
    secret: SESSION_SECRET ?? "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// --- CSRF (double-submit cookie, protects mutations) ---
// Using csrf-csrf v4 API: generateCsrfToken, getCsrfTokenFromRequest, getSessionIdentifier
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => SESSION_SECRET ?? "dev-secret-change-in-production",
  getSessionIdentifier: (req) => {
    // Use session ID as the per-user identifier for HMAC binding
    const sess = req.session as { id?: string } | undefined;
    return sess?.id ?? req.ip ?? "anonymous";
  },
  cookieName: "x-csrf-token",
  cookieOptions: {
    httpOnly: false, // Frontend JS must be able to read this cookie to send in header
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  },
  size: 64,
  getCsrfTokenFromRequest: (req) =>
    (req.headers["x-csrf-token"] as string) ?? req.body?._csrf,
});

// Expose generateCsrfToken on app.locals so auth routes can issue it
app.locals.generateCsrfToken = generateCsrfToken;

// Ensure CSRF cookie is set on every response (not just login/me)
// This way the browser always has the token before making mutations
app.use((req, res, next) => {
  if (!req.cookies?.["x-csrf-token"]) {
    try { generateCsrfToken(req, res); } catch { /* first request before session */ }
  }
  next();
});

// Apply CSRF protection to all state-changing methods
// Exclude: GET, HEAD, OPTIONS (safe methods), and auth/register/public endpoints
app.use((req, res, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  const csrfExempt = ["/api/auth/login", "/api/auth/register", "/api/public/"];
  if (
    safeMethods.includes(req.method) ||
    csrfExempt.some((path) => req.path.startsWith(path))
  ) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
});

app.use("/api", router);

// JSON 404 catch-all (prevents Express default HTML error pages)
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — returns JSON for all errors including CSRF failures
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message?.includes("csrf") || err.message?.includes("CSRF")) {
    res.status(403).json({ error: "CSRF token invalid or missing" });
    return;
  }
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;
