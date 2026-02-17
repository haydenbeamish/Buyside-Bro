import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that validates the x-api-key header against FRONTEND_API_KEY.
 * Used to protect data endpoints that the frontend calls directly.
 * Falls back to LASERBEAMNODE_API_KEY if FRONTEND_API_KEY is not set.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.FRONTEND_API_KEY || process.env.LASERBEAMNODE_API_KEY;

  if (!expectedKey) {
    console.error("[Security] No API key configured (FRONTEND_API_KEY or LASERBEAMNODE_API_KEY)");
    res.status(500).json({ error: true, message: "Server misconfiguration" });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: true, message: "Invalid or missing API key" });
    return;
  }

  next();
}

/**
 * Wraps a data payload in the standard API response envelope.
 */
export function wrapResponse(data: unknown): { error: false; data: unknown } {
  return { error: false, data };
}
