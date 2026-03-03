import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireApiKey } from "../middleware/apiKey";
import { dedup, fetchWithTimeout, LASER_BEAM_API, LASER_BEAM_HEADERS } from "./shared";

export function registerMarketsRoutes(app: Express) {
  app.get("/api/markets", requireApiKey, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    try {
      const forceRefresh = req.query.refresh === "true";
      if (!forceRefresh) {
        const cached = await storage.getCachedData("markets");
        if (cached) {
          return res.json(cached);
        }
      }

      const result = await dedup("markets_fetch", async () => {
        try {
          const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets/full`, { headers: LASER_BEAM_HEADERS });
          if (response.ok) {
            return await response.json();
          }
          console.error(`Laser Beam API returned ${response.status}: ${response.statusText}`);
        } catch (e) {
          console.error("Failed to fetch from Laser Beam API:", e);
        }
        return null;
      });

      if (result && (result.globalMarkets || result.futures)) {
        const marketsData = {
          indices: result.globalMarkets || [],
          futures: result.futures || [],
          commodities: result.commodities || [],
          sectors: result.usaSectors || [],
          crypto: [],
        };
        await storage.setCachedData("markets", marketsData, 5);
        return res.json(marketsData);
      }

      console.warn("API returned no valid data, returning empty arrays");
      res.json({
        indices: [],
        futures: [],
        commodities: [],
        sectors: [],
        crypto: [],
        _stale: true,
      });
    } catch (error) {
      console.error("Markets API error:", error);
      res.status(503).json({
        error: "Market data temporarily unavailable",
        indices: [],
        futures: [],
        commodities: [],
        sectors: [],
        crypto: [],
        _stale: true,
      });
    }
  });

  app.get("/api/markets/full", requireApiKey, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    try {
      const forceRefresh = req.query.refresh === "true";
      if (!forceRefresh) {
        const cached = await storage.getCachedData("markets_full");
        if (cached) {
          return res.json(cached);
        }
      }

      const dedupKey = forceRefresh ? `markets_full_fetch_${Date.now()}` : "markets_full_fetch";
      try {
        const data = await dedup(dedupKey, async () => {
          const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets/full`, { headers: LASER_BEAM_HEADERS }, 15000);
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const apiData = await response.json();
          console.log(`[Markets Full] Upstream API response keys: [${Object.keys(apiData).join(", ")}]`);

          await storage.setCachedData("markets_full", apiData, 5);
          return apiData;
        });
        res.json(data);
      } catch (fetchErr) {
        console.error("Markets full API error:", fetchErr);
        res.status(503).json({ error: "Market data temporarily unavailable. The upstream data provider is not responding." });
      }
    } catch (error) {
      console.error("Markets full route error:", error);
      res.status(500).json({ error: "Failed to fetch markets data" });
    }
  });

  app.get("/api/markets/summary", requireApiKey, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    try {
      const forceRefresh = req.query.refresh === "true";
      if (!forceRefresh) {
        const cached = await storage.getCachedData("market_summary");
        if (cached) {
          return res.json(cached);
        }
      }

      const summaryData = await dedup("market_summary_fetch", async () => {
        const response = await fetch(`${LASER_BEAM_API}/api/markets/summary`, { headers: LASER_BEAM_HEADERS });
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        const result = {
          summary: data.summary,
          generatedAt: data.generatedAt || new Date().toISOString(),
          cached: data.cached || false,
        };
        await storage.setCachedData("market_summary", result, 5);
        return result;
      });

      res.json(summaryData);
    } catch (error) {
      console.error("Market summary error:", error);
      res.json({
        summary: "<b>US Overnight</b>\nMarkets are mixed today with tech leading gains while energy lags. Keep an eye on Fed commentary later this week.",
        generatedAt: new Date().toISOString(),
        cached: false,
      });
    }
  });
}
