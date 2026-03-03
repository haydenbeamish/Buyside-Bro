import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, ADMIN_EMAILS } from "./shared";
import { users, usageLogs, activityLogs } from "@shared/schema";
import { db } from "../db";
import { desc, sql, eq, gte, count, countDistinct, and, isNotNull } from "drizzle-orm";

export function registerAdminRoutes(app: Express) {
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

  app.get("/api/admin/api-costs", isAdmin, async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams();
      if (req.query.start) params.set("start", String(req.query.start));
      if (req.query.end) params.set("end", String(req.query.end));
      if (req.query.groupBy) params.set("groupBy", String(req.query.groupBy));
      const qs = params.toString();

      const { LASER_BEAM_API, LASER_BEAM_HEADERS, fetchWithTimeout } = await import("./shared");
      const url = `${LASER_BEAM_API}/api/admin/costs${qs ? `?${qs}` : ""}`;
      const response = await fetchWithTimeout(url, { headers: LASER_BEAM_HEADERS }, 10000);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Admin API costs error:", error);
      res.json({ summary: { total_calls: 0, total_cost: 0, total_tokens: 0 }, breakdown: [] });
    }
  });

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

      const [payingCount] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.subscriptionStatus, "active"));

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
        payingUsers: payingCount.count,
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
        subscriptionTier: users.subscriptionTier,
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

  // ---- Usage summary (feature-level aggregations) ----
  const ACTION_FRIENDLY_NAMES: Record<string, string> = {
    view_markets: "Markets",
    view_portfolio: "Portfolio",
    edit_portfolio: "Edit Portfolio",
    view_watchlist: "Watchlist",
    edit_watchlist: "Edit Watchlist",
    analysis: "Analysis",
    view_earnings: "Earnings",
    view_news: "News",
    chat: "Ask Bro",
    credits: "Credits",
    subscription: "Subscription",
    stock_search: "Stock Search",
    newsfeed: "News Feed",
    push_notifications: "Push Notifications",
    auth: "Auth",
    login: "Login",
    logout: "Logout",
    other: "Other",
  };

  app.get("/api/admin/usage-summary", isAdmin, async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // 1. featureUsage – per-action totals, unique users, % of total (30 days)
      const featureRows = await db.select({
        action: activityLogs.action,
        hits: count(),
        uniqueUsers: countDistinct(activityLogs.userId),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, thirtyDaysAgo))
        .groupBy(activityLogs.action)
        .orderBy(desc(count()));

      const totalHits = featureRows.reduce((s, r) => s + Number(r.hits), 0);
      const featureUsage = featureRows.map((r) => ({
        action: r.action,
        label: ACTION_FRIENDLY_NAMES[r.action] || r.action,
        hits: Number(r.hits),
        uniqueUsers: Number(r.uniqueUsers),
        pct: totalHits > 0 ? Math.round((Number(r.hits) / totalHits) * 1000) / 10 : 0,
      }));

      // 2. featureDaily – daily breakdown for top-8 features (14 days)
      const top8Actions = featureRows.slice(0, 8).map((r) => r.action);
      const dailyRows = await db.select({
        date: sql<string>`DATE(created_at)`,
        action: activityLogs.action,
        hits: count(),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, fourteenDaysAgo))
        .groupBy(sql`DATE(created_at)`, activityLogs.action)
        .orderBy(sql`DATE(created_at)`);

      // Pivot into { date, Feature1: n, Feature2: n, ... }
      const dateMap = new Map<string, Record<string, any>>();
      for (const row of dailyRows) {
        if (!top8Actions.includes(row.action)) continue;
        const key = String(row.date);
        if (!dateMap.has(key)) dateMap.set(key, { date: key });
        const friendlyName = ACTION_FRIENDLY_NAMES[row.action] || row.action;
        dateMap.get(key)![friendlyName] = Number(row.hits);
      }
      const featureDaily = Array.from(dateMap.values());
      const featureDailyKeys = top8Actions.map((a) => ACTION_FRIENDLY_NAMES[a] || a);

      // 3. hourlyHeatmap – hits by day-of-week (0=Sun) and hour (30 days)
      const heatmapRows = await db.select({
        dow: sql<number>`EXTRACT(DOW FROM created_at)`,
        hour: sql<number>`EXTRACT(HOUR FROM created_at)`,
        hits: count(),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, thirtyDaysAgo))
        .groupBy(sql`EXTRACT(DOW FROM created_at)`, sql`EXTRACT(HOUR FROM created_at)`)
        .orderBy(sql`EXTRACT(DOW FROM created_at)`, sql`EXTRACT(HOUR FROM created_at)`);

      const hourlyHeatmap = heatmapRows.map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        hits: Number(r.hits),
      }));

      // 4. topPages – top 20 API paths by hit count + unique users (30 days)
      const topPages = await db.select({
        path: activityLogs.path,
        hits: count(),
        uniqueUsers: countDistinct(activityLogs.userId),
      }).from(activityLogs)
        .where(gte(activityLogs.createdAt, thirtyDaysAgo))
        .groupBy(activityLogs.path)
        .orderBy(desc(count()))
        .limit(20);

      res.json({
        featureUsage,
        featureDaily,
        featureDailyKeys,
        hourlyHeatmap: hourlyHeatmap.map((r) => ({ ...r, hits: Number(r.hits) })),
        topPages: topPages.map((r) => ({ path: r.path, hits: Number(r.hits), uniqueUsers: Number(r.uniqueUsers) })),
      });
    } catch (error) {
      console.error("Admin usage summary error:", error);
      res.status(500).json({ error: "Failed to fetch usage summary" });
    }
  });

  app.get("/api/admin/check", isAuthenticated, async (req: any, res: Response) => {
    const email = req.user?.claims?.email;
    res.json({ isAdmin: email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false });
  });
}
