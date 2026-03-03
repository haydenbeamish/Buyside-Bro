import type { Express, Response } from "express";
import { isAdmin, parseIntParam } from "./shared";
import {
  getNewsFeed,
  addNewsFeedItem,
  hasNewsFeedItemForMarketToday,
} from "../creditService";

/**
 * The newsfeed generate-summary endpoint needs the `generateAndPostMarketSummary`
 * function which lives in the orchestrator (routes.ts) because it depends on
 * scheduler logic and push/email side-effects. We accept it as a parameter to
 * avoid a circular dependency.
 */
export function registerNewsfeedRoutes(
  app: Express,
  generateAndPostMarketSummary: (market: string, eventType: string) => Promise<void>,
) {
  app.get("/api/newsfeed", async (req: any, res: Response) => {
    try {
      const limit = parseIntParam(req.query.limit as string) ?? 10;
      const items = await getNewsFeed(limit);
      res.json({ items });
    } catch (error) {
      console.error("Error fetching newsfeed:", error);
      res.status(500).json({ error: "Failed to fetch newsfeed" });
    }
  });

  app.post("/api/newsfeed", isAdmin, async (req: any, res: Response) => {
    try {
      const { title, content, market, eventType, source, metadata } = req.body;

      if (!title || !content || !market || !eventType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const item = await addNewsFeedItem({
        title,
        content,
        market,
        eventType,
        source: source || "manual",
        publishedAt: new Date(),
        metadata,
      });

      res.json(item);
    } catch (error) {
      console.error("Error adding newsfeed item:", error);
      res.status(500).json({ error: "Failed to add newsfeed item" });
    }
  });

  // Market summary generation endpoint (can be called manually or by scheduler)
  app.post("/api/newsfeed/generate-summary", isAdmin, async (req: any, res: Response) => {
    try {
      const { market, eventType } = req.body;

      if (!market || !eventType) {
        return res.status(400).json({ error: "Market and eventType required" });
      }

      // Check for duplicate before generating
      const alreadyPosted = await hasNewsFeedItemForMarketToday(market, eventType);
      if (alreadyPosted) {
        return res.status(409).json({ error: "Summary already posted for this market today" });
      }

      await generateAndPostMarketSummary(market, eventType);
      const items = await getNewsFeed(1);
      res.json(items[0]);
    } catch (error) {
      console.error("Error generating market summary:", error);
      res.status(500).json({ error: "Failed to generate market summary" });
    }
  });
}
