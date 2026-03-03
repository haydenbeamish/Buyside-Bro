import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerPushRoutes, sendMarketSummaryNotification } from "./push";
import { sendMarketWrapEmails } from "./email";
import { activityLogs, newsFeed } from "@shared/schema";
import { db } from "./db";
import { sql, eq, gte, and } from "drizzle-orm";
import {
  hasNewsFeedItemForMarketToday,
  addNewsFeedItem,
  getMarketEventTitle,
  MARKET_SCHEDULES,
} from "./creditService";
import {
  fetchWithTimeout,
  LASER_BEAM_API,
  LASER_BEAM_HEADERS,
} from "./routes/shared";
import { getMSFTFallbackAnalysis } from "./routes/analysis";

// ── Route modules ────────────────────────────────────────────────────
import { registerMiscRoutes } from "./routes/misc";
import { registerMarketsRoutes } from "./routes/markets";
import { registerPortfolioRoutes } from "./routes/portfolio";
import { registerAnalysisRoutes } from "./routes/analysis";
import { registerEarningsRoutes } from "./routes/earnings";
import { registerNewsRoutes } from "./routes/news";
import { registerSubscriptionRoutes } from "./routes/subscription";
import { registerWatchlistRoutes } from "./routes/watchlist";
import { registerAdminRoutes } from "./routes/admin";
import { registerNewsfeedRoutes } from "./routes/newsfeed";
import { registerTradingRoutes } from "./routes/trading";
import { registerLbcProxyRoutes } from "./routes/lbc-proxy";

// ── MSFT cache scheduler ─────────────────────────────────────────────

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

// ── News feed scheduler ──────────────────────────────────────────────

const pendingSummaries = new Set<string>();

export async function generateAndPostMarketSummary(market: string, eventType: string): Promise<void> {
  const key = `${market}:${eventType}`;
  if (pendingSummaries.has(key)) {
    console.log(`[NewsFeed Scheduler] Already generating ${eventType} for ${market}, skipping`);
    return;
  }
  pendingSummaries.add(key);
  try {
    return await _generateAndPostMarketSummaryInner(market, eventType);
  } finally {
    pendingSummaries.delete(key);
  }
}

async function _generateAndPostMarketSummaryInner(market: string, eventType: string): Promise<void> {
  const alreadyExists = await hasNewsFeedItemForMarketToday(market, eventType);
  if (alreadyExists) return;

  let summaryContent = "";
  try {
    const marketParam = market !== 'USA' ? `?market=${encodeURIComponent(market)}` : '';
    const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/markets/summary${marketParam}`, { headers: LASER_BEAM_HEADERS });
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

  const doubleCheck = await hasNewsFeedItemForMarketToday(market, eventType);
  if (doubleCheck) return;

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

  // Fire-and-forget push notifications and emails (don't block the scheduler)
  if (eventType === "close") {
    const marketMap: Record<string, string> = { USA: "usa", ASX: "asx", Europe: "europe", Asia: "asia" };
    const summaryType = marketMap[market];
    if (summaryType) {
      sendMarketSummaryNotification(summaryType, String(newItem.id))
        .catch((e) => console.error(`[Push] Failed to send summary notification for ${market}:`, e));
    }

    sendMarketWrapEmails(market, summaryContent, String(newItem.id))
      .catch((e) => console.error(`[Email] Failed to send market wrap emails for ${market}:`, e));
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

// ── Activity logging ─────────────────────────────────────────────────

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

// ── Main registration ────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Run migration: add subscription_tier column
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free'`);
    // Migrate existing active subscribers to 'starter' tier
    await db.execute(sql`UPDATE users SET subscription_tier = 'starter' WHERE subscription_status = 'active' AND (subscription_tier IS NULL OR subscription_tier = 'free')`);
    console.log("[Migration] subscription_tier column ensured");
  } catch (e) {
    console.error("[Migration] subscription_tier migration error:", e);
  }

  // Run migration: create ai_analysis_results table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_analysis_results (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        ticker TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'streaming',
        recommendation JSONB,
        analysis TEXT DEFAULT '',
        company_name TEXT,
        current_price DECIMAL(18, 4),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_analysis_user_ticker_mode_idx
      ON ai_analysis_results (user_id, ticker, mode)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ai_analysis_user_id_idx
      ON ai_analysis_results (user_id)
    `);
    console.log("[Migration] ai_analysis_results table ensured");
  } catch (e) {
    console.error("[Migration] ai_analysis_results migration error:", e);
  }

  // Activity logging middleware
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

  // Register integration routes first (chat, push)
  registerChatRoutes(app);
  registerPushRoutes(app);

  // Register all route modules
  registerMiscRoutes(app);
  registerMarketsRoutes(app);
  registerPortfolioRoutes(app);
  registerAnalysisRoutes(app);
  registerEarningsRoutes(app);
  registerNewsRoutes(app);
  registerSubscriptionRoutes(app);
  registerWatchlistRoutes(app);
  registerAdminRoutes(app);
  registerNewsfeedRoutes(app, generateAndPostMarketSummary);
  registerTradingRoutes(app);
  registerLbcProxyRoutes(app);

  // Start background schedulers
  startMSFTCacheScheduler();
  startNewsFeedScheduler();

  return httpServer;
}
