import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertWatchlistSchema } from "@shared/schema";
import { fetchWithTimeout, parseIntParam } from "./shared";

const DEFAULT_WATCHLIST_STOCKS = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "MSFT", name: "Microsoft Corporation" },
  { ticker: "GOOGL", name: "Alphabet Inc." },
  { ticker: "AMZN", name: "Amazon.com Inc." },
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "META", name: "Meta Platforms Inc." },
  { ticker: "TSLA", name: "Tesla Inc." },
  { ticker: "AVGO", name: "Broadcom Inc." },
  { ticker: "COST", name: "Costco Wholesale" },
  { ticker: "NFLX", name: "Netflix Inc." },
  { ticker: "AMD", name: "Advanced Micro Devices" },
  { ticker: "ADBE", name: "Adobe Inc." },
  { ticker: "CRM", name: "Salesforce Inc." },
  { ticker: "INTC", name: "Intel Corporation" },
  { ticker: "PYPL", name: "PayPal Holdings Inc." },
  { ticker: "BHP.AX", name: "BHP Group Ltd" },
  { ticker: "CBA.AX", name: "Commonwealth Bank of Australia" },
  { ticker: "CSL.AX", name: "CSL Ltd" },
  { ticker: "9988.HK", name: "Alibaba Group Holding Ltd" },
];

export function registerWatchlistRoutes(app: Express) {
  // Default watchlist (public, no auth) - returns enriched default stocks
  app.get("/api/watchlist/default", async (req: Request, res: Response) => {
    try {
      // Check cache first (5-minute TTL)
      const cached = await storage.getCachedData("default_watchlist_enriched");
      if (cached) {
        return res.json(cached);
      }

      const apiKey = process.env.FMP_API_KEY;
      const quoteMap = new Map<string, any>();
      const metricsMap = new Map<string, any>();
      const profileMap = new Map<string, any>();

      if (apiKey) {
        try {
          const allRequests: Promise<void>[] = [];
          for (const item of DEFAULT_WATCHLIST_STOCKS) {
            const ticker = item.ticker.toUpperCase();
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) quoteMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) metricsMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) profileMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
          }
          await Promise.all(allRequests);
        } catch (e) {
          console.error("Failed to fetch FMP data for default watchlist:", e);
        }
      }

      const enriched = DEFAULT_WATCHLIST_STOCKS.map((item, idx) => {
        const ticker = item.ticker.toUpperCase();
        const quote = quoteMap.get(ticker) || {};
        const metrics = metricsMap.get(ticker) || {};
        const profile = profileMap.get(ticker) || {};
        const price = quote.price || profile.price || null;
        const dayChangePercent = quote.changePercentage || profile.changePercentage || 0;
        const earningsYield = metrics.earningsYieldTTM;
        const pe = earningsYield && earningsYield > 0 ? 1 / earningsYield : null;

        return {
          id: idx + 1,
          ticker: item.ticker,
          name: profile.companyName || item.name,
          notes: null,
          addedAt: new Date(),
          price,
          dayChangePercent,
          marketCap: quote.marketCap ?? profile.marketCap ?? null,
          pe,
          yearHigh: quote.yearHigh ?? null,
          yearLow: quote.yearLow ?? null,
          volume: quote.volume ?? null,
          avgVolume: quote.avgVolume ?? null,
        };
      });

      // Cache for 5 minutes (300 seconds = 5 minutes)
      await storage.setCachedData("default_watchlist_enriched", enriched, 5);
      res.json(enriched);
    } catch (error) {
      console.error("Default watchlist error:", error);
      res.status(500).json({ error: "Failed to fetch default watchlist" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlist", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getWatchlist(userId);
      res.json(items);
    } catch (error) {
      console.error("Watchlist error:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertWatchlistSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }
      const item = await storage.addToWatchlist(userId, {
        ticker: validation.data.ticker.toUpperCase(),
        name: validation.data.name || null,
      });
      res.status(201).json(item);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: "Ticker already in watchlist" });
      }
      console.error("Add to watchlist error:", error);
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseIntParam(req.params.id as string);
      if (id === null) return res.status(400).json({ error: "Invalid id" });
      await storage.removeFromWatchlist(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Remove from watchlist error:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  });

  app.patch("/api/watchlist/:id/notes", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseIntParam(req.params.id as string);
      if (id === null) return res.status(400).json({ error: "Invalid id" });
      const { notes } = req.body;
      if (typeof notes !== "string") {
        return res.status(400).json({ error: "Notes must be a string" });
      }
      const updated = await storage.updateWatchlistNotes(userId, id, notes);
      if (!updated) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update watchlist notes error:", error);
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  app.get("/api/watchlist/enriched", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getWatchlist(userId);
      if (items.length === 0) {
        return res.json([]);
      }

      const apiKey = process.env.FMP_API_KEY;
      const quoteMap = new Map<string, any>();
      const metricsMap = new Map<string, any>();
      const profileMap = new Map<string, any>();

      if (apiKey) {
        try {
          const allRequests: Promise<void>[] = [];
          for (const item of items) {
            const ticker = item.ticker.toUpperCase();
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) quoteMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) metricsMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
            allRequests.push(
              fetchWithTimeout(`https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`, {}, 8000)
                .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d[0]) profileMap.set(ticker, d[0]); } })
                .catch(() => {})
            );
          }
          await Promise.all(allRequests);
        } catch (e) {
          console.error("Failed to fetch FMP data for watchlist:", e);
        }
      }

      const enriched = items.map(item => {
        const ticker = item.ticker.toUpperCase();
        const quote = quoteMap.get(ticker) || {};
        const metrics = metricsMap.get(ticker) || {};
        const profile = profileMap.get(ticker) || {};

        const price = quote.price || profile.price || null;
        const dayChangePercent = quote.changePercentage || profile.changePercentage || 0;
        const earningsYield = metrics.earningsYieldTTM;
        const pe = earningsYield && earningsYield > 0 ? 1 / earningsYield : null;

        return {
          ...item,
          price,
          name: profile.companyName || item.name || item.ticker,
          dayChangePercent,
          marketCap: quote.marketCap ?? profile.marketCap ?? null,
          pe,
          yearHigh: quote.yearHigh ?? null,
          yearLow: quote.yearLow ?? null,
          volume: quote.volume ?? null,
          avgVolume: quote.avgVolume ?? null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Enriched watchlist error:", error);
      res.status(500).json({ error: "Failed to fetch enriched watchlist" });
    }
  });

  // Seed watchlist endpoint (one-time use per user)
  app.post("/api/watchlist/seed", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getWatchlist(userId);
      if (existing.length > 0) {
        return res.json({ message: "Watchlist already has items", count: existing.length });
      }

      const defaultStocks = DEFAULT_WATCHLIST_STOCKS;

      for (const stock of defaultStocks) {
        try {
          await storage.addToWatchlist(userId, stock);
        } catch (e) {
          // skip duplicates
        }
      }

      const items = await storage.getWatchlist(userId);
      res.json({ message: "Watchlist seeded", count: items.length, items });
    } catch (error) {
      console.error("Seed watchlist error:", error);
      res.status(500).json({ error: "Failed to seed watchlist" });
    }
  });
}
