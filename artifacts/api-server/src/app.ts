import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session, { type Store } from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
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
// Capacitor native origins — required for the iOS/Android shells to call the API.
// Per Capacitor docs, iOS uses capacitor://localhost by default; Android uses
// http://localhost unless server.androidScheme is set to "https" (our config
// sets it to "https"). All three are listed to cover every shell variant.
const CAPACITOR_NATIVE_ORIGINS = [
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];

const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

// In development, be permissive: include the Vite dev server + Capacitor
// native origins by default. In production the frontend is co-hosted on the
// same origin as the API, so same-origin requests need no CORS headers.
// ALLOWED_ORIGINS can still be set to allow native mobile shells or other
// external callers in production.
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? configuredOrigins
    : [
        ...configuredOrigins,
        "http://localhost:5173",
        ...CAPACITOR_NATIVE_ORIGINS,
      ];

// When allowedOrigins is empty (production with co-hosted frontend), disable
// CORS middleware entirely — same-origin requests don't need it, and we don't
// want to block legitimate same-origin browser traffic.
if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true, // required for session cookies
    }),
  );
}

// --- Body parsing + cookie parsing ---
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- Session ---
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET env var is required in production");
}

// Postgres-backed session store — persists across restarts and scales
// across instances. Dev without DATABASE_URL falls back to the default
// MemoryStore; production without DATABASE_URL fails fast on boot.
const DATABASE_URL = process.env.DATABASE_URL;
let sessionStore: Store | undefined;
if (DATABASE_URL) {
  const PgStore = connectPgSimple(session);
  sessionStore = new PgStore({
    conString: DATABASE_URL,
    createTableIfMissing: true,
    ttl: 7 * 24 * 60 * 60, // seconds — matches cookie.maxAge
  });
} else if (process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL env var is required in production (session store)");
} else {
  logger.warn({ store: "memory" }, "Session store: DATABASE_URL unset — using MemoryStore (dev only)");
}

app.use(
  session({
    store: sessionStore,
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

// --- CSRF Protection ---
// SameSite=Strict on the session cookie prevents cross-origin request forgery.
// The session cookie is never sent on cross-origin requests, so an attacker's
// site cannot forge authenticated mutations. This is sufficient for cookie-based
// session auth without a separate CSRF token mechanism.

// --- Static serving for AI-generated campaign images ---
// Mounted BEFORE /api so email clients (no session cookie) can load hero images
// directly from emails. UUID filenames prevent enumeration; fallthrough:false
// ensures only files inside publicImagesDir are served.
const publicImagesDir = path.resolve(process.cwd(), "public", "campaign-images");
mkdirSync(publicImagesDir, { recursive: true });
app.use(
  "/campaign-images",
  express.static(publicImagesDir, {
    maxAge: "7d",
    fallthrough: false,
  }),
);

app.use("/api", router);

// --- Serve React frontend in production ---
// The frontend is built to artifacts/hypespace/dist/public and co-hosted on
// the same Express server so we only need one port in production.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "artifacts/hypespace/dist/public");
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { maxAge: "1d" }));
    // SPA fallback: all non-API routes serve index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    logger.warn({ frontendDist }, "Frontend build not found — static serving skipped");
    // JSON 404 for non-API routes when frontend isn't built
    app.use((_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  }
} else {
  // JSON 404 catch-all (prevents Express default HTML error pages)
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}

// Global error handler — returns JSON for all errors including CSRF failures
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message?.includes("csrf") || err.message?.includes("CSRF")) {
    res.status(403).json({ error: "CSRF token invalid or missing" });
    return;
  }
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;
