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

      const response = await fetch("https://api.laserbeamcapital.com/api/markets");
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const markets = data.markets || [];
      
      // Transform external API data to match frontend expected format
      const transformItem = (item: any) => ({
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

      // Group by category
      const byCategory = (category: string) => 
        markets.filter((m: any) => m.category === category || m.categoryGroup === category).map(transformItem);

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
        model: "moonshotai/kimi-k2.5",
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
      
      // Fallback to OpenRouter AI
      const completion = await openrouter.chat.completions.create({
        model: "moonshotai/kimi-k2.5",
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

  return httpServer;
}
