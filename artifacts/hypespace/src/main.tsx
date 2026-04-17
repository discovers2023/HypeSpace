import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// ─── API base URL ─────────────────────────────────────────────────────────
// VITE_API_BASE_URL is baked into the bundle at build time. It's empty for
// same-origin browser deployments (relative /api paths flow through the Vite
// dev proxy or the production reverse proxy). For Capacitor/native builds —
// where the web view runs at capacitor://localhost and there is no proxy —
// set it to the hosted API origin before running `pnpm build`.
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
if (apiBase !== "") {
  setBaseUrl(apiBase);
}

const apiBaseNormalized = apiBase.replace(/\/+$/, "");

// ─── Global fetch patch ───────────────────────────────────────────────────
// Always send credentials (session cookies) and attach the CSRF token on
// mutation requests. Also prepend VITE_API_BASE_URL to relative /api/... paths
// as a belt-and-suspenders guard for code paths that call `fetch` directly
// instead of going through `customFetch` (which already handles the prefix).
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  // Prepend the API base to relative paths so raw fetch calls work in native
  // shells where there is no same-origin proxy.
  if (apiBaseNormalized !== "") {
    if (typeof input === "string" && input.startsWith("/")) {
      input = apiBaseNormalized + input;
    } else if (input instanceof Request && input.url.startsWith("/")) {
      input = new Request(apiBaseNormalized + input.url, input);
    }
  }

  const opts: RequestInit = { ...init, credentials: init?.credentials ?? "include" };

  // Attach CSRF token on mutation requests
  const method = (opts.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const headers = new Headers(opts.headers);
    if (!headers.has("x-csrf-token")) {
      const csrfCookie = document.cookie.split("; ").find((c) => c.startsWith("x-csrf-token="));
      if (csrfCookie) {
        headers.set("x-csrf-token", decodeURIComponent(csrfCookie.split("=")[1]));
      }
    }
    opts.headers = headers;
  }

  return originalFetch(input, opts);
};

createRoot(document.getElementById("root")!).render(<App />);
