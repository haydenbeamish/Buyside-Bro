import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that validates the x-api-key header.
 * Checks against FRONTEND_API_KEY first, then falls back to LASERBEAMNODE_API_KEY.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  const frontendKey = process.env.FRONTEND_API_KEY;
  const backendKey = process.env.LASERBEAMNODE_API_KEY;

  if (!frontendKey && !backendKey) {
    console.error("[Security] No API key configured (FRONTEND_API_KEY or LASERBEAMNODE_API_KEY)");
    res.status(500).json({ error: true, message: "Server misconfiguration" });
    return;
  }

  if (!apiKey || (apiKey !== frontendKey && apiKey !== backendKey)) {
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
