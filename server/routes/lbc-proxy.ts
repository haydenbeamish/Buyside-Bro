import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireApiKey, wrapResponse } from "../middleware/apiKey";
import {
  isValidTicker,
  normalizeTicker,
  fetchWithTimeout,
  LASER_BEAM_API,
  LASER_BEAM_HEADERS,
} from "./shared";

export function registerLbcProxyRoutes(app: Express) {
  // GET /api/performance — Fund performance metrics, returns, holdings, exposure
  app.get("/api/performance", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("performance");
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/performance`, { headers: LASER_BEAM_HEADERS }, 15000);
      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch performance data" });
      }

      const data = await response.json();
      await storage.setCachedData("performance", data, 10);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Performance] Error:", error);
      res.status(502).json({ error: true, message: "Performance data temporarily unavailable" });
    }
  });

  // GET /api/newsletter?month=YYYY-MM — Full newsletter data
  app.get("/api/newsletter", requireApiKey, async (req: Request, res: Response) => {
    try {
      const month = req.query.month as string;
      if (month && !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: true, message: "month must be in YYYY-MM format" });
      }

      const cacheKey = `newsletter_${month || "latest"}`;
      const cached = await storage.getCachedData(cacheKey);
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const queryString = month ? `?month=${encodeURIComponent(month)}` : "";
      const response = await fetchWithTimeout(
        `${LASER_BEAM_API}/api/newsletter${queryString}`,
        { headers: LASER_BEAM_HEADERS },
        15000
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch newsletter data" });
      }

      const data = await response.json();
      await storage.setCachedData(cacheKey, data, 60);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Newsletter] Error:", error);
      res.status(502).json({ error: true, message: "Newsletter data temporarily unavailable" });
    }
  });

  // GET /api/model — Financial model projections
  app.get("/api/model", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("model");
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/model`, { headers: LASER_BEAM_HEADERS }, 15000);
      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch model data" });
      }

      const data = await response.json();
      await storage.setCachedData("model", data, 10);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Model] Error:", error);
      res.status(502).json({ error: true, message: "Model data temporarily unavailable" });
    }
  });

  // GET /api/top-movers — MTD/YTD top gainers and decliners
  app.get("/api/top-movers", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("top_movers");
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/top-movers`, { headers: LASER_BEAM_HEADERS }, 10000);
      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch top movers" });
      }

      const data = await response.json();
      await storage.setCachedData("top_movers", data, 5);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Top Movers] Error:", error);
      res.status(502).json({ error: true, message: "Top movers data temporarily unavailable" });
    }
  });

  // GET /api/live-pnl — External holdings with live P&L
  app.get("/api/live-pnl", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("live_pnl");
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/live-pnl`, { headers: LASER_BEAM_HEADERS }, 10000);
      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch live P&L" });
      }

      const data = await response.json();
      await storage.setCachedData("live_pnl", data, 2);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Live PnL] Error:", error);
      res.status(502).json({ error: true, message: "Live P&L data temporarily unavailable" });
    }
  });

  // GET /api/news/market — Market news with sentiment
  app.get("/api/news/market", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("news_market");
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/news/market`, { headers: LASER_BEAM_HEADERS }, 10000);
      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch market news" });
      }

      const data = await response.json();
      await storage.setCachedData("news_market", data, 5);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[News Market] Error:", error);
      res.status(502).json({ error: true, message: "Market news temporarily unavailable" });
    }
  });

  // GET /api/news/ticker/:symbol — Company-specific news
  app.get("/api/news/ticker/:symbol", requireApiKey, async (req: Request, res: Response) => {
    try {
      const rawSymbol = req.params.symbol as string;
      if (!isValidTicker(rawSymbol)) {
        return res.status(400).json({ error: true, message: "Invalid ticker symbol" });
      }
      const symbol = normalizeTicker(rawSymbol);

      const cacheKey = `news_ticker_${symbol}`;
      const cached = await storage.getCachedData(cacheKey);
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      const response = await fetchWithTimeout(
        `${LASER_BEAM_API}/api/news/ticker/${encodeURIComponent(symbol)}`,
        { headers: LASER_BEAM_HEADERS },
        10000
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch ticker news" });
      }

      const data = await response.json();
      await storage.setCachedData(cacheKey, data, 5);
      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[News Ticker] Error:", error);
      res.status(502).json({ error: true, message: "Ticker news temporarily unavailable" });
    }
  });

  // GET /api/cached-analysis/:ticker — Pre-cached daily analysis
  app.get("/api/cached-analysis/:ticker", requireApiKey, async (req: Request, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: true, message: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);

      // Check local DB cache first (populated by scheduler for MSFT)
      const cacheKey = `deep_analysis_${ticker}`;
      const cached = await storage.getCachedData(cacheKey);
      if (cached) {
        return res.json(wrapResponse(cached));
      }

      // If not cached locally, proxy to upstream
      const response = await fetchWithTimeout(
        `${LASER_BEAM_API}/api/cached-analysis/${encodeURIComponent(ticker)}`,
        { headers: LASER_BEAM_HEADERS },
        30000
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: true, message: "Failed to fetch cached analysis" });
      }

      const data = await response.json() as any;
      if (data.loading) {
        return res.json(wrapResponse({ loading: true }));
      }

      // Cache if quality result
      if (data.analysis && data.analysis.length > 500) {
        await storage.setCachedData(cacheKey, data, 24 * 60);
      }

      res.json(wrapResponse(data));
    } catch (error) {
      console.error("[Cached Analysis] Error:", error);
      res.status(502).json({ error: true, message: "Cached analysis temporarily unavailable" });
    }
  });
}
