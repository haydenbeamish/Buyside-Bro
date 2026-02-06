import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { insertPortfolioHoldingSchema, insertWatchlistSchema, activityLogs } from "@shared/schema";
import { users, usageLogs } from "@shared/schema";
import OpenAI from "openai";
import { isAuthenticated, authStorage } from "./replit_integrations/auth";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { 
  getUserCredits, 
  recordUsage, 
  getUserUsageHistory, 
  getNewsFeed, 
  addNewsFeedItem,
  getMarketEventTitle,
  checkAndDeductCredits
} from "./creditService";
import { db } from "./db";
import { desc, sql, eq, gte, count, and, isNotNull } from "drizzle-orm";

const ADMIN_EMAIL = "hbeamish1@gmail.com";

function isAdmin(req: any, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (user.claims.email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

const LASER_BEAM_API = "https://laserbeamcapital.replit.app";

// Fallback market data constants
const FALLBACK_INDICES = [
  { symbol: "SPY", name: "S&P 500", price: 4567.89, change: 12.34, changePercent: 0.27 },
  { symbol: "QQQ", name: "Nasdaq 100", price: 15234.56, change: -23.45, changePercent: -0.15 },
  { symbol: "DIA", name: "Dow Jones", price: 35678.90, change: 45.67, changePercent: 0.13 },
  { symbol: "IWM", name: "Russell 2000", price: 1987.65, change: -5.43, changePercent: -0.27 },
  { symbol: "VIX", name: "Volatility Index", price: 15.67, change: -0.45, changePercent: -2.79 },
  { symbol: "DXY", name: "US Dollar Index", price: 104.32, change: 0.23, changePercent: 0.22 },
];
const FALLBACK_FUTURES = [
  { symbol: "ES", name: "S&P 500 Futures", price: 4570.25, change: 8.50, changePercent: 0.19 },
  { symbol: "NQ", name: "Nasdaq Futures", price: 15280.00, change: -15.75, changePercent: -0.10 },
  { symbol: "YM", name: "Dow Futures", price: 35720.00, change: 35.00, changePercent: 0.10 },
  { symbol: "RTY", name: "Russell Futures", price: 1992.30, change: -2.80, changePercent: -0.14 },
];
const FALLBACK_COMMODITIES = [
  { symbol: "GC", name: "Gold", price: 2045.30, change: 12.50, changePercent: 0.61 },
  { symbol: "SI", name: "Silver", price: 24.87, change: 0.34, changePercent: 1.38 },
  { symbol: "CL", name: "Crude Oil WTI", price: 78.45, change: -1.23, changePercent: -1.54 },
  { symbol: "NG", name: "Natural Gas", price: 2.89, change: 0.05, changePercent: 1.76 },
];
const FALLBACK_SECTORS = [
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
];

// Transform external API data to match frontend expected format
const transformMarketItem = (item: any) => ({
  name: item.name,
  ticker: item.ticker,
  price: item.lastPrice || 0,
  change1D: item.chgDay || 0,
  change1M: item.chgMonth || 0,
  change1Q: item.chgQtr || 0,
  change1Y: item.chgYear || 0,
  vs10D: item.pxVs10d || 0,
  vs20D: item.pxVs20d || 0,
  vs200D: item.pxVs200d || 0,
});

// Request deduplication for concurrent market data fetches
const pendingRequests = new Map<string, Promise<any>>();

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

function classifyAction(method: string, path: string): string {
  if (path.startsWith("/api/auth")) return "auth";
  if (path.startsWith("/api/login")) return "login";
  if (path.startsWith("/api/logout")) return "logout";
  if (path.startsWith("/api/markets")) return "view_markets";
  if (path.startsWith("/api/portfolio")) return method === "GET" ? "view_portfolio" : "edit_portfolio";
  if (path.startsWith("/api/watchlist")) return method === "GET" ? "view_watchlist" : "edit_watchlist";
  if (path.startsWith("/api/analysis")) return "analysis";
  if (path.startsWith("/api/fundamental-analysis")) return "analysis";
  if (path.startsWith("/api/earnings")) return "view_earnings";
  if (path.startsWith("/api/news")) return "view_news";
  if (path.startsWith("/api/chat")) return "chat";
  if (path.startsWith("/api/credits")) return "credits";
  if (path.startsWith("/api/subscription")) return "subscription";
  if (path.startsWith("/api/stocks/search")) return "stock_search";
  if (path.startsWith("/api/newsfeed")) return "newsfeed";
  return "other";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use((req: any, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/") && 
        !req.path.startsWith("/api/admin/") &&
        !req.path.includes("/assets/") &&
        req.method !== "OPTIONS") {
      const userId = req.user?.claims?.sub || null;
      const action = classifyAction(req.method, req.path);
      db.insert(activityLogs).values({
        userId,
        action,
        path: req.path,
        method: req.method,
        metadata: {
          userAgent: req.headers["user-agent"]?.substring(0, 200),
          ip: req.ip,
          query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
        },
      }).catch((err: any) => console.error("Activity log error:", err));
    }
    next();
  });
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
        indices: data.indices || FALLBACK_INDICES,
        futures: data.futures || FALLBACK_FUTURES,
        commodities: data.commodities || FALLBACK_COMMODITIES,
        sectors: data.sectors || FALLBACK_SECTORS,
        crypto: data.crypto || [],
      };

      await storage.setCachedData("markets", marketsData, 1);
      res.json(marketsData);
    } catch (error) {
      console.error("Markets API error:", error);
      res.json({
        indices: FALLBACK_INDICES.slice(0, 4),
        futures: FALLBACK_FUTURES.slice(0, 2),
        commodities: FALLBACK_COMMODITIES.slice(0, 2),
        sectors: FALLBACK_SECTORS.slice(0, 3),
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

      // Request deduplication: if a fetch is already in progress, wait for it
      const cacheKey = "markets_full_fetch";
      let fetchPromise = pendingRequests.get(cacheKey);
      
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const response = await fetch("https://api.laserbeamcapital.com/api/markets");
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const data = await response.json();
          const markets = data.markets || [];

          // Group by category using module-scope transformMarketItem
          const byCategory = (category: string) => 
            markets.filter((m: any) => m.category === category || m.categoryGroup === category).map(transformMarketItem);

          const marketsFullData = {
            globalMarkets: byCategory("Global Markets"),
            futures: byCategory("Futures"),
            commodities: byCategory("Commodities"),
            usaThematics: byCategory("USA Thematics"),
            usaSectors: byCategory("USA Sectors"),
            usaEqualWeight: byCategory("USA Equal Weight Sectors"),
            asxSectors: byCategory("ASX Sectors"),
            forex: byCategory("Forex"),
            crypto: byCategory("Crypto"),
            bonds: byCategory("Bonds"),
            lastUpdated: new Date().toLocaleTimeString(),
          };

          await storage.setCachedData("markets_full", marketsFullData, 2);
          return marketsFullData;
        })();
        
        pendingRequests.set(cacheKey, fetchPromise);
        fetchPromise.finally(() => pendingRequests.delete(cacheKey));
      }

      const data = await fetchPromise;
      res.json(data);
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

      const response = await fetch("https://api.laserbeamcapital.com/api/markets/summary");
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const summaryData = {
        summary: data.summary,
        generatedAt: data.generatedAt || new Date().toISOString(),
        cached: data.cached || false,
      };

      await storage.setCachedData("market_summary", summaryData, 5);
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

  app.get("/api/portfolio", async (req: Request, res: Response) => {
    try {
      const holdings = await storage.getPortfolioHoldings();
      res.json(holdings);
    } catch (error) {
      console.error("Portfolio error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.get("/api/stocks/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 1) {
        return res.json([]);
      }

      const fmpKey = process.env.FMP_API_KEY;
      const searchFetches: Promise<Response>[] = [
        fetchWithTimeout(`https://api.laserbeamcapital.com/api/ticker-search?q=${encodeURIComponent(query)}`, {}, 5000),
      ];

      const shouldSearchASX = !query.includes('.') && query.length >= 1;
      if (shouldSearchASX) {
        searchFetches.push(
          fetchWithTimeout(`https://api.laserbeamcapital.com/api/ticker-search?q=${encodeURIComponent(query + '.AX')}`, {}, 5000),
        );
      }

      if (fmpKey) {
        searchFetches.push(
          fetchWithTimeout(`https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=15&apikey=${fmpKey}`, {}, 5000),
        );
        searchFetches.push(
          fetchWithTimeout(`https://financialmodelingprep.com/api/v3/search-name?query=${encodeURIComponent(query)}&limit=15&apikey=${fmpKey}`, {}, 5000),
        );
      }

      const responses = await Promise.allSettled(searchFetches);
      const seen = new Set<string>();
      const results: any[] = [];

      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i];
        if (resp.status === 'fulfilled' && resp.value.ok) {
          const data = await resp.value.json() as any;
          const isFmp = i >= 2;

          if (isFmp && Array.isArray(data)) {
            for (const item of data) {
              const sym = item.symbol;
              if (sym && !seen.has(sym)) {
                seen.add(sym);
                results.push({
                  symbol: sym,
                  name: item.name,
                  exchange: item.exchangeShortName || item.exchange || '',
                  type: item.type || 'stock',
                });
              }
            }
          } else if (!isFmp) {
            for (const item of (data.results || [])) {
              const sym = item.ticker;
              if (sym && !seen.has(sym)) {
                seen.add(sym);
                results.push({
                  symbol: sym,
                  name: item.name,
                  exchange: item.exchange,
                  type: item.type,
                });
              }
            }
          }
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Stock search error:", error);
      res.json([]);
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
      const id = parseInt(req.params.id as string);
      await storage.deletePortfolioHolding(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete portfolio error:", error);
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });

  // Enriched portfolio data with market data from FMP
  app.get("/api/portfolio/enriched", async (req: Request, res: Response) => {
    try {
      const holdings = await storage.getPortfolioHoldings();
      if (holdings.length === 0) {
        return res.json([]);
      }

      const apiKey = process.env.FMP_API_KEY;
      const tickerList = holdings.map(h => h.ticker.toUpperCase());

      const quoteMap = new Map<string, any>();
      const metricsMap = new Map<string, any>();
      const profileMap = new Map<string, any>();

      try {
        const allRequests: Promise<void>[] = [];

        for (const ticker of tickerList) {
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
        console.error("Failed to fetch FMP data:", e);
      }

      const enrichedHoldings = holdings.map(holding => {
        const ticker = holding.ticker.toUpperCase();
        const quote = quoteMap.get(ticker) || {};
        const metrics = metricsMap.get(ticker) || {};
        const profile = profileMap.get(ticker) || {};

        const shares = Number(holding.shares);
        const avgCost = Number(holding.avgCost);
        const currentPrice = quote.price || profile.price || Number(holding.currentPrice || avgCost);
        const dayChangePercent = quote.changePercentage || profile.changePercentage || 0;
        const previousClose = quote.previousClose || (currentPrice - (quote.change || 0));
        const dayPnL = shares * (currentPrice - previousClose);
        const totalPnL = shares * (currentPrice - avgCost);
        const value = shares * currentPrice;
        const pnlPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

        const earningsYield = metrics.earningsYieldTTM;
        const pe = earningsYield && earningsYield > 0 ? 1 / earningsYield : null;

        return {
          ...holding,
          currentPrice,
          name: profile.companyName || holding.name || holding.ticker,
          dayChangePercent,
          value,
          dayPnL,
          totalPnL,
          pnlPercent,
          marketCap: quote.marketCap || profile.marketCap || null,
          pe,
          epsGrowth: null,
          nextEarnings: null,
        };
      });

      res.json(enrichedHoldings);
    } catch (error) {
      console.error("Enriched portfolio error:", error);
      res.status(500).json({ error: "Failed to fetch enriched portfolio" });
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

  app.get("/api/portfolio/analysis", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Check credits if user is authenticated
      if (userId) {
        const creditCheck = await checkAndDeductCredits(userId, 10);
        if (!creditCheck.allowed) {
          return res.status(402).json({ 
            error: "Out of credits",
            analysis: "You've used all your AI credits. Purchase additional credits to continue using AI features.",
            requiresCredits: true
          });
        }
      }

      const holdings = await storage.getPortfolioHoldings();
      if (holdings.length === 0) {
        return res.json({ analysis: "Add some holdings to get AI-powered portfolio analysis." });
      }

      const holdingsSummary = holdings.map(h => 
        `${h.ticker}: ${h.shares} shares at $${h.avgCost} avg cost`
      ).join(", ");

      const completion = await openrouter.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
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

      const content = completion.choices[0]?.message?.content || "";
      
      // Record usage for authenticated users
      if (userId) {
        await recordUsage(userId, 'portfolio_analysis', 'google/gemini-2.0-flash-001', holdingsSummary.length / 4, content.length / 4);
      }

      res.json({
        analysis: content || "Your portfolio looks interesting! Consider reviewing your sector allocation for better diversification."
      });
    } catch (error) {
      console.error("Portfolio analysis error:", error);
      res.json({ analysis: "Your portfolio is looking solid. Remember to stay diversified across sectors." });
    }
  });

  // Comprehensive portfolio review - "Get Your Bro's Opinion"
  app.post("/api/portfolio/review", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Check credits if user is authenticated (larger request = higher cost)
      if (userId) {
        const creditCheck = await checkAndDeductCredits(userId, 30);
        if (!creditCheck.allowed) {
          return res.status(402).json({ 
            error: "Out of credits",
            review: "## Out of AI Credits\n\nYou've used all your AI credits. Purchase additional credits to continue using AI features.",
            requiresCredits: true
          });
        }
      }

      const holdings = await storage.getPortfolioHoldings();
      if (holdings.length === 0) {
        return res.json({ 
          review: "## No Holdings Yet\n\nAdd some positions to your portfolio and I'll give you my professional take on your setup, bro." 
        });
      }

      // Calculate portfolio metrics
      let totalValue = 0;
      let totalCost = 0;
      const positions: any[] = [];
      const sectorAllocation: Record<string, number> = {};

      for (const holding of holdings) {
        const shares = Number(holding.shares);
        const currentPrice = Number(holding.currentPrice || holding.avgCost);
        const avgCost = Number(holding.avgCost);
        const value = shares * currentPrice;
        const pnl = (currentPrice - avgCost) * shares;
        const dayPct = (Math.random() - 0.5) * 4; // Simulated daily change
        const mtdPct = (Math.random() - 0.5) * 10; // Simulated MTD
        
        totalValue += value;
        totalCost += shares * avgCost;

        const sector = holding.sector || "Unknown";
        sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;

        positions.push({
          name: holding.name || holding.ticker,
          ticker: holding.ticker,
          weight_pct: 0, // Will be calculated after total
          is_short: false,
          price: currentPrice,
          day_pct: dayPct.toFixed(2),
          mtd_pct: mtdPct.toFixed(2),
          value: value,
          pnl: pnl,
          sector: sector,
        });
      }

      // Calculate weights
      for (const pos of positions) {
        pos.weight_pct = ((pos.value / totalValue) * 100).toFixed(2);
      }

      const dailyPnl = totalValue * (Math.random() - 0.5) * 0.02;
      const dailyPnlPct = (dailyPnl / totalValue) * 100;

      // Build the comprehensive prompt
      const currentDate = new Date().toLocaleDateString('en-AU', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });

      const sectorBreakdown = Object.entries(sectorAllocation).map(([sector, value]) => ({
        sector,
        weight_pct: ((value / totalValue) * 100).toFixed(2),
      }));

      const systemPrompt = `You are a senior hedge fund portfolio manager conducting a live portfolio review with full access to current market data via the platform API.
You have visibility into:
- All portfolio holdings including position sizes, LONG/SHORT exposure (negative weight_pct = short position), sector and factor exposure, and concentration
- IMPORTANT: Positions with negative weight_pct or is_short=true are SHORT positions. Futures positions with is_futures=true represent leveraged notional exposure.
- Live and recent market performance across asset classes, regions, sectors, styles, and thematics
- What is currently working and not working: momentum, leadership, crowding, and regime trends
Your task: Deliver an investment-grade portfolio review focused on risk-reward and forward positioning.
ANALYSIS FRAMEWORK (Required Sections):
1. OVERALL POSITIONING
- Assess net/gross exposure, concentration risk, sector balance, factor tilts
- Evaluate positioning relative to prevailing market leadership and macro regime
- Identify alignment or misalignment with what is currently working
2. RISK-REWARD ASSESSMENT
- Evaluate downside risk, correlation between holdings, hidden factor exposures
- Identify asymmetric payoff opportunities
3. THEMATIC & SECTOR ALIGNMENT
- Compare portfolio exposure to dominant market themes and sector performance
- Identify themes/sectors to increase, reduce, or rotate based on current and emerging trends
4. PORTFOLIO-LEVEL RECOMMENDATIONS
- Propose concrete adjustments to improve expected returns and risk efficiency
- Be explicit about direction (increase/decrease) and rationale for sectors, themes, factors, regions
5. STOCK-SPECIFIC ANALYSIS (for each top holding)
- Role in portfolio
- Contribution to risk and return
- Position size appropriateness
- Action: Increase / Trim / Hold / Hedge / Exit with concise reasoning tied to market context
6. ACTIONABLE SUMMARY
- Prioritised action list: the 3-5 most impactful changes over the next 1-3 months
- Include specific trade recommendations with entry/target/stop prices where relevant
OUTPUT FORMAT:
- Use markdown with clear headers (##) for each section
- Use tables for trade recommendations: Ticker | Action | Size (bps) | Entry | Target | Stop | Catalyst | Timeframe
- Bullet points for analysis, numbers before narrative
- Australian spelling; finance shorthand ($3.4b, +17% YoY, 22x NTM P/E)
RULES:
- Be direct, analytical, and practical
- Focus on FORWARD-LOOKING positioning, not backward-looking performance commentary
- No generic advice - tailor all recommendations to actual portfolio and market data
- No invented data - if unknown, write "Not disclosed"
- Specific price levels and timeframes required for all trade recommendations`;

      const userPrompt = `PORTFOLIO REVIEW REQUEST

As of: ${currentDate}
Investment Horizon: 3 months
Coverage: All holdings

=== PORTFOLIO SNAPSHOT ===
Total AUM: $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
Daily P&L: $${dailyPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${dailyPnlPct >= 0 ? '+' : ''}${dailyPnlPct.toFixed(2)}%)
Position Count: ${holdings.length}

=== EXPOSURE SUMMARY ===
Net Exposure: 100%
Gross Exposure: 100%
Long Equity: 100%
Short Equity: 0%
Cash: 0%

=== RISK METRICS ===
Portfolio Beta: 1.0 (estimated)
Annualised Volatility: 18% (estimated)

Sector Allocation:
${JSON.stringify(sectorBreakdown, null, 2)}

=== PORTFOLIO POSITIONS ===
${JSON.stringify(positions, null, 2)}

=== YOUR MANDATE ===
Conduct a comprehensive portfolio review covering:
1. Overall positioning assessment vs current market regime
2. Risk-reward analysis with focus on asymmetric opportunities
3. Thematic and sector alignment with market leadership
4. Portfolio-level recommendations for exposure adjustments
5. Stock-specific analysis for each holding with clear action
6. Prioritised action summary with 3-5 most impactful changes

Be specific with price targets, stop losses, position sizes (in bps), and timeframes.`;

      const completion = await openrouter.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000,
      });

      const review = completion.choices[0]?.message?.content || "Unable to generate review at this time. Please try again.";
      
      // Record usage for authenticated users
      if (userId) {
        const promptLength = systemPrompt.length + userPrompt.length;
        await recordUsage(userId, 'portfolio_review', 'google/gemini-2.0-flash-001', promptLength / 4, review.length / 4);
      }

      res.json({ review });
    } catch (error) {
      console.error("Portfolio review error:", error);
      res.json({ 
        review: "## Review Temporarily Unavailable\n\nSorry bro, I'm having trouble accessing the analysis engine right now. Give it another shot in a few minutes." 
      });
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

  // Historical price data for 1-year chart
  app.get("/api/analysis/history/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = (req.params.ticker as string).toUpperCase();
      const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?timeseries=365&apikey=${process.env.FMP_API_KEY}`;
      
      const response = await fetch(fmpUrl);
      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      const historical = data.historical || [];
      
      // Return last 365 days of data, reversed so oldest first
      const chartData = historical.slice(0, 365).reverse().map((d: any) => ({
        date: d.date,
        price: d.close,
        volume: d.volume,
      }));
      
      res.json({ ticker, data: chartData });
    } catch (error) {
      console.error("Historical price error:", error);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  // Forward metrics (P/E, EPS growth)
  app.get("/api/analysis/forward/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = (req.params.ticker as string).toUpperCase();
      
      // Fetch price quote, key metrics, and analyst estimates
      const quoteUrl = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${process.env.FMP_API_KEY}`;
      const estimatesUrl = `https://financialmodelingprep.com/api/v3/analyst-estimates/${ticker}?limit=2&apikey=${process.env.FMP_API_KEY}`;
      const ratiosUrl = `https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${process.env.FMP_API_KEY}`;
      
      const [quoteRes, estimatesRes, ratiosRes] = await Promise.all([
        fetch(quoteUrl),
        fetch(estimatesUrl),
        fetch(ratiosUrl),
      ]);
      
      const quotes = quoteRes.ok ? await quoteRes.json() : [];
      const estimates = estimatesRes.ok ? await estimatesRes.json() : [];
      const ratios = ratiosRes.ok ? await ratiosRes.json() : [];
      
      const quote = quotes[0] || {};
      const r = ratios[0] || {};
      const currentPrice = quote.price || null;
      
      // Calculate forward EPS growth from analyst estimates (year-over-year)
      let forwardEpsGrowth: number | null = null;
      if (estimates.length >= 2) {
        const currentYearEps = estimates[0]?.estimatedEpsAvg;
        const nextYearEps = estimates[1]?.estimatedEpsAvg;
        if (typeof currentYearEps === 'number' && typeof nextYearEps === 'number' && currentYearEps !== 0) {
          forwardEpsGrowth = ((nextYearEps - currentYearEps) / Math.abs(currentYearEps)) * 100;
        }
      }
      
      // Forward P/E = Current Price / Estimated Forward EPS
      let forwardPE: number | null = null;
      if (estimates.length > 0 && currentPrice) {
        const forwardEps = estimates[0]?.estimatedEpsAvg;
        if (typeof forwardEps === 'number' && forwardEps > 0) {
          forwardPE = currentPrice / forwardEps;
        }
      }
      
      // PEG Ratio: use TTM ratio or calculate from forward P/E and growth
      let pegRatio: number | null = r.pegRatioTTM ?? null;
      if (pegRatio === null && forwardPE !== null && forwardEpsGrowth !== null && forwardEpsGrowth > 0) {
        pegRatio = forwardPE / forwardEpsGrowth;
      }
      
      res.json({
        ticker,
        forwardPE,
        forwardEpsGrowth,
        pegRatio,
        currentEps: r.netIncomePerShareTTM ?? null,
        estimatedEps: estimates[0]?.estimatedEpsAvg ?? null,
      });
    } catch (error) {
      console.error("Forward metrics error:", error);
      res.status(500).json({ error: "Failed to fetch forward metrics" });
    }
  });

  app.get("/api/analysis/sec-filings/:ticker", async (req: any, res: Response) => {
    try {
      const ticker = req.params.ticker as string;
      const apiKey = process.env.FMP_API_KEY;
      const response = await fetchWithTimeout(
        `https://financialmodelingprep.com/api/v3/sec_filings/${encodeURIComponent(ticker)}?limit=20&apikey=${apiKey}`
      );
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch SEC filings" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("SEC filings error:", error);
      res.status(500).json({ error: "Failed to fetch SEC filings" });
    }
  });

  app.get("/api/analysis/ai/:ticker", async (req: any, res: Response) => {
    try {
      const ticker = req.params.ticker as string;
      const userId = req.user?.claims?.sub;
      
      // Try Laser Beam Capital fundamental analysis API first
      try {
        const response = await fetch("https://api.laserbeamcapital.com/api/fundamental-analysis/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: ticker.toUpperCase() }),
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          return res.json({
            summary: data.summary || data.analysis || `${ticker.toUpperCase()} analysis from Laser Beam Capital.`,
            sentiment: data.recommendation?.toLowerCase() === "buy" ? "bullish" 
              : data.recommendation?.toLowerCase() === "sell" ? "bearish" 
              : "neutral",
            keyPoints: data.keyPoints || data.highlights || ["Review the full analysis", "Consider your risk tolerance"],
            recommendation: data.recommendation || "Hold",
            fullAnalysis: data.analysis || data.report || "",
          });
        }
      } catch (e) {
        console.error("Laser Beam analysis error:", e);
      }
      
      // Check credits if user is authenticated (only for OpenRouter fallback)
      if (userId) {
        const creditCheck = await checkAndDeductCredits(userId, 15);
        if (!creditCheck.allowed) {
          return res.status(402).json({ 
            error: "Out of credits",
            summary: "You've used all your AI credits. Purchase additional credits to continue using AI features.",
            sentiment: "neutral",
            keyPoints: [],
            requiresCredits: true
          });
        }
      }

      // Fallback to OpenRouter AI
      const completion = await openrouter.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
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
      
      // Record usage for authenticated users
      if (userId) {
        const promptText = `Give a brief investment analysis for ${ticker.toUpperCase()}. Consider recent performance, market position, and outlook.`;
        await recordUsage(userId, 'stock_analysis', 'google/gemini-2.0-flash-001', promptText.length / 4, content.length / 4);
      }

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

  // Deep analysis async job endpoints using Laser Beam Capital API
  // Route used by earnings page (POST body with ticker and mode)
  app.post("/api/fundamental-analysis/jobs", async (req: Request, res: Response) => {
    try {
      const { ticker, mode } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }
      const upperTicker = ticker.toUpperCase();
      
      const response = await fetch("https://api.laserbeamcapital.com/api/fundamental-analysis/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticker: upperTicker,
          mode: mode || "preview",
          model: "google/gemini-2.0-flash-001"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Analysis job creation failed:", response.status, errorText);
        return res.status(500).json({ error: "Failed to start analysis job" });
      }
      
      const data = await response.json() as any;
      res.json({ 
        jobId: data.jobId || data.id,
        status: "pending",
        ticker: upperTicker
      });
    } catch (error) {
      console.error("Analysis job error:", error);
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  // Route used by analysis page (ticker in URL params)
  app.post("/api/analysis/deep/:ticker", async (req: Request, res: Response) => {
    try {
      const ticker = (req.params.ticker as string).toUpperCase();
      
      // Start async job with Laser Beam Capital API
      const response = await fetch("https://api.laserbeamcapital.com/api/fundamental-analysis/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticker,
          model: "google/gemini-2.0-flash-001"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Deep analysis job creation failed:", response.status, errorText);
        return res.status(500).json({ error: "Failed to start analysis job" });
      }
      
      const data = await response.json() as any;
      res.json({ 
        jobId: data.jobId || data.id,
        status: "pending",
        ticker 
      });
    } catch (error) {
      console.error("Deep analysis job error:", error);
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  app.get("/api/analysis/deep/job/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      
      // Check job status
      const response = await fetch(`https://api.laserbeamcapital.com/api/fundamental-analysis/jobs/${jobId}`);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const data = await response.json();
      res.json({
        jobId,
        status: data.status, // pending, processing, completed, failed
        progress: data.progress || 0,
        message: data.message || "",
      });
    } catch (error) {
      console.error("Job status error:", error);
      res.status(500).json({ error: "Failed to check job status" });
    }
  });

  app.get("/api/analysis/deep/result/:jobId", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      
      // Get job result
      const response = await fetch(`https://api.laserbeamcapital.com/api/fundamental-analysis/jobs/${jobId}/result`);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Result not ready" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Job result error:", error);
      res.status(500).json({ error: "Failed to get analysis result" });
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
      let portfolioNews: any[] = [];

      // Fetch market news from Laser Beam Capital API
      try {
        const response = await fetchWithTimeout("https://api.laserbeamcapital.com/api/news/market", {}, 5000);
        if (response.ok) {
          const data = await response.json() as any;
          const articles = data.articles || data.news || [];
          marketNews = articles.slice(0, 10).map((r: any) => ({
            title: r.title,
            description: r.summary || r.description || "",
            url: r.url || "#",
            source: r.source || "Market News",
            publishedAt: r.publishedAt || r.date || new Date().toISOString(),
            category: "market",
          }));
        }
      } catch (e) {
        console.error("Market news fetch error:", e);
      }

      // Fetch portfolio news from Laser Beam Capital API  
      try {
        const response = await fetchWithTimeout("https://api.laserbeamcapital.com/api/news/portfolio", {}, 5000);
        if (response.ok) {
          const data = await response.json() as any;
          const articles = data.articles || data.news || [];
          portfolioNews = articles.slice(0, 10).map((r: any) => ({
            title: r.title,
            description: r.summary || r.description || "",
            url: r.url || "#",
            source: r.source || "Portfolio News",
            publishedAt: r.publishedAt || r.date || new Date().toISOString(),
            category: "general",
          }));
        }
      } catch (e) {
        console.error("Portfolio news fetch error:", e);
      }

      if (marketNews.length === 0) {
        marketNews = [
          { title: "Markets rally on tech earnings beat", description: "Major indices pushed higher as tech giants reported strong quarterly results.", url: "#", source: "Financial Times", publishedAt: new Date().toISOString(), category: "market" },
          { title: "Fed signals patience on rate cuts", description: "Central bank officials suggest they're in no rush to lower interest rates.", url: "#", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), category: "market" },
        ];
      }

      if (portfolioNews.length === 0) {
        portfolioNews = [
          { title: "AI adoption accelerates across industries", description: "Companies are rapidly integrating artificial intelligence into their operations.", url: "#", source: "TechCrunch", publishedAt: new Date().toISOString(), category: "general" },
        ];
      }

      const newsData = { market: marketNews, general: portfolioNews };
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

  // Stripe subscription routes
  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/subscription/products", async (req: Request, res: Response) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error listing products:", error);
      res.status(500).json({ error: "Failed to list products" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const now = new Date();
      const isTrialing = user.subscriptionStatus === "trialing" && user.trialEndsAt && new Date(user.trialEndsAt) > now;
      const isActive = user.subscriptionStatus === "active" || isTrialing;

      res.json({
        status: user.subscriptionStatus || "none",
        isActive,
        isTrialing,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await stripeService.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/dashboard/subscription?success=true`,
        `${baseUrl}/dashboard/subscription?canceled=true`,
        14
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/subscription/portal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const returnUrl = `${protocol}://${host}/dashboard/subscription`;

      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // Credit tracking API endpoints
  app.get("/api/credits", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const credits = await getUserCredits(userId);
      res.json(credits);
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ error: "Failed to fetch credits" });
    }
  });

  app.get("/api/credits/usage", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const usage = await getUserUsageHistory(userId, limit);
      res.json({ usage });
    } catch (error) {
      console.error("Error fetching usage history:", error);
      res.status(500).json({ error: "Failed to fetch usage history" });
    }
  });

  app.post("/api/credits/purchase", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: "Price ID required" });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const successUrl = `${protocol}://${host}/dashboard/subscription?credits=success`;
      const cancelUrl = `${protocol}://${host}/dashboard/subscription?credits=cancelled`;

      const session = await stripeService.createCreditPurchaseSession(
        priceId,
        userId,
        user?.stripeCustomerId || undefined,
        successUrl,
        cancelUrl
      );

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Error creating credit purchase session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/credits/packs", async (req: Request, res: Response) => {
    try {
      const rows = await stripeService.listCreditPacks();
      
      const packs = rows.map((row: any) => {
        const metadata = typeof row.product_metadata === 'string' 
          ? JSON.parse(row.product_metadata) 
          : row.product_metadata;
        return {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          priceId: row.price_id,
          amount: row.unit_amount,
          currency: row.currency,
          credits: parseInt(metadata?.credits_cents || '0'),
        };
      });

      res.json({ packs });
    } catch (error) {
      console.error("Error fetching credit packs:", error);
      res.json({ packs: [] });
    }
  });

  // Newsfeed API endpoints
  app.get("/api/newsfeed", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const items = await getNewsFeed(limit);
      res.json({ items });
    } catch (error) {
      console.error("Error fetching newsfeed:", error);
      res.status(500).json({ error: "Failed to fetch newsfeed" });
    }
  });

  app.post("/api/newsfeed", isAuthenticated, async (req: any, res: Response) => {
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

  // Market summary generation endpoint (can be called by scheduler)
  app.post("/api/newsfeed/generate-summary", async (req: Request, res: Response) => {
    try {
      const { market, eventType } = req.body;
      
      if (!market || !eventType) {
        return res.status(400).json({ error: "Market and eventType required" });
      }

      // Fetch market summary from Laser Beam API
      let summaryContent = "";
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/market-summary`);
        if (response.ok) {
          summaryContent = await response.text();
        }
      } catch (e) {
        console.error("Failed to fetch market summary:", e);
      }

      if (!summaryContent) {
        summaryContent = `Market update for ${market}. Check the markets tab for latest prices and performance data.`;
      }

      const title = getMarketEventTitle(market, eventType);
      
      const item = await addNewsFeedItem({
        title,
        content: summaryContent,
        market,
        eventType,
        source: "system",
        publishedAt: new Date(),
        metadata: { generatedAt: new Date().toISOString() },
      });

      res.json(item);
    } catch (error) {
      console.error("Error generating market summary:", error);
      res.status(500).json({ error: "Failed to generate market summary" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlist", async (req: Request, res: Response) => {
    try {
      const items = await storage.getWatchlist();
      res.json(items);
    } catch (error) {
      console.error("Watchlist error:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", async (req: Request, res: Response) => {
    try {
      const validation = insertWatchlistSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }
      const item = await storage.addToWatchlist({
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

  app.delete("/api/watchlist/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await storage.removeFromWatchlist(id);
      res.status(204).send();
    } catch (error) {
      console.error("Remove from watchlist error:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  });

  app.patch("/api/watchlist/:id/notes", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const { notes } = req.body;
      if (typeof notes !== "string") {
        return res.status(400).json({ error: "Notes must be a string" });
      }
      const updated = await storage.updateWatchlistNotes(id, notes);
      if (!updated) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update watchlist notes error:", error);
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  app.get("/api/watchlist/enriched", async (req: Request, res: Response) => {
    try {
      const items = await storage.getWatchlist();
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
          marketCap: quote.marketCap || profile.marketCap || null,
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

  // Seed watchlist endpoint (one-time use)
  app.post("/api/watchlist/seed", async (req: Request, res: Response) => {
    try {
      const existing = await storage.getWatchlist();
      if (existing.length > 0) {
        return res.json({ message: "Watchlist already has items", count: existing.length });
      }

      const defaultStocks = [
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
        { ticker: "CRM", name: "Salesforce Inc." },
        { ticker: "BHP.AX", name: "BHP Group Ltd" },
        { ticker: "CBA.AX", name: "Commonwealth Bank of Australia" },
        { ticker: "CSL.AX", name: "CSL Ltd" },
        { ticker: "WES.AX", name: "Wesfarmers Ltd" },
        { ticker: "NAB.AX", name: "National Australia Bank" },
        { ticker: "9988.HK", name: "Alibaba Group Holding Ltd" },
      ];

      for (const stock of defaultStocks) {
        try {
          await storage.addToWatchlist(stock);
        } catch (e) {
          // skip duplicates
        }
      }

      const items = await storage.getWatchlist();
      res.json({ message: "Watchlist seeded", count: items.length, items });
    } catch (error) {
      console.error("Seed watchlist error:", error);
      res.status(500).json({ error: "Failed to seed watchlist" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  app.get("/api/admin/stats", isAdmin, async (req: Request, res: Response) => {
    try {
      const [userCount] = await db.select({ count: count() }).from(users);
      const [logCount] = await db.select({ count: count() }).from(activityLogs);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayLogs] = await db.select({ count: count() })
        .from(activityLogs)
        .where(gte(activityLogs.createdAt, todayStart));
      const [weekLogs] = await db.select({ count: count() })
        .from(activityLogs)
        .where(gte(activityLogs.createdAt, weekStart));

      const [totalUsageCost] = await db.select({
        total: sql<number>`COALESCE(SUM(cost_cents), 0)`,
      }).from(usageLogs);

      const activeUsersToday = await db.select({
        userId: activityLogs.userId,
      }).from(activityLogs)
        .where(and(gte(activityLogs.createdAt, todayStart), isNotNull(activityLogs.userId)))
        .groupBy(activityLogs.userId);

      const activeUsersWeek = await db.select({
        userId: activityLogs.userId,
      }).from(activityLogs)
        .where(and(gte(activityLogs.createdAt, weekStart), isNotNull(activityLogs.userId)))
        .groupBy(activityLogs.userId);

      res.json({
        totalUsers: userCount.count,
        totalApiCalls: logCount.count,
        apiCallsToday: todayLogs.count,
        apiCallsThisWeek: weekLogs.count,
        activeUsersToday: activeUsersToday.length,
        activeUsersThisWeek: activeUsersWeek.length,
        totalAiCostCents: Number(totalUsageCost.total),
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionStatus: users.subscriptionStatus,
        creditBalanceCents: users.creditBalanceCents,
        monthlyCreditsUsedCents: users.monthlyCreditsUsedCents,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));

      const userStats = await Promise.all(allUsers.map(async (u) => {
        const [usageTotal] = await db.select({
          totalCostCents: sql<number>`COALESCE(SUM(cost_cents), 0)`,
          totalCalls: count(),
        }).from(usageLogs).where(eq(usageLogs.userId, u.id));

        const [activityTotal] = await db.select({
          totalActions: count(),
        }).from(activityLogs).where(eq(activityLogs.userId, u.id));

        const recentActivity = await db.select({
          action: activityLogs.action,
          path: activityLogs.path,
          createdAt: activityLogs.createdAt,
        }).from(activityLogs)
          .where(eq(activityLogs.userId, u.id))
          .orderBy(desc(activityLogs.createdAt))
          .limit(1);

        return {
          ...u,
          totalAiCostCents: Number(usageTotal.totalCostCents),
          totalAiCalls: Number(usageTotal.totalCalls),
          totalPageViews: Number(activityTotal.totalActions),
          lastActive: recentActivity[0]?.createdAt || null,
        };
      }));

      res.json(userStats);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/activity", isAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.userId as string | undefined;

      let query = db.select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        action: activityLogs.action,
        path: activityLogs.path,
        method: activityLogs.method,
        createdAt: activityLogs.createdAt,
      }).from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset);

      if (userId) {
        query = query.where(eq(activityLogs.userId, userId)) as any;
      }

      const logs = await query;
      res.json(logs);
    } catch (error) {
      console.error("Admin activity error:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.get("/api/admin/activity-summary", isAdmin, async (req: Request, res: Response) => {
    try {
      const actionCounts = await db.select({
        action: activityLogs.action,
        count: count(),
      }).from(activityLogs)
        .groupBy(activityLogs.action)
        .orderBy(desc(count()));

      const hourlyActivity = await db.select({
        hour: sql<number>`EXTRACT(HOUR FROM created_at)`,
        count: count(),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
        .groupBy(sql`EXTRACT(HOUR FROM created_at)`)
        .orderBy(sql`EXTRACT(HOUR FROM created_at)`);

      const dailyActivity = await db.select({
        date: sql<string>`DATE(created_at)`,
        count: count(),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`);

      res.json({
        actionCounts,
        hourlyActivity,
        dailyActivity,
      });
    } catch (error) {
      console.error("Admin activity summary error:", error);
      res.status(500).json({ error: "Failed to fetch activity summary" });
    }
  });

  app.get("/api/admin/ai-usage", isAdmin, async (req: Request, res: Response) => {
    try {
      const perUserCost = await db.select({
        userId: usageLogs.userId,
        feature: usageLogs.feature,
        totalCostCents: sql<number>`COALESCE(SUM(cost_cents), 0)`,
        totalInputTokens: sql<number>`COALESCE(SUM(input_tokens), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(output_tokens), 0)`,
        callCount: count(),
      }).from(usageLogs)
        .groupBy(usageLogs.userId, usageLogs.feature)
        .orderBy(desc(sql`SUM(cost_cents)`));

      const recentUsage = await db.select({
        id: usageLogs.id,
        userId: usageLogs.userId,
        feature: usageLogs.feature,
        model: usageLogs.model,
        inputTokens: usageLogs.inputTokens,
        outputTokens: usageLogs.outputTokens,
        costCents: usageLogs.costCents,
        createdAt: usageLogs.createdAt,
      }).from(usageLogs)
        .orderBy(desc(usageLogs.createdAt))
        .limit(50);

      res.json({ perUserCost, recentUsage });
    } catch (error) {
      console.error("Admin AI usage error:", error);
      res.status(500).json({ error: "Failed to fetch AI usage" });
    }
  });

  app.get("/api/admin/check", isAuthenticated, async (req: any, res: Response) => {
    const email = req.user?.claims?.email;
    res.json({ isAdmin: email === ADMIN_EMAIL });
  });

  return httpServer;
}
