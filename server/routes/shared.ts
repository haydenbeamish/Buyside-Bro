import type { Response, NextFunction } from "express";
import OpenAI from "openai";

// ── Parse helpers ────────────────────────────────────────────────────

export function parseIntParam(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

// ── Admin guard ──────────────────────────────────────────────────────

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "hbeamish1@gmail.com")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(req: any, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!ADMIN_EMAILS.includes(user.claims.email.toLowerCase())) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// ── Ticker helpers ───────────────────────────────────────────────────

export function isValidTicker(ticker: string): boolean {
  return /^[A-Za-z0-9._-]{1,20}$/.test(ticker);
}

export function normalizeTicker(ticker: string): string {
  return ticker.replace(/\.ASX$/i, ".AX").toUpperCase();
}

// ── Laser Beam Capital API ───────────────────────────────────────────

export const LASER_BEAM_API = "https://api.laserbeamcapital.com";
if (!process.env.LASERBEAMNODE_API_KEY) {
  console.error("WARNING: LASERBEAMNODE_API_KEY environment variable is not set! Market data API calls will fail with 401.");
}
export const LASER_BEAM_HEADERS: HeadersInit = {
  "X-API-Key": process.env.LASERBEAMNODE_API_KEY || "",
};

// ── Request deduplication ────────────────────────────────────────────

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicates concurrent calls with the same key.
 * If a request with the given key is already in-flight, returns the same promise.
 * Otherwise, executes the factory and shares the result with any concurrent callers.
 */
export function dedup<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) return existing;
  const promise = factory();
  pendingRequests.set(key, promise);
  promise.catch(() => {}).finally(() => pendingRequests.delete(key));
  return promise;
}

// ── Fetch with timeout ───────────────────────────────────────────────

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ── OpenRouter AI client ─────────────────────────────────────────────

export const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY || "",
});
