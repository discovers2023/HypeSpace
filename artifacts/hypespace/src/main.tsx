import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Patch global fetch to always send credentials (session cookies) and CSRF token
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
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
