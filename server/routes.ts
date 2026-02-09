import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerPushRoutes, sendMarketSummaryNotification } from "./push";
import { sendMarketWrapEmails, sendWelcomeEmail } from "./email";
import { insertPortfolioHoldingSchema, insertWatchlistSchema, activityLogs, newsFeed } from "@shared/schema";
import { users, usageLogs } from "@shared/schema";
import OpenAI from "openai";
import { isAuthenticated, authStorage } from "./replit_integrations/auth";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import {
  getUserCredits,
  recordUsage,
  getUserUsageHistory,
  getNewsFeed,
  addNewsFeedItem,
  getMarketEventTitle,
  checkAndDeductCredits,
  checkBroQueryAllowed,
  getBroStatus,
  MARKET_SCHEDULES,
  hasNewsFeedItemForMarketToday
} from "./creditService";
import { db } from "./db";
import { desc, sql, eq, gte, count, and, isNotNull } from "drizzle-orm";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "hbeamish1@gmail.com")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(req: any, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!ADMIN_EMAILS.includes(user.claims.email.toLowerCase())) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

function isValidTicker(ticker: string): boolean {
  return /^[A-Za-z0-9._-]{1,20}$/.test(ticker);
}

function normalizeTicker(ticker: string): string {
  return ticker.replace(/\.ASX$/i, ".AX").toUpperCase();
}

const LASER_BEAM_API = "https://api.laserbeamcapital.com";
if (!process.env.API_KEY) {
  console.error("WARNING: API_KEY environment variable is not set! Market data API calls will fail with 401.");
}
const LASER_BEAM_HEADERS: HeadersInit = {
  "X-API-Key": process.env.API_KEY || "",
};

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
  category: item.category || '',
  categoryNotes: item.categoryNotes || '',
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

function getMSFTFallbackAnalysis() {
  return {
    ticker: "MSFT",
    mode: "deep_dive",
    companyName: "Microsoft Corporation",
    currentPrice: 393.67,
    recommendation: {
      action: "Buy",
      confidence: 82,
      targetPrice: 480,
      upside: 21.9,
      timeHorizon: "12 months",
      reasoning: "Microsoft's dominant position in enterprise cloud computing through Azure, combined with its rapidly growing AI monetisation via Copilot integrations across Office 365, GitHub, and Dynamics 365, creates a compelling growth trajectory. The company's diversified revenue streams across productivity software, cloud infrastructure, gaming (Activision Blizzard), and LinkedIn provide resilience, while strong free cash flow generation supports continued shareholder returns and strategic investments."
    },
    analysis: `## Executive Summary\n\nMicrosoft Corporation (NASDAQ: MSFT) remains one of the highest-quality large-cap technology companies globally, combining a dominant enterprise software franchise with a rapidly scaling cloud and AI platform. Despite trading at a premium valuation, the company's growth profile, margin expansion potential, and strategic positioning in the AI revolution justify a Buy recommendation.\n\n## Business Quality & Competitive Position\n\nMicrosoft operates across three highly profitable segments: Productivity & Business Processes (Office 365, LinkedIn, Dynamics), Intelligent Cloud (Azure, server products, GitHub), and More Personal Computing (Windows, Xbox, Surface). The company benefits from deep enterprise moats including high switching costs, network effects across its collaboration tools, and significant data advantages that strengthen its AI capabilities.\n\nAzure continues to gain cloud market share and is now the second-largest cloud provider globally. The integration of OpenAI's technology directly into Azure gives Microsoft a meaningful competitive advantage in enterprise AI adoption. GitHub Copilot has rapidly scaled to millions of subscribers, validating the AI-assisted developer tools category.\n\n## Financial Analysis\n\nMicrosoft's financial profile is exceptional among mega-cap technology companies. Revenue growth has remained in the mid-teens percentage range, driven primarily by Commercial Cloud growth exceeding 20% year-over-year. Operating margins have expanded consistently, reflecting operating leverage in the cloud business and disciplined cost management. Free cash flow generation exceeds $60 billion annually, providing substantial capital allocation flexibility.\n\nThe balance sheet remains fortress-like with significant cash reserves and manageable debt levels. Return on equity consistently exceeds 35%, demonstrating efficient capital deployment. The company has returned significant capital through a growing dividend and substantial share repurchase program.\n\n## Growth Catalysts\n\n- **Azure AI Services**: Rapid enterprise adoption of Azure OpenAI Service and Copilot integrations across the Microsoft 365 suite represents a multi-billion dollar incremental revenue opportunity over the next 2-3 years.\n- **Copilot Monetisation**: Microsoft 365 Copilot at $30/user/month pricing creates a significant ASP uplift opportunity across the installed base of over 400 million commercial Office 365 seats.\n- **Gaming Division**: The Activision Blizzard acquisition strengthens Microsoft's content library and Game Pass subscription economics, with potential for improved margins as integration synergies materialise.\n- **LinkedIn Revenue Acceleration**: AI-enhanced features and premium tier upgrades are driving accelerating revenue growth in the LinkedIn segment.\n\n## Key Risks\n\n- **Cloud spending deceleration**: A broader slowdown in enterprise IT budgets could impact Azure growth rates, though Microsoft's mission-critical positioning mitigates this risk.\n- **AI competition**: Intensifying competition from Google Cloud (Gemini), Amazon (Bedrock), and emerging AI platforms could pressure market share gains.\n- **Regulatory scrutiny**: Increasing antitrust attention on bundling practices and the OpenAI partnership represents an ongoing regulatory overhang.\n- **Valuation premium**: Trading above historical averages on forward P/E metrics limits margin of safety if growth disappoints.\n\n## Valuation\n\nAt current levels, Microsoft trades at approximately 30-32x forward earnings, which represents a premium to the broader market but is justified by the company's superior growth profile, margin trajectory, and balance sheet quality. On a PEG basis, the stock appears reasonably valued given expected mid-teens earnings growth. A discounted cash flow analysis suggests fair value in the $450-500 range, providing meaningful upside from current levels.\n\n## Conclusion\n\nMicrosoft represents a rare combination of scale, quality, and growth in the large-cap technology universe. The company's strategic positioning at the centre of the enterprise AI adoption cycle, combined with its diversified revenue streams, expanding margins, and exceptional cash generation, supports a Buy recommendation with a 12-month target price of $480, representing approximately 22% upside from current levels. The primary risk to this thesis is a significant deceleration in enterprise cloud and AI spending, which we view as unlikely given current demand signals.`
  };
}

async function refreshMSFTAnalysisCache() {
  const CACHE_KEY = "deep_analysis_MSFT";
  console.log("[MSFT Cache] Fetching from Laser Beam Capital API...");
  try {
    const res = await fetchWithTimeout(`${LASER_BEAM_API}/api/cached-analysis/MSFT`, { headers: LASER_BEAM_HEADERS }, 30000);
    if (!res.ok) {
      console.error("[MSFT Cache] Laser Beam API error:", res.status);
      return;
    }

    const data = await res.json() as any;

    if (data.loading) {
      console.log("[MSFT Cache] Laser Beam API still generating, keeping existing cache");
      const existing = await storage.getCachedData(CACHE_KEY);
      if (existing) {
        await storage.setCachedData(CACHE_KEY, existing, 24 * 60);
      }
      return;
    }

    const analysisText = data.analysis || "";
    const hasQualityResult = analysisText.length > 500 &&
      data.recommendation?.confidence > 50 &&
      data.recommendation?.targetPrice > 0;

    if (hasQualityResult) {
      await storage.setCachedData(CACHE_KEY, data, 24 * 60);
      console.log("[MSFT Cache] Successfully refreshed from Laser Beam Capital at", new Date().toISOString());
    } else {
      console.log("[MSFT Cache] Laser Beam returned low-quality result, keeping existing cache");
      const existing = await storage.getCachedData(CACHE_KEY);
      if (existing) {
        await storage.setCachedData(CACHE_KEY, existing, 24 * 60);
      }
    }
  } catch (error) {
    console.error("[MSFT Cache] Refresh error:", error);
  }
}

function startMSFTCacheScheduler() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  (async () => {
    const existing = await storage.getCachedData("deep_analysis_MSFT");
    if (!existing) {
      console.log("[MSFT Cache] No cache found, seeding with fallback and starting refresh...");
      await storage.setCachedData("deep_analysis_MSFT", getMSFTFallbackAnalysis(), 24 * 60);
      refreshMSFTAnalysisCache();
    } else {
      console.log("[MSFT Cache] Cache exists, will refresh on schedule");
    }
  })();

  setInterval(() => {
    refreshMSFTAnalysisCache();
  }, TWENTY_FOUR_HOURS);
}

async function generateAndPostMarketSummary(market: string, eventType: string): Promise<void> {
  let summaryContent = "";
  try {
    const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets/summary`, { headers: LASER_BEAM_HEADERS });
    if (response.ok) {
      const data = await response.json();
      summaryContent = data.summary || "";
    }
  } catch (e) {
    console.error(`[NewsFeed Scheduler] Failed to fetch market summary for ${market}:`, e);
  }

  if (!summaryContent) {
    summaryContent = `Market update for ${market}. Check the markets tab for latest prices and performance data.`;
  }

  const title = getMarketEventTitle(market, eventType);

  const newItem = await addNewsFeedItem({
    title,
    content: summaryContent,
    market,
    eventType,
    source: "system",
    publishedAt: new Date(),
    metadata: { generatedAt: new Date().toISOString() },
  });

  console.log(`[NewsFeed Scheduler] Posted ${eventType} summary for ${market}: ${title}`);

  // Send push notifications for market close summaries
  if (eventType === "close") {
    const marketMap: Record<string, string> = { USA: "usa", ASX: "asx", Europe: "europe" };
    const summaryType = marketMap[market];
    if (summaryType) {
      try {
        await sendMarketSummaryNotification(summaryType, String(newItem.id));
      } catch (e) {
        console.error(`[Push] Failed to send summary notification for ${market}:`, e);
      }
    }

    // Send market wrap emails
    try {
      await sendMarketWrapEmails(market, summaryContent, String(newItem.id));
    } catch (e) {
      console.error(`[Email] Failed to send market wrap emails for ${market}:`, e);
    }
  }
}

async function checkAndPostMarketCloseSummaries(): Promise<void> {
  for (const [market, schedule] of Object.entries(MARKET_SCHEDULES)) {
    try {
      // Get current time in market's timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: schedule.timezone,
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const weekday = parts.find(p => p.type === 'weekday')?.value || '';

      // Skip weekends
      if (weekday === 'Sat' || weekday === 'Sun') continue;

      // Calculate post time (close + offset)
      const postMinutes = schedule.closeHour * 60 + schedule.closeMinute + schedule.updateOffsetMinutes;
      const currentMinutes = hour * 60 + minute;

      // Post any time after close+offset for the rest of the trading day
      // (no upper bound - duplicate check prevents re-posting)
      if (currentMinutes < postMinutes) continue;

      // Check if already posted today (DB-based, survives restarts)
      const alreadyPosted = await hasNewsFeedItemForMarketToday(market, 'close');
      if (alreadyPosted) continue;

      await generateAndPostMarketSummary(market, 'close');
    } catch (e) {
      console.error(`[NewsFeed Scheduler] Error checking ${market}:`, e);
    }
  }
}

// Catch up on missed summaries (e.g. server was asleep during market close)
// Checks if any market is missing a close summary from the last trading day
async function checkMissedMarketCloseSummaries(): Promise<void> {
  for (const [market, _schedule] of Object.entries(MARKET_SCHEDULES)) {
    try {
      // Already have one for today? Skip.
      const hasToday = await hasNewsFeedItemForMarketToday(market, 'close');
      if (hasToday) continue;

      // Check if we have ANY close summary in the last 48 hours
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recent = await db.select({ id: newsFeed.id })
        .from(newsFeed)
        .where(
          and(
            eq(newsFeed.market, market),
            eq(newsFeed.eventType, 'close'),
            gte(newsFeed.publishedAt, cutoff)
          )
        )
        .limit(1);

      if (recent.length === 0) {
        console.log(`[NewsFeed Scheduler] Missed close summary for ${market}, posting catch-up now`);
        await generateAndPostMarketSummary(market, 'close');
      }
    } catch (e) {
      console.error(`[NewsFeed Scheduler] Error checking missed summary for ${market}:`, e);
    }
  }
}

function startNewsFeedScheduler() {
  console.log("[NewsFeed Scheduler] Started - checking every 60s for market close summaries");

  // Check for missed summaries on startup (handles server sleeping through close window)
  setTimeout(() => checkMissedMarketCloseSummaries(), 15 * 1000);

  // Initial check 30s after server start (handles restarts during posting window)
  setTimeout(() => checkAndPostMarketCloseSummaries(), 30 * 1000);

  // Then check every 60 seconds
  setInterval(() => checkAndPostMarketCloseSummaries(), 60 * 1000);
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
  if (path.startsWith("/api/push")) return "push_notifications";
  return "other";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const SITE_URL = "https://www.buysidebro.com";

  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain").send(
      `User-agent: *\nAllow: /\nAllow: /dashboard\nAllow: /portfolio\nAllow: /watchlist\nAllow: /analysis\nAllow: /earnings\nAllow: /whats-up\nAllow: /chat\nAllow: /preview\nDisallow: /api/\nDisallow: /admin\nDisallow: /subscription\n\nSitemap: ${SITE_URL}/sitemap.xml`
    );
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const pages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/dashboard", priority: "0.9", changefreq: "hourly" },
      { loc: "/watchlist", priority: "0.8", changefreq: "daily" },
      { loc: "/portfolio", priority: "0.8", changefreq: "daily" },
      { loc: "/analysis", priority: "0.8", changefreq: "daily" },
      { loc: "/earnings", priority: "0.7", changefreq: "daily" },
      { loc: "/whats-up", priority: "0.7", changefreq: "hourly" },
      { loc: "/chat", priority: "0.6", changefreq: "monthly" },
      { loc: "/preview", priority: "0.5", changefreq: "weekly" },
    ];
    const urls = pages
      .map(
        (p) =>
          `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      )
      .join("\n");
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  });

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
          query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
        },
      }).catch((err: any) => console.error("Activity log error:", err));
    }
    next();
  });
  registerChatRoutes(app);
  registerPushRoutes(app);

  app.get("/api/markets", async (req: Request, res: Response) => {
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

      let data: any = null;
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets`, { headers: LASER_BEAM_HEADERS });
        if (response.ok) {
          data = await response.json();
        } else {
          console.error(`Laser Beam API returned ${response.status}: ${response.statusText}`);
        }
      } catch (e) {
        console.error("Failed to fetch from Laser Beam API:", e);
      }

      if (data && (data.indices || data.markets)) {
        const marketsData = {
          indices: data.indices || [],
          futures: data.futures || [],
          commodities: data.commodities || [],
          sectors: data.sectors || [],
          crypto: data.crypto || [],
        };
        await storage.setCachedData("markets", marketsData, 5);
        return res.json(marketsData);
      }

      console.warn("API returned no valid data, serving fallback WITHOUT caching");
      res.json({
        indices: FALLBACK_INDICES,
        futures: FALLBACK_FUTURES,
        commodities: FALLBACK_COMMODITIES,
        sectors: FALLBACK_SECTORS,
        crypto: [],
        _stale: true,
        _staleAsOf: "2025-01-01T00:00:00Z",
      });
    } catch (error) {
      console.error("Markets API error:", error);
      res.json({
        indices: FALLBACK_INDICES.slice(0, 4),
        futures: FALLBACK_FUTURES.slice(0, 2),
        commodities: FALLBACK_COMMODITIES.slice(0, 2),
        sectors: FALLBACK_SECTORS.slice(0, 3),
        crypto: [],
        _stale: true,
        _staleAsOf: "2025-01-01T00:00:00Z",
      });
    }
  });

  app.get("/api/markets/full", async (req: Request, res: Response) => {
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

      const cacheKey = forceRefresh ? `markets_full_fetch_${Date.now()}` : "markets_full_fetch";
      let fetchPromise = pendingRequests.get(cacheKey);
      
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets`, { headers: LASER_BEAM_HEADERS }, 15000);
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
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

          await storage.setCachedData("markets_full", marketsFullData, 5);
          return marketsFullData;
        })();
        
        pendingRequests.set(cacheKey, fetchPromise);
        fetchPromise.catch(() => {}).finally(() => pendingRequests.delete(cacheKey));
      }

      try {
        const data = await fetchPromise;
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

  app.get("/api/markets/summary", async (req: Request, res: Response) => {
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

      const response = await fetch(`${LASER_BEAM_API}/api/markets/summary`, { headers: LASER_BEAM_HEADERS });
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

  app.post("/api/admin/clear-market-cache", isAdmin, async (req: any, res: Response) => {
    try {
      const cacheKeys = ["markets", "markets_full", "market_summary"];
      for (const key of cacheKeys) {
        await storage.deleteCachedData(key);
      }
      console.log("Admin cleared market cache");
      res.json({ success: true, cleared: cacheKeys });
    } catch (error) {
      console.error("Clear cache error:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  app.get("/api/portfolio", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
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
        fetchWithTimeout(`${LASER_BEAM_API}/api/ticker-search?q=${encodeURIComponent(query)}`, { headers: LASER_BEAM_HEADERS }, 5000),
      ];

      const shouldSearchASX = !query.includes('.') && query.length >= 1;
      if (shouldSearchASX) {
        searchFetches.push(
          fetchWithTimeout(`${LASER_BEAM_API}/api/ticker-search?q=${encodeURIComponent(query + '.AX')}`, { headers: LASER_BEAM_HEADERS }, 5000),
        );
      }

      const fmpStartIndex = searchFetches.length;
      if (fmpKey) {
        searchFetches.push(
          fetchWithTimeout(`https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(query)}&limit=15&apikey=${fmpKey}`, {}, 5000),
        );
      }

      const responses = await Promise.allSettled(searchFetches);
      const seen = new Set<string>();
      const results: any[] = [];

      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i];
        if (resp.status === 'fulfilled' && resp.value.ok) {
          const data = await resp.value.json() as any;
          const isFmp = i >= fmpStartIndex;

          if (isFmp && Array.isArray(data)) {
            for (const item of data) {
              const sym = item.symbol;
              if (sym && !seen.has(sym)) {
                seen.add(sym);
                results.push({
                  symbol: sym,
                  name: item.name,
                  exchange: item.exchange || '',
                  type: 'stock',
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

  app.post("/api/portfolio", isAuthenticated, async (req: any, res: Response) => {
    try {
      const validation = insertPortfolioHoldingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }

      const { ticker, shares, avgCost, name, sector } = validation.data;
      
      let currentPrice = avgCost;
      try {
        const fmpUrl = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
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

      const userId = req.user.claims.sub;
      const holding = await storage.createPortfolioHolding(userId, {
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

  app.delete("/api/portfolio/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id as string);
      await storage.deletePortfolioHolding(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete portfolio error:", error);
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });

  // Enriched portfolio data with market data from FMP (per-ticker caching, 2-min TTL)
  app.get("/api/portfolio/enriched", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      if (holdings.length === 0) {
        return res.json([]);
      }

      const apiKey = process.env.FMP_API_KEY;
      const tickerList = holdings.map(h => h.ticker.toUpperCase());

      const quoteMap = new Map<string, any>();
      const metricsMap = new Map<string, any>();
      const profileMap = new Map<string, any>();

      // Check per-ticker cache first, only fetch uncached tickers from FMP
      const uncachedTickers: string[] = [];
      for (const ticker of tickerList) {
        const cachedEnrichment = await storage.getCachedData(`stock_enrichment_${ticker}`) as { quote?: any; metrics?: any; profile?: any } | null;
        if (cachedEnrichment) {
          if (cachedEnrichment.quote) quoteMap.set(ticker, cachedEnrichment.quote);
          if (cachedEnrichment.metrics) metricsMap.set(ticker, cachedEnrichment.metrics);
          if (cachedEnrichment.profile) profileMap.set(ticker, cachedEnrichment.profile);
        } else {
          uncachedTickers.push(ticker);
        }
      }

      // Only fetch FMP data for tickers not found in cache
      if (uncachedTickers.length > 0 && apiKey) {
        try {
          const allRequests: Promise<void>[] = [];

          for (const ticker of uncachedTickers) {
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

          // Cache each newly fetched ticker's enrichment data (2-minute TTL)
          for (const ticker of uncachedTickers) {
            const enrichmentData = {
              quote: quoteMap.get(ticker) || null,
              metrics: metricsMap.get(ticker) || null,
              profile: profileMap.get(ticker) || null,
            };
            // Only cache if we got at least some data for this ticker
            if (enrichmentData.quote || enrichmentData.metrics || enrichmentData.profile) {
              await storage.setCachedData(`stock_enrichment_${ticker}`, enrichmentData, 2);
            }
          }
        } catch (e) {
          console.error("Failed to fetch FMP data:", e);
        }
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

  app.get("/api/portfolio/stats", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      
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
      
      // dayChange requires live quote data; return 0 instead of fake random values
      const dayChange = 0;
      const dayChangePercent = 0;

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

  app.get("/api/portfolio/analysis", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;

      // Check daily Bro query limit
      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            analysis: broCheck.message,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
        const creditCheck = await checkAndDeductCredits(userId, 10);
        if (!creditCheck.allowed) {
          return res.status(402).json({
            error: "Out of credits",
            analysis: "You've used all your Bro credits. Purchase additional credits to continue using Bro features.",
            requiresCredits: true
          });
        }
      }

      const holdings = await storage.getPortfolioHoldings(userId || "");
      if (holdings.length === 0) {
        return res.json({ analysis: "Add some holdings to get Bro-powered portfolio analysis." });
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

      const content = completion.choices[0]?.message?.content || "";
      
      // Record usage for authenticated users
      if (userId) {
        await recordUsage(userId, 'portfolio_analysis', 'moonshotai/kimi-k2.5', holdingsSummary.length / 4, content.length / 4);
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
  app.post("/api/portfolio/review", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;

      // Check daily Bro query limit
      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            review: `## Daily Limit Reached\n\n${broCheck.message}`,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
        const creditCheck = await checkAndDeductCredits(userId, 30);
        if (!creditCheck.allowed) {
          return res.status(402).json({
            error: "Out of credits",
            review: "## Out of Bro Credits\n\nYou've used all your Bro credits. Purchase additional credits to continue using Bro features.",
            requiresCredits: true
          });
        }
      }

      const holdings = await storage.getPortfolioHoldings(userId || "");
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
        const dayPct = 0; // Requires live quote data
        const mtdPct = 0; // Requires live quote data
        
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

      const dailyPnl = 0;
      const dailyPnlPct = 0;

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
        model: "moonshotai/kimi-k2.5",
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
        await recordUsage(userId, 'portfolio_review', 'moonshotai/kimi-k2.5', promptLength / 4, review.length / 4);
      }

      res.json({ review });
    } catch (error) {
      console.error("Portfolio review error:", error);
      res.json({ 
        review: "## Review Temporarily Unavailable\n\nSorry bro, I'm having trouble accessing the analysis engine right now. Give it another shot in a few minutes." 
      });
    }
  });

  app.get("/api/analysis/profile/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const fmpUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
      const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;

      const [fmpResponse, lbcResponse] = await Promise.all([
        fetchWithTimeout(fmpUrl, {}, 10000),
        fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 10000).catch(() => null),
      ]);

      if (!fmpResponse.ok) throw new Error("Failed to fetch profile");

      const data = await fmpResponse.json() as any[];
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Stock not found" });
      }

      let lbcDescription = "";
      let investmentCase = "";
      if (lbcResponse && lbcResponse.ok) {
        try {
          const lbcRaw = await lbcResponse.json() as any;
          const lbcData = lbcRaw?.data || lbcRaw;
          lbcDescription = lbcData.companyDescription || "";
          investmentCase = lbcData.investmentCase || "";
        } catch {}
      }

      const profile = data[0];
      res.json({
        symbol: profile.symbol,
        companyName: profile.companyName,
        sector: profile.sector || "N/A",
        industry: profile.industry || "N/A",
        exchange: profile.exchange,
        marketCap: profile.marketCap || 0,
        price: profile.price || 0,
        changes: profile.change || 0,
        changesPercentage: profile.changePercentage || 0,
        description: lbcDescription || profile.description || "",
        investmentCase,
      });
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ error: "Failed to fetch stock profile" });
    }
  });

  app.get("/api/analysis/financials/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const ratiosUrl = `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
      const incomeUrl = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(ticker)}&limit=1&apikey=${process.env.FMP_API_KEY}`;
      const metricsUrl = `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;

      const [ratiosRes, incomeRes, metricsRes] = await Promise.all([
        fetchWithTimeout(ratiosUrl, {}, 10000),
        fetchWithTimeout(incomeUrl, {}, 10000),
        fetchWithTimeout(metricsUrl, {}, 10000),
      ]);

      const ratios: any[] = ratiosRes.ok ? await ratiosRes.json() as any[] : [];
      const income: any[] = incomeRes.ok ? await incomeRes.json() as any[] : [];
      const metrics: any[] = metricsRes.ok ? await metricsRes.json() as any[] : [];

      const r = ratios[0] || {};
      const i = income[0] || {};
      const m = metrics[0] || {};

      res.json({
        revenue: i.revenue || 0,
        netIncome: i.netIncome || 0,
        eps: i.eps || r.netIncomePerShareTTM || 0,
        peRatio: r.priceToEarningsRatioTTM || 0,
        pbRatio: r.priceToBookRatioTTM || 0,
        dividendYield: r.dividendYieldTTM || 0,
        roe: m.returnOnEquityTTM || 0,
        debtToEquity: r.debtToEquityRatioTTM || 0,
        enterpriseValue: m.enterpriseValueTTM || null,
        evToEbit: m.enterpriseValueTTM && i.operatingIncome ? m.enterpriseValueTTM / i.operatingIncome : null,
      });
    } catch (error) {
      console.error("Financials error:", error);
      res.status(500).json({ error: "Failed to fetch financials" });
    }
  });

  // Historical price data for 1-year chart
  app.get("/api/analysis/history/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fmpUrl = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(ticker)}&from=${fromDate}&to=${toDate}&apikey=${process.env.FMP_API_KEY}`;

      const response = await fetchWithTimeout(fmpUrl, {}, 10000);
      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`);
      }

      const data = await response.json() as any[];
      // Stable endpoint returns flat array sorted newest first, reverse for chart
      const chartData = (data || []).slice(0, 365).reverse().map((d: any) => ({
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

  // Forward metrics (P/E, EPS growth) — sourced from Laser Beam Capital API
  app.get("/api/analysis/forward/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);

      const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;
      const lbcResponse = await fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 10000);

      if (!lbcResponse.ok) {
        return res.status(502).json({ error: "Failed to fetch forward metrics from data source" });
      }

      const lbcRaw = await lbcResponse.json() as any;
      const lbcData = lbcRaw?.data || lbcRaw;
      const fm = lbcData.forwardMetrics || {};

      const forwardPE = typeof fm.forwardPE === 'number' ? fm.forwardPE : null;
      const forwardEpsGrowth = typeof fm.forwardEPSGrowth === 'number' ? fm.forwardEPSGrowth : null;

      let pegRatio: number | null = null;
      if (forwardPE !== null && forwardEpsGrowth !== null && forwardEpsGrowth > 0) {
        pegRatio = forwardPE / forwardEpsGrowth;
      }

      res.json({
        ticker,
        forwardPE,
        forwardEpsGrowth,
        pegRatio,
        currentEps: null,
        estimatedEps: null,
      });
    } catch (error) {
      console.error("Forward metrics error:", error);
      res.status(500).json({ error: "Failed to fetch forward metrics" });
    }
  });

  app.get("/api/analysis/sec-filings/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const apiKey = process.env.FMP_API_KEY;
      const response = await fetchWithTimeout(
        `https://financialmodelingprep.com/api/v3/sec_filings/${encodeURIComponent(ticker)}?limit=20&apikey=${apiKey}`,
        {},
        10000
      );
      if (!response.ok) {
        // v3 endpoint may be deprecated; return empty array gracefully
        return res.json([]);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("SEC filings error:", error);
      res.status(500).json({ error: "Failed to fetch SEC filings" });
    }
  });

  app.get("/api/analysis/ai/:ticker", isAuthenticated, async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const userId = req.user?.claims?.sub;

      // Try Laser Beam Capital fundamental analysis API first
      try {
        const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...LASER_BEAM_HEADERS },
          body: JSON.stringify({ ticker }),
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          return res.json({
            summary: data.summary || data.analysis || `${ticker} analysis from Laser Beam Capital.`,
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
      
      // Check daily Bro query limit + credits (only for OpenRouter fallback)
      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            summary: broCheck.message,
            sentiment: "neutral",
            keyPoints: [],
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
        const creditCheck = await checkAndDeductCredits(userId, 15);
        if (!creditCheck.allowed) {
          return res.status(402).json({
            error: "Out of credits",
            summary: "You've used all your Bro credits. Purchase additional credits to continue using Bro features.",
            sentiment: "neutral",
            keyPoints: [],
            requiresCredits: true
          });
        }
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
            content: `Give a brief investment analysis for ${ticker}. Consider recent performance, market position, and outlook.`
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      
      // Record usage for authenticated users
      if (userId) {
        const promptText = `Give a brief investment analysis for ${ticker}. Consider recent performance, market position, and outlook.`;
        await recordUsage(userId, 'stock_analysis', 'moonshotai/kimi-k2.5', promptText.length / 4, content.length / 4);
      }

      try {
        const parsed = JSON.parse(content);
        res.json({
          summary: parsed.summary || `${ticker} is an interesting opportunity. Do your own research before investing.`,
          sentiment: parsed.sentiment || "neutral",
          keyPoints: parsed.keyPoints || ["Consider your investment goals", "Review recent earnings", "Monitor market conditions"],
        });
      } catch {
        res.json({
          summary: `${ticker} shows potential. As always, consider your investment horizon and risk tolerance.`,
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
  app.post("/api/fundamental-analysis/jobs", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      const { ticker, mode } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }
      const upperTicker = ticker.toUpperCase();

      // Check daily Bro query limit
      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            message: broCheck.message,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
      }

      const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...LASER_BEAM_HEADERS },
        body: JSON.stringify({ 
          ticker: upperTicker,
          mode: mode || "preview",
          model: "moonshotai/kimi-k2.5"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Analysis job creation failed:", response.status, errorText);
        return res.status(500).json({ error: "Failed to start analysis job" });
      }
      
      const data = await response.json() as any;

      // Log usage for daily Bro query counter
      if (userId) {
        await recordUsage(userId, 'earnings_analysis', 'laserbeam/fundamental', 0, 0);
      }

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
  app.post("/api/analysis/deep/:ticker", isAuthenticated, async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const userId = req.user?.claims?.sub;
      const ticker = normalizeTicker(rawTicker);

      // Check daily Bro query limit
      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            message: broCheck.message,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
      }

      // Start async job with Laser Beam Capital API
      const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...LASER_BEAM_HEADERS },
        body: JSON.stringify({ 
          ticker,
          model: "moonshotai/kimi-k2.5"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Deep analysis job creation failed:", response.status, errorText);
        return res.status(500).json({ error: "Failed to start analysis job" });
      }
      
      const data = await response.json() as any;

      // Log usage for daily Bro query counter
      if (userId) {
        await recordUsage(userId, 'deep_analysis', 'laserbeam/fundamental', 0, 0);
      }

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

  app.get("/api/analysis/deep/job/:jobId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const jobId = req.params.jobId;
      
      // Check job status
      const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/jobs/${jobId}`, { headers: LASER_BEAM_HEADERS });
      
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

  app.get("/api/analysis/deep/result/:jobId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const jobId = req.params.jobId;
      
      // Get job result
      const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/jobs/${jobId}/result`, { headers: LASER_BEAM_HEADERS });
      
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

  app.get("/api/analysis/deep/cached/:ticker", async (req: any, res: Response) => {
    const rawTicker = req.params.ticker as string;
    if (!isValidTicker(rawTicker)) {
      return res.status(400).json({ error: "Invalid ticker symbol" });
    }
    const ticker = normalizeTicker(rawTicker);
    if (ticker !== "MSFT") {
      return res.status(404).json({ error: "No cached analysis available" });
    }

    try {
      const cached = await storage.getCachedData(`deep_analysis_${ticker}`);
      if (cached) {
        return res.json(cached);
      }
      const fallback = getMSFTFallbackAnalysis();
      await storage.setCachedData(`deep_analysis_MSFT`, fallback, 24 * 60);
      res.json(fallback);
    } catch (error) {
      console.error("Cached analysis error:", error);
      res.json(getMSFTFallbackAnalysis());
    }
  });

  app.get("/api/earnings", isAuthenticated, async (req: any, res: Response) => {
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

      const fmpUrl = `https://financialmodelingprep.com/stable/earnings-calendar?from=${fromDate}&to=${toDate}&apikey=${process.env.FMP_API_KEY}`;
      
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
          time: "during",
          epsEstimate: e.epsEstimated,
          epsActual: null,
          revenueEstimate: e.revenueEstimated,
          revenueActual: null,
          surprise: null,
        }));

      const recent = data
        .filter((e: any) => new Date(e.date) < today && e.epsActual !== null)
        .slice(0, 10)
        .map((e: any) => ({
          symbol: e.symbol,
          name: e.symbol,
          date: e.date,
          time: "during",
          epsEstimate: e.epsEstimated,
          epsActual: e.epsActual,
          revenueEstimate: e.revenueEstimated,
          revenueActual: e.revenueActual,
          surprise: e.epsEstimated ? ((e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated)) * 100 : null,
        }));

      const earningsData = { upcoming, recent };
      await storage.setCachedData("earnings", earningsData, 1440);
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

  app.get("/api/news", isAuthenticated, async (req: any, res: Response) => {
    try {
      const cached = await storage.getCachedData("news");
      if (cached) {
        return res.json(cached);
      }

      let marketNews: any[] = [];
      let portfolioNews: any[] = [];

      // Fetch market news from Laser Beam Capital API
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/news/market`, { headers: LASER_BEAM_HEADERS }, 5000);
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
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/news/portfolio`, { headers: LASER_BEAM_HEADERS }, 5000);
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
      await storage.setCachedData("news", newsData, 1440);
      res.json(newsData);
    } catch (error) {
      console.error("News error:", error);
      res.json({
        market: [{ title: "Market update coming soon", description: "Check back for the latest market news.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "market" }],
        general: [{ title: "Business news loading", description: "General business news will appear here.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "general" }],
      });
    }
  });

  app.get("/api/news/search", isAuthenticated, async (req: any, res: Response) => {
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
      // Return empty products if the stripe schema/tables don't exist yet
      console.error("Error listing products:", error);
      res.json({ products: [] });
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

      const isActive = user.subscriptionStatus === "active";

      res.json({
        status: user.subscriptionStatus || "none",
        isActive,
        isTrialing: false,
        trialEndsAt: null,
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

      let { priceId } = req.body;

      // If no priceId provided, look up the first active recurring price from Stripe API
      if (!priceId) {
        const stripe = await getUncachableStripeClient();
        const prices = await stripe.prices.list({
          active: true,
          type: 'recurring',
          limit: 10,
        });
        const subscriptionPrice = prices.data.find(p => p.recurring?.interval === 'month');
        if (!subscriptionPrice) {
          return res.status(400).json({ error: "No subscription price configured in Stripe" });
        }
        priceId = subscriptionPrice.id;
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
        `${baseUrl}/subscription?success=true`,
        `${baseUrl}/subscription?canceled=true`,
        0
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
      const returnUrl = `${protocol}://${host}/subscription`;

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

  // Bro daily query status
  app.get("/api/bro/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await authStorage.getUser(userId);
      const status = await getBroStatus(userId, user);
      res.json(status);
    } catch (error) {
      console.error("Error fetching bro status:", error);
      res.status(500).json({ error: "Failed to fetch bro status" });
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
      const successUrl = `${protocol}://${host}/subscription?credits=success`;
      const cancelUrl = `${protocol}://${host}/subscription?credits=cancelled`;

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
  app.get("/api/newsfeed", async (req: any, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
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

  // Default watchlist (public, no auth) - returns enriched default stocks
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
          marketCap: quote.marketCap || profile.marketCap || null,
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
      const id = parseInt(req.params.id as string);
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
      const id = parseInt(req.params.id as string);
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
    res.json({ isAdmin: email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false });
  });

  startMSFTCacheScheduler();
  startNewsFeedScheduler();

  return httpServer;
}
