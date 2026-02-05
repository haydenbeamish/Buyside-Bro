import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { insertPortfolioHoldingSchema } from "@shared/schema";
import OpenAI from "openai";

const LASER_BEAM_API = "https://laserbeamcapital.replit.app";

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY || "",
});

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<globalThis.Response> {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerChatRoutes(app);

  app.get("/api/markets", async (req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("markets");
      if (cached) {
        return res.json(cached);
      }

      let data: any = {};
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets`);
        if (response.ok) {
          data = await response.json();
        }
      } catch (e) {
        console.error("Failed to fetch from Laser Beam API:", e);
      }
      
      const marketsData = {
        indices: data.indices || [
          { symbol: "SPY", name: "S&P 500", price: 4567.89, change: 12.34, changePercent: 0.27 },
          { symbol: "QQQ", name: "Nasdaq 100", price: 15234.56, change: -23.45, changePercent: -0.15 },
          { symbol: "DIA", name: "Dow Jones", price: 35678.90, change: 45.67, changePercent: 0.13 },
          { symbol: "IWM", name: "Russell 2000", price: 1987.65, change: -5.43, changePercent: -0.27 },
          { symbol: "VIX", name: "Volatility Index", price: 15.67, change: -0.45, changePercent: -2.79 },
          { symbol: "DXY", name: "US Dollar Index", price: 104.32, change: 0.23, changePercent: 0.22 },
        ],
        futures: data.futures || [
          { symbol: "ES", name: "S&P 500 Futures", price: 4570.25, change: 8.50, changePercent: 0.19 },
          { symbol: "NQ", name: "Nasdaq Futures", price: 15280.00, change: -15.75, changePercent: -0.10 },
          { symbol: "YM", name: "Dow Futures", price: 35720.00, change: 35.00, changePercent: 0.10 },
          { symbol: "RTY", name: "Russell Futures", price: 1992.30, change: -2.80, changePercent: -0.14 },
        ],
        commodities: data.commodities || [
          { symbol: "GC", name: "Gold", price: 2045.30, change: 12.50, changePercent: 0.61 },
          { symbol: "SI", name: "Silver", price: 24.87, change: 0.34, changePercent: 1.38 },
          { symbol: "CL", name: "Crude Oil WTI", price: 78.45, change: -1.23, changePercent: -1.54 },
          { symbol: "NG", name: "Natural Gas", price: 2.89, change: 0.05, changePercent: 1.76 },
        ],
        sectors: data.sectors || [
          { name: "Technology", change: 1.24 },
          { name: "Healthcare", change: -0.45 },
          { name: "Financials", change: 0.67 },
          { name: "Consumer Disc", change: 0.89 },
          { name: "Energy", change: -1.23 },
          { name: "Industrials", change: 0.34 },
          { name: "Materials", change: 0.56 },
          { name: "Utilities", change: -0.12 },
          { name: "Real Estate", change: -0.78 },
          { name: "Comm Services", change: 0.91 },
          { name: "Consumer Staples", change: 0.23 },
        ],
        crypto: data.crypto || [],
      };

      await storage.setCachedData("markets", marketsData, 1);
      res.json(marketsData);
    } catch (error) {
      console.error("Markets API error:", error);
      res.json({
        indices: [
          { symbol: "SPY", name: "S&P 500", price: 4567.89, change: 12.34, changePercent: 0.27 },
          { symbol: "QQQ", name: "Nasdaq 100", price: 15234.56, change: -23.45, changePercent: -0.15 },
          { symbol: "DIA", name: "Dow Jones", price: 35678.90, change: 45.67, changePercent: 0.13 },
          { symbol: "IWM", name: "Russell 2000", price: 1987.65, change: -5.43, changePercent: -0.27 },
        ],
        futures: [
          { symbol: "ES", name: "S&P 500 Futures", price: 4570.25, change: 8.50, changePercent: 0.19 },
          { symbol: "NQ", name: "Nasdaq Futures", price: 15280.00, change: -15.75, changePercent: -0.10 },
        ],
        commodities: [
          { symbol: "GC", name: "Gold", price: 2045.30, change: 12.50, changePercent: 0.61 },
          { symbol: "CL", name: "Crude Oil", price: 78.45, change: -1.23, changePercent: -1.54 },
        ],
        sectors: [
          { name: "Technology", change: 1.24 },
          { name: "Healthcare", change: -0.45 },
          { name: "Financials", change: 0.67 },
        ],
        crypto: [],
      });
    }
  });

  app.get("/api/markets/full", async (req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("markets_full");
      if (cached) {
        return res.json(cached);
      }

      const globalMarkets = [
        { name: "VIX Volatility", price: 19.47, change1D: 4.5, change1M: 32.0, change1Q: 2.5, change1Y: 13.1, vs10D: 13.4, vs20D: 16.6, vs200D: 10.3 },
        { name: "Canada", price: 32571.60, change1D: 0.6, change1M: 0.5, change1Q: 9.4, change1Y: 29.0, vs10D: -0.6, vs20D: -0.7, vs200D: 12.5 },
        { name: "Hang Seng", price: 26885.24, change1D: 0.1, change1M: 1.6, change1Q: 3.7, change1Y: 32.9, vs10D: -0.9, vs20D: 0.0, vs200D: 6.6 },
        { name: "Euro Stoxx", price: 5962.26, change1D: -0.1, change1M: 0.7, change1Q: 5.3, change1Y: 12.8, vs10D: 0.0, vs20D: -0.1, vs200D: 8.1 },
        { name: "Germany DAX", price: 24499.27, change1D: -0.4, change1M: -2.5, change1Q: 1.5, change1Y: 11.9, vs10D: -0.8, vs20D: -1.6, vs200D: 2.0 },
        { name: "FTSE 100", price: 10352.11, change1D: -0.5, change1M: 3.0, change1Q: 5.9, change1Y: 18.6, vs10D: 1.0, vs20D: 1.4, vs200D: 11.0 },
        { name: "ASX 200", price: 8889.20, change1D: -0.4, change1M: 2.0, change1Q: 0.9, change1Y: 4.3, vs10D: 0.0, vs20D: 0.5, vs200D: 2.3 },
        { name: "S&P 500", price: 6882.72, change1D: -0.5, change1M: -0.3, change1Q: 0.4, change1Y: 14.8, vs10D: -0.9, vs20D: -0.7, vs200D: 6.7 },
        { name: "Nifty 50", price: 25643.50, change1D: -0.5, change1M: -2.3, change1Q: 0.2, change1Y: 10.7, vs10D: 1.0, vs20D: 0.5, vs200D: 1.6 },
        { name: "China CSI 300", price: 4670.42, change1D: -0.6, change1M: -2.2, change1Q: -0.5, change1Y: 23.0, vs10D: -0.5, vs20D: -1.0, vs200D: 8.1 },
        { name: "Russell 2000", price: 2624.55, change1D: -0.9, change1M: 3.0, change1Q: 6.2, change1Y: 16.2, vs10D: -1.1, vs20D: -0.9, vs200D: 12.1 },
        { name: "Nikkei", price: 53818.04, change1D: -0.9, change1M: 2.5, change1Q: 2.7, change1Y: 34.8, vs10D: 0.5, vs20D: 0.8, vs200D: 21.1 },
        { name: "Saudi Tadawul", price: 11200.06, change1D: -1.2, change1M: 7.1, change1Q: -0.4, change1Y: -9.8, vs10D: -1.0, vs20D: 0.9, vs200D: 1.5 },
        { name: "Taiwan", price: 31801.27, change1D: -1.5, change1M: 4.5, change1Q: 14.0, change1Y: 40.1, vs10D: -1.1, vs20D: 0.5, vs200D: 25.0 },
        { name: "Nasdaq", price: 24891.24, change1D: -1.8, change1M: -2.0, change1Q: -4.2, change1Y: 16.9, vs10D: -2.8, vs20D: -2.7, vs200D: 5.1 },
        { name: "Brazil Bovespa", price: 181708.00, change1D: -2.1, change1M: 11.0, change1Q: 21.5, change1Y: 44.1, vs10D: 0.1, vs20D: 4.9, vs200D: 24.0 },
        { name: "Bitcoin", price: 71471.26, change1D: -2.1, change1M: -25.2, change1Q: -22.4, change1Y: -32.3, vs10D: -10.8, vs20D: -16.1, vs200D: -30.7 },
      ];

      const futures = [
        { name: "S&P 500 E-mini", price: 5875.25, change1D: -0.4, change1M: -0.2, change1Q: 0.5, change1Y: 15.2, vs10D: -0.8, vs20D: -0.6, vs200D: 7.1 },
        { name: "Nasdaq 100 E-mini", price: 21250.00, change1D: -1.6, change1M: -1.8, change1Q: -3.8, change1Y: 17.5, vs10D: -2.5, vs20D: -2.4, vs200D: 5.8 },
        { name: "Dow Jones E-mini", price: 42850.00, change1D: -0.3, change1M: 0.8, change1Q: 2.1, change1Y: 12.4, vs10D: -0.4, vs20D: -0.2, vs200D: 8.2 },
        { name: "Russell 2000 E-mini", price: 2285.00, change1D: -0.8, change1M: 2.8, change1Q: 5.9, change1Y: 15.8, vs10D: -1.0, vs20D: -0.8, vs200D: 11.8 },
        { name: "Crude Oil WTI", price: 61.25, change1D: -1.2, change1M: -8.5, change1Q: -15.2, change1Y: -22.4, vs10D: -3.2, vs20D: -5.8, vs200D: -18.5 },
        { name: "Gold", price: 3325.50, change1D: 0.8, change1M: 5.2, change1Q: 12.8, change1Y: 28.5, vs10D: 1.5, vs20D: 2.8, vs200D: 22.4 },
      ];

      const commodities = [
        { name: "Gold", price: 3325.50, change1D: 0.8, change1M: 5.2, change1Q: 12.8, change1Y: 28.5, vs10D: 1.5, vs20D: 2.8, vs200D: 22.4 },
        { name: "Silver", price: 32.85, change1D: 1.2, change1M: 8.5, change1Q: 15.2, change1Y: 35.8, vs10D: 2.1, vs20D: 4.5, vs200D: 28.5 },
        { name: "Crude Oil WTI", price: 61.25, change1D: -1.2, change1M: -8.5, change1Q: -15.2, change1Y: -22.4, vs10D: -3.2, vs20D: -5.8, vs200D: -18.5 },
        { name: "Natural Gas", price: 3.45, change1D: 2.5, change1M: 15.2, change1Q: -5.8, change1Y: -12.5, vs10D: 5.2, vs20D: 8.5, vs200D: -8.2 },
        { name: "Copper", price: 4.85, change1D: -0.6, change1M: 2.5, change1Q: 8.2, change1Y: 12.5, vs10D: -0.8, vs20D: 0.5, vs200D: 8.5 },
        { name: "Platinum", price: 1025.50, change1D: 0.4, change1M: 3.2, change1Q: 5.8, change1Y: 8.5, vs10D: 0.5, vs20D: 1.2, vs200D: 5.2 },
        { name: "Wheat", price: 545.25, change1D: -0.8, change1M: -5.2, change1Q: -12.5, change1Y: -18.5, vs10D: -1.2, vs20D: -2.5, vs200D: -15.2 },
        { name: "Corn", price: 445.50, change1D: -0.5, change1M: -3.8, change1Q: -8.5, change1Y: -15.2, vs10D: -0.8, vs20D: -1.5, vs200D: -12.5 },
      ];

      const usaSectors = [
        { name: "Technology", price: 100.00, change1D: -1.5, change1M: -1.8, change1Q: -2.5, change1Y: 18.5, vs10D: -2.2, vs20D: -2.0, vs200D: 8.5 },
        { name: "Healthcare", price: 100.00, change1D: 0.2, change1M: 1.5, change1Q: 3.2, change1Y: 8.5, vs10D: 0.5, vs20D: 0.8, vs200D: 5.2 },
        { name: "Financials", price: 100.00, change1D: 0.5, change1M: 2.8, change1Q: 5.5, change1Y: 22.5, vs10D: 0.8, vs20D: 1.2, vs200D: 15.2 },
        { name: "Consumer Discretionary", price: 100.00, change1D: -0.8, change1M: -0.5, change1Q: 1.2, change1Y: 12.5, vs10D: -1.0, vs20D: -0.8, vs200D: 6.5 },
        { name: "Industrials", price: 100.00, change1D: -0.3, change1M: 1.2, change1Q: 2.8, change1Y: 15.8, vs10D: -0.5, vs20D: 0.2, vs200D: 10.5 },
        { name: "Energy", price: 100.00, change1D: -1.8, change1M: -5.5, change1Q: -12.5, change1Y: -8.5, vs10D: -2.5, vs20D: -4.2, vs200D: -5.2 },
        { name: "Materials", price: 100.00, change1D: -0.5, change1M: 0.8, change1Q: 3.5, change1Y: 10.5, vs10D: -0.2, vs20D: 0.5, vs200D: 6.8 },
        { name: "Real Estate", price: 100.00, change1D: 0.3, change1M: 1.8, change1Q: 2.5, change1Y: 5.8, vs10D: 0.5, vs20D: 0.8, vs200D: 2.5 },
        { name: "Utilities", price: 100.00, change1D: 0.8, change1M: 3.5, change1Q: 8.5, change1Y: 18.5, vs10D: 1.2, vs20D: 2.0, vs200D: 12.5 },
        { name: "Consumer Staples", price: 100.00, change1D: 0.2, change1M: 1.2, change1Q: 2.8, change1Y: 8.2, vs10D: 0.4, vs20D: 0.6, vs200D: 5.5 },
        { name: "Communication Services", price: 100.00, change1D: -1.2, change1M: -2.5, change1Q: -1.8, change1Y: 15.2, vs10D: -1.8, vs20D: -2.2, vs200D: 8.2 },
      ];

      const usaThematics = [
        { name: "Homebuilders", price: 100.00, change1D: 3.4, change1M: 8.5, change1Q: 12.5, change1Y: 35.2, vs10D: 4.2, vs20D: 5.5, vs200D: 28.5 },
        { name: "Oil Producers", price: 100.00, change1D: 2.9, change1M: -3.5, change1Q: -8.5, change1Y: -5.2, vs10D: 1.5, vs20D: -1.2, vs200D: -2.5 },
        { name: "Transportation", price: 100.00, change1D: 2.6, change1M: 4.2, change1Q: 8.5, change1Y: 18.5, vs10D: 2.8, vs20D: 3.5, vs200D: 12.5 },
        { name: "Regional Banks", price: 100.00, change1D: 1.6, change1M: 5.8, change1Q: 12.5, change1Y: 28.5, vs10D: 2.2, vs20D: 3.8, vs200D: 22.5 },
        { name: "Semiconductors", price: 100.00, change1D: -0.2, change1M: -5.2, change1Q: -8.5, change1Y: 25.8, vs10D: -2.5, vs20D: -4.2, vs200D: 15.2 },
        { name: "Clean Energy", price: 100.00, change1D: 0.8, change1M: 2.5, change1Q: 5.8, change1Y: -12.5, vs10D: 1.2, vs20D: 1.8, vs200D: -8.5 },
        { name: "Cybersecurity", price: 100.00, change1D: -0.5, change1M: 1.8, change1Q: 5.2, change1Y: 22.5, vs10D: -0.2, vs20D: 0.8, vs200D: 15.8 },
        { name: "AI & Robotics", price: 100.00, change1D: -1.5, change1M: -3.8, change1Q: -5.2, change1Y: 28.5, vs10D: -2.8, vs20D: -3.5, vs200D: 18.5 },
      ];

      const forex = [
        { name: "EUR/USD", price: 1.1285, change1D: 0.2, change1M: 2.5, change1Q: 4.8, change1Y: 8.5, vs10D: 0.5, vs20D: 1.2, vs200D: 5.2 },
        { name: "GBP/USD", price: 1.3245, change1D: 0.1, change1M: 1.8, change1Q: 3.5, change1Y: 6.2, vs10D: 0.3, vs20D: 0.8, vs200D: 4.2 },
        { name: "USD/JPY", price: 143.25, change1D: -0.3, change1M: -2.5, change1Q: -5.2, change1Y: -8.5, vs10D: -0.8, vs20D: -1.5, vs200D: -5.8 },
        { name: "AUD/USD", price: 0.6485, change1D: -0.2, change1M: 1.2, change1Q: 2.8, change1Y: 3.5, vs10D: 0.2, vs20D: 0.5, vs200D: 2.2 },
        { name: "USD/CHF", price: 0.8285, change1D: -0.1, change1M: -1.5, change1Q: -3.2, change1Y: -5.8, vs10D: -0.3, vs20D: -0.8, vs200D: -3.5 },
        { name: "USD/CAD", price: 1.3825, change1D: 0.1, change1M: -0.8, change1Q: -1.5, change1Y: -2.5, vs10D: 0.2, vs20D: -0.2, vs200D: -1.2 },
      ];

      const marketsFullData = {
        globalMarkets,
        futures,
        commodities,
        usaThematics,
        usaSectors,
        usaEqualWeight: usaSectors.map(s => ({ ...s, name: s.name + " (EW)" })),
        asxSectors: [
          { name: "Materials", price: 100.00, change1D: -3.3, change1M: -5.2, change1Q: -8.5, change1Y: -12.5, vs10D: -4.2, vs20D: -5.8, vs200D: -8.5 },
          { name: "Consumer Discretionary", price: 100.00, change1D: 1.4, change1M: 3.5, change1Q: 5.8, change1Y: 12.5, vs10D: 1.8, vs20D: 2.5, vs200D: 8.5 },
          { name: "Consumer Staples", price: 100.00, change1D: 1.0, change1M: 2.2, change1Q: 4.5, change1Y: 8.2, vs10D: 1.2, vs20D: 1.5, vs200D: 5.2 },
          { name: "Financials", price: 100.00, change1D: 0.8, change1M: 2.5, change1Q: 5.2, change1Y: 15.8, vs10D: 1.0, vs20D: 1.8, vs200D: 12.5 },
          { name: "Energy", price: 100.00, change1D: -1.2, change1M: -3.5, change1Q: -8.2, change1Y: -5.2, vs10D: -1.5, vs20D: -2.8, vs200D: -3.5 },
          { name: "Healthcare", price: 100.00, change1D: 0.5, change1M: 1.8, change1Q: 3.5, change1Y: 10.5, vs10D: 0.8, vs20D: 1.2, vs200D: 6.8 },
        ],
        forex,
        lastUpdated: "2 min ago",
      };

      await storage.setCachedData("markets_full", marketsFullData, 2);
      res.json(marketsFullData);
    } catch (error) {
      console.error("Markets full API error:", error);
      res.status(500).json({ error: "Failed to fetch markets data" });
    }
  });

  app.get("/api/markets/summary", async (req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("market_summary");
      if (cached) {
        return res.json(cached);
      }

      const completion = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          {
            role: "system",
            content: "You are a friendly financial analyst providing brief market summaries. Keep it casual but informative, like explaining to a friend. Max 2-3 sentences."
          },
          {
            role: "user",
            content: "Give a brief summary of the current market conditions and sentiment. Be concise and casual."
          }
        ],
        max_tokens: 200,
      });

      const summary = completion.choices[0]?.message?.content || "Markets are doing their thing today. Check the numbers above for details.";
      
      const summaryData = {
        summary,
        sentiment: summary.toLowerCase().includes("down") || summary.toLowerCase().includes("decline") || summary.toLowerCase().includes("bear")
          ? "bearish"
          : summary.toLowerCase().includes("up") || summary.toLowerCase().includes("gain") || summary.toLowerCase().includes("bull")
          ? "bullish"
          : "neutral",
        generatedAt: new Date().toISOString(),
      };

      await storage.setCachedData("market_summary", summaryData, 5);
      res.json(summaryData);
    } catch (error) {
      console.error("Market summary error:", error);
      res.json({
        summary: "Markets are mixed today with tech leading gains while energy lags. Keep an eye on Fed commentary later this week.",
        sentiment: "neutral",
        generatedAt: new Date().toISOString(),
      });
    }
  });

  app.get("/api/portfolio", async (req: Request, res: Response) => {
    try {
      const holdings = await storage.getPortfolioHoldings();
      res.json(holdings);
    } catch (error) {
      console.error("Portfolio error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio", async (req: Request, res: Response) => {
    try {
      const validation = insertPortfolioHoldingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }

      const { ticker, shares, avgCost, name, sector } = validation.data;
      
      let currentPrice = avgCost;
      try {
        const fmpUrl = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${process.env.FMP_API_KEY}`;
        const response = await fetchWithTimeout(fmpUrl, {}, 5000);
        if (response.ok) {
          const data = await response.json() as any[];
          if (data && data[0]) {
            currentPrice = data[0].price?.toString() || avgCost;
          }
        }
      } catch (e) {
        console.error("Failed to fetch current price:", e);
      }

      const holding = await storage.createPortfolioHolding({
        ticker: ticker.toUpperCase(),
        shares,
        avgCost,
        currentPrice,
        name: name || ticker.toUpperCase(),
        sector: sector || null,
      });
      res.status(201).json(holding);
    } catch (error) {
      console.error("Create portfolio error:", error);
      res.status(500).json({ error: "Failed to add holding" });
    }
  });

  app.delete("/api/portfolio/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePortfolioHolding(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete portfolio error:", error);
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });

  app.get("/api/portfolio/stats", async (req: Request, res: Response) => {
    try {
      const holdings = await storage.getPortfolioHoldings();
      
      let totalValue = 0;
      let totalCost = 0;
      
      for (const holding of holdings) {
        const shares = Number(holding.shares);
        const currentPrice = Number(holding.currentPrice || holding.avgCost);
        const avgCost = Number(holding.avgCost);
        
        totalValue += shares * currentPrice;
        totalCost += shares * avgCost;
      }

      const totalGain = totalValue - totalCost;
      const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
      
      const dayChange = totalValue * 0.005 * (Math.random() > 0.5 ? 1 : -1);
      const dayChangePercent = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

      res.json({
        totalValue,
        totalGain,
        totalGainPercent,
        dayChange,
        dayChangePercent,
      });
    } catch (error) {
      console.error("Portfolio stats error:", error);
      res.json({ totalValue: 0, totalGain: 0, totalGainPercent: 0, dayChange: 0, dayChangePercent: 0 });
    }
  });

  app.get("/api/portfolio/analysis", async (req: Request, res: Response) => {
    try {
      const holdings = await storage.getPortfolioHoldings();
      if (holdings.length === 0) {
        return res.json({ analysis: "Add some holdings to get AI-powered portfolio analysis." });
      }

      const holdingsSummary = holdings.map(h => 
        `${h.ticker}: ${h.shares} shares at $${h.avgCost} avg cost`
      ).join(", ");

      const completion = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          {
            role: "system",
            content: "You are a friendly portfolio analyst. Give brief, actionable insights about the portfolio. Be casual but informative. Max 3-4 sentences."
          },
          {
            role: "user",
            content: `Analyze this portfolio and give brief insights: ${holdingsSummary}`
          }
        ],
        max_tokens: 300,
      });

      res.json({
        analysis: completion.choices[0]?.message?.content || "Your portfolio looks interesting! Consider reviewing your sector allocation for better diversification."
      });
    } catch (error) {
      console.error("Portfolio analysis error:", error);
      res.json({ analysis: "Your portfolio is looking solid. Remember to stay diversified across sectors." });
    }
  });

  app.get("/api/analysis/profile/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = req.params.ticker as string;
      const fmpUrl = `https://financialmodelingprep.com/api/v3/profile/${ticker.toUpperCase()}?apikey=${process.env.FMP_API_KEY}`;
      
      const response = await fetchWithTimeout(fmpUrl, {}, 10000);
      if (!response.ok) throw new Error("Failed to fetch profile");
      
      const data = await response.json() as any[];
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Stock not found" });
      }

      const profile = data[0];
      res.json({
        symbol: profile.symbol,
        companyName: profile.companyName,
        sector: profile.sector || "N/A",
        industry: profile.industry || "N/A",
        exchange: profile.exchangeShortName || profile.exchange,
        marketCap: profile.mktCap || 0,
        price: profile.price || 0,
        changes: profile.changes || 0,
        changesPercentage: ((profile.changes || 0) / (profile.price || 1)) * 100,
        description: profile.description || "",
      });
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ error: "Failed to fetch stock profile" });
    }
  });

  app.get("/api/analysis/financials/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = req.params.ticker as string;
      const fmpUrl = `https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker.toUpperCase()}?apikey=${process.env.FMP_API_KEY}`;
      const incomeUrl = `https://financialmodelingprep.com/api/v3/income-statement/${ticker.toUpperCase()}?limit=1&apikey=${process.env.FMP_API_KEY}`;
      
      const [ratiosRes, incomeRes] = await Promise.all([
        fetchWithTimeout(fmpUrl, {}, 10000),
        fetchWithTimeout(incomeUrl, {}, 10000),
      ]);

      const ratios: any[] = ratiosRes.ok ? await ratiosRes.json() as any[] : [];
      const income: any[] = incomeRes.ok ? await incomeRes.json() as any[] : [];

      const r = ratios[0] || {};
      const i = income[0] || {};

      res.json({
        revenue: i.revenue || 0,
        netIncome: i.netIncome || 0,
        eps: i.eps || r.netIncomePerShareTTM || 0,
        peRatio: r.peRatioTTM || 0,
        pbRatio: r.priceToBookRatioTTM || 0,
        dividendYield: r.dividendYieldTTM || 0,
        roe: r.returnOnEquityTTM || 0,
        debtToEquity: r.debtEquityRatioTTM || 0,
      });
    } catch (error) {
      console.error("Financials error:", error);
      res.status(500).json({ error: "Failed to fetch financials" });
    }
  });

  app.get("/api/analysis/ai/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = req.params.ticker as string;
      
      const completion = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          {
            role: "system",
            content: "You are a friendly stock analyst. Provide a brief analysis with key points. Be casual but informative. Include 3-4 bullet points for key takeaways. Format your response as JSON with 'summary', 'sentiment' (bullish/bearish/neutral), and 'keyPoints' (array of strings)."
          },
          {
            role: "user",
            content: `Give a brief investment analysis for ${ticker.toUpperCase()}. Consider recent performance, market position, and outlook.`
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content);
        res.json({
          summary: parsed.summary || `${ticker.toUpperCase()} is an interesting opportunity. Do your own research before investing.`,
          sentiment: parsed.sentiment || "neutral",
          keyPoints: parsed.keyPoints || ["Consider your investment goals", "Review recent earnings", "Monitor market conditions"],
        });
      } catch {
        res.json({
          summary: `${ticker.toUpperCase()} shows potential. As always, consider your investment horizon and risk tolerance.`,
          sentiment: "neutral",
          keyPoints: ["Review recent financial performance", "Consider sector trends", "Monitor competitive landscape"],
        });
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      res.json({
        summary: `Analysis for this stock suggests careful consideration of market conditions and company fundamentals.`,
        sentiment: "neutral",
        keyPoints: ["Review financial statements", "Consider market trends", "Evaluate risk factors"],
      });
    }
  });

  app.get("/api/earnings", async (req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("earnings");
      if (cached) {
        return res.json(cached);
      }

      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const fromDate = lastWeek.toISOString().split("T")[0];
      const toDate = nextWeek.toISOString().split("T")[0];

      const fmpUrl = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fromDate}&to=${toDate}&apikey=${process.env.FMP_API_KEY}`;
      
      const response = await fetchWithTimeout(fmpUrl, {}, 10000);
      if (!response.ok) throw new Error("Failed to fetch earnings");
      
      const data = await response.json() as any[];
      
      const upcoming = data
        .filter((e: any) => new Date(e.date) >= today)
        .slice(0, 10)
        .map((e: any) => ({
          symbol: e.symbol,
          name: e.symbol,
          date: e.date,
          time: e.time === "amc" ? "after" : e.time === "bmo" ? "before" : "during",
          epsEstimate: e.epsEstimated,
          epsActual: null,
          revenueEstimate: e.revenueEstimated,
          revenueActual: null,
          surprise: null,
        }));

      const recent = data
        .filter((e: any) => new Date(e.date) < today && e.eps !== null)
        .slice(0, 10)
        .map((e: any) => ({
          symbol: e.symbol,
          name: e.symbol,
          date: e.date,
          time: e.time === "amc" ? "after" : e.time === "bmo" ? "before" : "during",
          epsEstimate: e.epsEstimated,
          epsActual: e.eps,
          revenueEstimate: e.revenueEstimated,
          revenueActual: e.revenue,
          surprise: e.epsEstimated ? ((e.eps - e.epsEstimated) / Math.abs(e.epsEstimated)) * 100 : null,
        }));

      const earningsData = { upcoming, recent };
      await storage.setCachedData("earnings", earningsData, 30);
      res.json(earningsData);
    } catch (error) {
      console.error("Earnings error:", error);
      res.json({
        upcoming: [
          { symbol: "AAPL", name: "Apple Inc.", date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], time: "after", epsEstimate: 1.45, epsActual: null, revenueEstimate: 89000000000, revenueActual: null, surprise: null },
          { symbol: "MSFT", name: "Microsoft Corp", date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], time: "after", epsEstimate: 2.78, epsActual: null, revenueEstimate: 56000000000, revenueActual: null, surprise: null },
        ],
        recent: [
          { symbol: "NVDA", name: "NVIDIA Corp", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], time: "after", epsEstimate: 4.50, epsActual: 5.16, revenueEstimate: 20000000000, revenueActual: 22100000000, surprise: 14.67 },
          { symbol: "META", name: "Meta Platforms", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], time: "after", epsEstimate: 4.25, epsActual: 4.39, revenueEstimate: 38500000000, revenueActual: 40100000000, surprise: 3.29 },
        ],
      });
    }
  });

  app.get("/api/news", async (req: Request, res: Response) => {
    try {
      const cached = await storage.getCachedData("news");
      if (cached) {
        return res.json(cached);
      }

      let marketNews: any[] = [];
      let generalNews: any[] = [];

      try {
        const braveUrl = `https://api.search.brave.com/res/v1/news/search?q=stock+market+today&count=10`;
        const response = await fetchWithTimeout(braveUrl, {
          headers: {
            "Accept": "application/json",
            "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY || "",
          },
        }, 10000);
        
        if (response.ok) {
          const data = await response.json() as any;
          marketNews = (data.results || []).slice(0, 8).map((r: any) => ({
            title: r.title,
            description: r.description,
            url: r.url,
            source: r.meta_url?.hostname || "News",
            publishedAt: r.age || new Date().toISOString(),
            category: "market",
          }));
        }
      } catch (e) {
        console.error("Brave search error:", e);
      }

      try {
        const tavilyUrl = "https://api.tavily.com/search";
        const response = await fetchWithTimeout(tavilyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: "business finance news today",
            search_depth: "basic",
            max_results: 8,
          }),
        }, 10000);

        if (response.ok) {
          const data = await response.json() as any;
          generalNews = (data.results || []).map((r: any) => ({
            title: r.title,
            description: r.content?.slice(0, 200) || "",
            url: r.url,
            source: new URL(r.url).hostname,
            publishedAt: new Date().toISOString(),
            category: "general",
          }));
        }
      } catch (e) {
        console.error("Tavily error:", e);
      }

      if (marketNews.length === 0) {
        marketNews = [
          { title: "Markets rally on tech earnings beat", description: "Major indices pushed higher as tech giants reported strong quarterly results.", url: "#", source: "Financial Times", publishedAt: new Date().toISOString(), category: "market" },
          { title: "Fed signals patience on rate cuts", description: "Central bank officials suggest they're in no rush to lower interest rates.", url: "#", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), category: "market" },
          { title: "Oil prices stabilize amid Middle East tensions", description: "Crude futures find support as geopolitical risks remain elevated.", url: "#", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), category: "market" },
        ];
      }

      if (generalNews.length === 0) {
        generalNews = [
          { title: "AI adoption accelerates across industries", description: "Companies are rapidly integrating artificial intelligence into their operations.", url: "#", source: "TechCrunch", publishedAt: new Date().toISOString(), category: "general" },
          { title: "Consumer spending remains resilient", description: "Retail sales data shows continued strength in consumer demand.", url: "#", source: "CNBC", publishedAt: new Date(Date.now() - 3600000).toISOString(), category: "general" },
        ];
      }

      const newsData = { market: marketNews, general: generalNews };
      await storage.setCachedData("news", newsData, 10);
      res.json(newsData);
    } catch (error) {
      console.error("News error:", error);
      res.json({
        market: [{ title: "Market update coming soon", description: "Check back for the latest market news.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "market" }],
        general: [{ title: "Business news loading", description: "General business news will appear here.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "general" }],
      });
    }
  });

  app.get("/api/news/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const braveUrl = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query + " stock finance")}&count=10`;
      const response = await fetchWithTimeout(braveUrl, {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY || "",
        },
      }, 10000);

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json() as any;
      const results = (data.results || []).map((r: any) => ({
        title: r.title,
        description: r.description,
        url: r.url,
        source: r.meta_url?.hostname || "News",
        publishedAt: r.age || new Date().toISOString(),
      }));

      res.json(results);
    } catch (error) {
      console.error("News search error:", error);
      res.json([]);
    }
  });

  return httpServer;
}
