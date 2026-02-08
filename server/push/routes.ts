import type { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  registerDevice,
  unregisterDevice,
  getPreferences,
  updatePreferences,
  getWatchlistTargets,
  sendPriceAlert,
  sendMarketSummaryNotification,
} from "./pushService";

function isInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey || apiKey !== internalKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function registerPushRoutes(app: Express): void {
  // --- User-facing routes (authenticated) ---

  app.post("/api/push/register", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { deviceToken, platform } = req.body;

      if (!deviceToken || !platform) {
        return res.status(400).json({ error: "deviceToken and platform are required" });
      }

      if (!["ios", "web"].includes(platform)) {
        return res.status(400).json({ error: "platform must be 'ios' or 'web'" });
      }

      const result = await registerDevice(userId, deviceToken, platform);
      res.json({ success: true, id: result.id });
    } catch (error) {
      console.error("[Push] Register error:", error);
      res.status(500).json({ error: "Failed to register device" });
    }
  });

  app.delete("/api/push/unregister", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { deviceToken } = req.body;

      if (!deviceToken) {
        return res.status(400).json({ error: "deviceToken is required" });
      }

      await unregisterDevice(deviceToken);
      res.json({ success: true });
    } catch (error) {
      console.error("[Push] Unregister error:", error);
      res.status(500).json({ error: "Failed to unregister device" });
    }
  });

  app.get("/api/push/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const prefs = await getPreferences(userId);
      res.json(prefs);
    } catch (error) {
      console.error("[Push] Get preferences error:", error);
      res.status(500).json({ error: "Failed to get preferences" });
    }
  });

  app.put("/api/push/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const allowedFields = [
        "watchlistPriceAlerts",
        "priceAlertThreshold",
        "usaMarketSummary",
        "asxMarketSummary",
        "europeMarketSummary",
      ];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const result = await updatePreferences(userId, updates);
      res.json(result);
    } catch (error) {
      console.error("[Push] Update preferences error:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // --- Internal server-to-server routes ---

  app.get("/api/internal/push/watchlist-targets", isInternalApiKey, async (_req: Request, res: Response) => {
    try {
      const targets = await getWatchlistTargets();
      res.json(targets);
    } catch (error) {
      console.error("[Push] Watchlist targets error:", error);
      res.status(500).json({ error: "Failed to get watchlist targets" });
    }
  });

  app.post("/api/internal/push/notify-price-alert", isInternalApiKey, async (req: Request, res: Response) => {
    try {
      const { symbol, currentPrice, previousClose, changePercent, direction, userIds } = req.body;

      if (!symbol || currentPrice == null || previousClose == null || changePercent == null || !direction || !Array.isArray(userIds)) {
        return res.status(400).json({ error: "Missing required fields: symbol, currentPrice, previousClose, changePercent, direction, userIds" });
      }

      const result = await sendPriceAlert(symbol, currentPrice, previousClose, changePercent, direction, userIds);
      res.json(result);
    } catch (error) {
      console.error("[Push] Price alert error:", error);
      res.status(500).json({ error: "Failed to send price alert" });
    }
  });

  app.post("/api/internal/push/notify-summary", isInternalApiKey, async (req: Request, res: Response) => {
    try {
      const { summaryType, summaryId } = req.body;

      if (!summaryType || !summaryId) {
        return res.status(400).json({ error: "summaryType and summaryId are required" });
      }

      const result = await sendMarketSummaryNotification(summaryType, String(summaryId));
      res.json(result);
    } catch (error) {
      console.error("[Push] Summary notification error:", error);
      res.status(500).json({ error: "Failed to send summary notification" });
    }
  });
}
