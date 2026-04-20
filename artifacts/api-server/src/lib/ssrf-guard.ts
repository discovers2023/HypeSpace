import { promises as dns } from "node:dns";
import net from "node:net";

export class UnsafeUrlError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Unsafe URL: ${reason}`);
    this.reason = reason;
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIPv4(ip: string): string | null {
  const n = ipv4ToInt(ip);
  if (n < 0) return "malformed-ipv4";
  // 0.0.0.0/8
  if ((n & 0xff000000) === 0x00000000) return "unspecified";
  // 10.0.0.0/8
  if ((n & 0xff000000) === 0x0a000000) return "private (10.0.0.0/8)";
  // 127.0.0.0/8
  if ((n & 0xff000000) === 0x7f000000) return "loopback (127.0.0.0/8)";
  // 169.254.0.0/16  (includes cloud metadata 169.254.169.254)
  if ((n & 0xffff0000) === 0xa9fe0000) return "link-local (169.254.0.0/16)";
  // 172.16.0.0/12
  if ((n & 0xfff00000) === 0xac100000) return "private (172.16.0.0/12)";
  // 192.168.0.0/16
  if ((n & 0xffff0000) === 0xc0a80000) return "private (192.168.0.0/16)";
  // 224.0.0.0/4 (multicast)
  if ((n & 0xf0000000) === 0xe0000000) return "multicast";
  // 240.0.0.0/4 (reserved / future use) — includes 255.255.255.255 broadcast
  if ((n & 0xf0000000) === 0xf0000000) return "reserved/broadcast";
  return null;
}

function isBlockedIPv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (lower === "::1") return "loopback (::1)";
  if (lower === "::" || lower === "::0") return "unspecified";
  // link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return "link-local (fe80::/10)";
  }
  // unique local fc00::/7  (fc.. and fd..)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return "unique-local (fc00::/7)";
  // IPv4-mapped ::ffff:a.b.c.d — re-check the embedded v4 address
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) {
    const inner = isBlockedIPv4(mapped[1]);
    if (inner) return `ipv4-mapped ${inner}`;
  }
  return null;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("malformed URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`unsupported scheme ${url.protocol}`);
  }
  const host = url.hostname;
  if (!host) throw new UnsafeUrlError("missing host");

  // If the URL's host is already a literal IP, check it directly.
  const ipFamily = net.isIP(host);
  if (ipFamily === 4) {
    const reason = isBlockedIPv4(host);
    if (reason) throw new UnsafeUrlError(reason);
    return url;
  }
  if (ipFamily === 6) {
    const reason = isBlockedIPv6(host);
    if (reason) throw new UnsafeUrlError(reason);
    return url;
  }

  // Otherwise resolve DNS and check every result.
  let results: { address: string; family: number }[];
  try {
    results = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError(`DNS resolution failed for ${host}`);
  }
  if (results.length === 0) throw new UnsafeUrlError(`no DNS results for ${host}`);
  for (const r of results) {
    const reason = r.family === 4 ? isBlockedIPv4(r.address) : isBlockedIPv6(r.address);
    if (reason) throw new UnsafeUrlError(`${host} resolves to blocked address ${r.address} — ${reason}`);
  }
  return url;
}

export interface SafeFetchOpts {
  maxBytes?: number; // default 10 MB
  timeoutMs?: number; // default 10 s
}

export async function safeFetchText(raw: string, opts: SafeFetchOpts = {}): Promise<string> {
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  await assertSafeUrl(raw);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(raw, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new UnsafeUrlError(`fetch failed with status ${res.status}`);
    }
    if (!res.body) {
      return await res.text();
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new UnsafeUrlError(`response body exceeds ${maxBytes} bytes`);
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  } finally {
    clearTimeout(timeout);
  }
}
