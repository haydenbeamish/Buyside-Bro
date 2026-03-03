import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { insertTradeSchema } from "@shared/schema";
import { fetchWithTimeout } from "./shared";
import { isProTier } from "../creditService";

export function registerTradingRoutes(app: Express) {
  // Labels endpoints (must be before :id routes to avoid conflict)
  app.get("/api/trades/labels/strategies", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const tags = await storage.getDistinctStrategyTags(userId);
      res.json(tags);
    } catch (error) {
      console.error("Trade labels error:", error);
      res.status(500).json({ error: "Failed to fetch strategy tags" });
    }
  });

  app.get("/api/trades/labels/setups", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const types = await storage.getDistinctSetupTypes(userId);
      res.json(types);
    } catch (error) {
      console.error("Trade labels error:", error);
      res.status(500).json({ error: "Failed to fetch setup types" });
    }
  });

  app.get("/api/trades/labels/sources", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const sources = await storage.getDistinctIdeaSources(userId);
      res.json(sources);
    } catch (error) {
      console.error("Trade labels error:", error);
      res.status(500).json({ error: "Failed to fetch idea sources" });
    }
  });

  // Analytics endpoint (Pro only)
  app.get("/api/trades/analytics", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !isProTier(user)) {
        return res.status(403).json({ error: "Pro subscription required" });
      }

      const allTrades = await storage.getTrades(userId);
      if (allTrades.length === 0) {
        return res.json({
          totalTrades: 0, winRate: 0, profitFactor: 0, expectancy: 0,
          avgWin: 0, avgLoss: 0, sharpeRatio: 0, maxDrawdown: 0, totalPnL: 0,
          winStreak: 0, lossStreak: 0, currentStreak: 0, currentStreakType: null,
          strategyBreakdown: [], ideaSourceBreakdown: [], dayOfWeekPerformance: [],
          holdingPeriodAnalysis: [],
        });
      }

      // Batch-fetch current prices for all unique tickers
      const uniqueTickers = Array.from(new Set(allTrades.map(t => t.ticker)));
      const priceMap = new Map<string, number>();
      const fmpKey = process.env.FMP_API_KEY;
      if (fmpKey) {
        try {
          const symbolParam = uniqueTickers.join(",");
          const quoteRes = await fetchWithTimeout(
            `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbolParam)}&apikey=${fmpKey}`,
            {}, 10000
          );
          if (quoteRes.ok) {
            const quotes = await quoteRes.json() as any[];
            for (const q of quotes) {
              if (q.symbol && q.price) priceMap.set(q.symbol.toUpperCase(), q.price);
            }
          }
        } catch (e) {
          console.error("Failed to fetch batch quotes for analytics:", e);
        }
      }

      // Compute per-trade P&L
      const tradesWithPnL = allTrades.map(t => {
        const entryPrice = parseFloat(t.price);
        const shares = parseFloat(t.shares);
        const currentPrice = priceMap.get(t.ticker.toUpperCase()) || entryPrice;
        let pnl: number;
        if (t.action === "buy") {
          pnl = (currentPrice - entryPrice) * shares;
        } else {
          pnl = (entryPrice - currentPrice) * shares;
        }
        const returnPct = entryPrice > 0 ? ((t.action === "buy" ? currentPrice - entryPrice : entryPrice - currentPrice) / entryPrice) * 100 : 0;
        return { ...t, pnl, returnPct, currentPrice };
      });

      const winners = tradesWithPnL.filter(t => t.pnl > 0);
      const losers = tradesWithPnL.filter(t => t.pnl < 0);
      const totalPnL = tradesWithPnL.reduce((sum, t) => sum + t.pnl, 0);
      const winRate = tradesWithPnL.length > 0 ? (winners.length / tradesWithPnL.length) * 100 : 0;
      const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
      const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0;
      const expectancy = tradesWithPnL.length > 0 ? totalPnL / tradesWithPnL.length : 0;
      const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      // Sharpe ratio (using return %)
      const returns = tradesWithPnL.map(t => t.returnPct);
      const meanReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
      const variance = returns.length > 1 ? returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1) : 0;
      const stdev = Math.sqrt(variance);
      const sharpeRatio = stdev > 0 ? meanReturn / stdev : 0;

      // Max drawdown from cumulative P&L
      let peak = 0, maxDrawdown = 0, cumPnL = 0;
      const sortedByDate = [...tradesWithPnL].sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
      for (const t of sortedByDate) {
        cumPnL += t.pnl;
        if (cumPnL > peak) peak = cumPnL;
        const dd = peak - cumPnL;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      // Win/loss streaks
      let winStreak = 0, lossStreak = 0, currentStreak = 0;
      let currentStreakType: string | null = null;
      let tempWin = 0, tempLoss = 0;
      for (const t of sortedByDate) {
        if (t.pnl > 0) {
          tempWin++;
          tempLoss = 0;
          if (tempWin > winStreak) winStreak = tempWin;
          currentStreak = tempWin;
          currentStreakType = "win";
        } else if (t.pnl < 0) {
          tempLoss++;
          tempWin = 0;
          if (tempLoss > lossStreak) lossStreak = tempLoss;
          currentStreak = tempLoss;
          currentStreakType = "loss";
        } else {
          tempWin = 0;
          tempLoss = 0;
          currentStreak = 0;
          currentStreakType = null;
        }
      }

      // Strategy breakdown
      const stratMap = new Map<string, { count: number; wins: number; totalPnL: number }>();
      for (const t of tradesWithPnL) {
        const key = t.strategyTag || "Untagged";
        const entry = stratMap.get(key) || { count: 0, wins: 0, totalPnL: 0 };
        entry.count++;
        if (t.pnl > 0) entry.wins++;
        entry.totalPnL += t.pnl;
        stratMap.set(key, entry);
      }
      const strategyBreakdown = Array.from(stratMap.entries()).map(([strategy, data]) => ({
        strategy, count: data.count, winRate: (data.wins / data.count) * 100,
        totalPnL: data.totalPnL, expectancy: data.totalPnL / data.count,
      }));

      // Idea source breakdown
      const srcMap = new Map<string, { count: number; wins: number; totalPnL: number }>();
      for (const t of tradesWithPnL) {
        const key = t.ideaSourceName || t.ideaSource || "Unknown";
        const entry = srcMap.get(key) || { count: 0, wins: 0, totalPnL: 0 };
        entry.count++;
        if (t.pnl > 0) entry.wins++;
        entry.totalPnL += t.pnl;
        srcMap.set(key, entry);
      }
      const ideaSourceBreakdown = Array.from(srcMap.entries())
        .map(([source, data]) => ({
          source, count: data.count, winRate: (data.wins / data.count) * 100,
          totalPnL: data.totalPnL,
        }))
        .sort((a, b) => b.totalPnL - a.totalPnL);

      // Day of week performance
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayMap = new Map<number, { count: number; totalPnL: number }>();
      for (const t of tradesWithPnL) {
        const day = new Date(t.tradedAt).getDay();
        const entry = dayMap.get(day) || { count: 0, totalPnL: 0 };
        entry.count++;
        entry.totalPnL += t.pnl;
        dayMap.set(day, entry);
      }
      const dayOfWeekPerformance = Array.from(dayMap.entries()).map(([day, data]) => ({
        day: dayNames[day], count: data.count, avgPnL: data.totalPnL / data.count, totalPnL: data.totalPnL,
      })).sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));

      // Holding period analysis (for buys that have been sold - simplified: use time since trade)
      const buckets = [
        { label: "Intraday", maxDays: 1 },
        { label: "1-7 days", maxDays: 7 },
        { label: "1-4 weeks", maxDays: 28 },
        { label: "1-3 months", maxDays: 90 },
        { label: "3-12 months", maxDays: 365 },
        { label: "1 year+", maxDays: Infinity },
      ];
      const holdingMap = new Map<string, { count: number; totalPnL: number; wins: number }>();
      for (const b of buckets) holdingMap.set(b.label, { count: 0, totalPnL: 0, wins: 0 });
      for (const t of tradesWithPnL) {
        const days = (Date.now() - new Date(t.tradedAt).getTime()) / (1000 * 60 * 60 * 24);
        for (const b of buckets) {
          if (days <= b.maxDays) {
            const entry = holdingMap.get(b.label)!;
            entry.count++;
            entry.totalPnL += t.pnl;
            if (t.pnl > 0) entry.wins++;
            break;
          }
        }
      }
      const holdingPeriodAnalysis = Array.from(holdingMap.entries()).map(([period, data]) => ({
        period, count: data.count, totalPnL: data.totalPnL,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      }));

      res.json({
        totalTrades: tradesWithPnL.length, winRate, profitFactor, expectancy,
        avgWin, avgLoss, sharpeRatio, maxDrawdown, totalPnL,
        winStreak, lossStreak, currentStreak, currentStreakType,
        strategyBreakdown, ideaSourceBreakdown, dayOfWeekPerformance, holdingPeriodAnalysis,
      });
    } catch (error) {
      console.error("Trade analytics error:", error);
      res.status(500).json({ error: "Failed to compute analytics" });
    }
  });

  // Trade CRUD
  app.get("/api/trades", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const allTrades = await storage.getTrades(userId);

      // Batch-fetch current prices for P&L enrichment
      const uniqueTickers = Array.from(new Set(allTrades.map(t => t.ticker.toUpperCase())));
      const priceMap = new Map<string, number>();
      const fmpKey = process.env.FMP_API_KEY;
      if (fmpKey && uniqueTickers.length > 0) {
        try {
          const symbolParam = uniqueTickers.join(",");
          const quoteRes = await fetchWithTimeout(
            `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbolParam)}&apikey=${fmpKey}`,
            {}, 10000
          );
          if (quoteRes.ok) {
            const quotes = await quoteRes.json() as any[];
            for (const q of quotes) {
              if (q.symbol && q.price) priceMap.set(q.symbol.toUpperCase(), q.price);
            }
          }
        } catch (e) {
          console.error("Failed to fetch batch quotes for trades:", e);
        }
      }

      const enrichedTrades = allTrades.map(t => {
        const entryPrice = parseFloat(t.price);
        const shares = parseFloat(t.shares);
        const currentPrice = priceMap.get(t.ticker.toUpperCase()) || null;
        let pnl: number | null = null;
        let returnPct: number | null = null;
        if (currentPrice !== null) {
          pnl = t.action === "buy"
            ? (currentPrice - entryPrice) * shares
            : (entryPrice - currentPrice) * shares;
          returnPct = entryPrice > 0
            ? ((t.action === "buy" ? currentPrice - entryPrice : entryPrice - currentPrice) / entryPrice) * 100
            : 0;
        }
        return { ...t, pnl, returnPct, currentPrice };
      });

      res.json(enrichedTrades);
    } catch (error) {
      console.error("Trades list error:", error);
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  app.get("/api/trades/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id as string);
      const trade = await storage.getTrade(userId, id);
      if (!trade) return res.status(404).json({ error: "Trade not found" });
      res.json(trade);
    } catch (error) {
      console.error("Trade get error:", error);
      res.status(500).json({ error: "Failed to fetch trade" });
    }
  });

  app.post("/api/trades", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !isProTier(user)) {
        return res.status(403).json({ error: "Pro subscription required" });
      }

      const { updatePortfolio, ...tradeData } = req.body;

      // Coerce fields before Zod validation
      if (typeof tradeData.tradedAt === "string") {
        tradeData.tradedAt = new Date(tradeData.tradedAt);
      }
      // Strip empty strings to null for optional text fields
      const optionalTextFields = ["notes", "strategyTag", "setupType", "emotionalState", "ideaSource", "ideaSourceName", "companyName"];
      for (const field of optionalTextFields) {
        if (tradeData[field] === "" || tradeData[field] === undefined) {
          tradeData[field] = null;
        }
      }
      // Ensure shares/price are strings (decimal columns)
      if (typeof tradeData.shares === "number") tradeData.shares = String(tradeData.shares);
      if (typeof tradeData.price === "number") tradeData.price = String(tradeData.price);

      const validation = insertTradeSchema.safeParse(tradeData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }

      // Compute totalValue
      const shares = parseFloat(validation.data.shares);
      const price = parseFloat(validation.data.price);
      const totalValue = (shares * price).toFixed(4);

      const trade = await storage.createTrade(userId, {
        ...validation.data,
        ticker: validation.data.ticker.toUpperCase(),
        totalValue,
      });

      // Optionally update portfolio
      if (updatePortfolio) {
        const ticker = validation.data.ticker.toUpperCase();
        const holdings = await storage.getPortfolioHoldings(userId);
        const existing = holdings.find(h => h.ticker.toUpperCase() === ticker);

        if (validation.data.action === "buy") {
          if (existing) {
            const existingShares = parseFloat(existing.shares);
            const existingCost = parseFloat(existing.avgCost);
            const newTotalShares = existingShares + shares;
            const newAvgCost = ((existingShares * existingCost) + (shares * price)) / newTotalShares;
            await storage.updatePortfolioHolding(userId, existing.id, {
              shares: newTotalShares.toString(),
              avgCost: newAvgCost.toFixed(4),
            });
          } else {
            await storage.createPortfolioHolding(userId, {
              ticker,
              shares: shares.toString(),
              avgCost: price.toFixed(4),
              name: validation.data.companyName || ticker,
              sector: null,
              currentPrice: price.toFixed(4),
            });
          }
        } else if (validation.data.action === "sell") {
          if (existing) {
            const remainingShares = parseFloat(existing.shares) - shares;
            if (remainingShares <= 0) {
              await storage.deletePortfolioHolding(userId, existing.id);
            } else {
              await storage.updatePortfolioHolding(userId, existing.id, {
                shares: remainingShares.toString(),
              });
            }
          }
        }
      }

      res.status(201).json(trade);
    } catch (error) {
      console.error("Trade create error:", error);
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  app.put("/api/trades/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id as string);
      const updated = await storage.updateTrade(userId, id, req.body);
      if (!updated) return res.status(404).json({ error: "Trade not found" });
      res.json(updated);
    } catch (error) {
      console.error("Trade update error:", error);
      res.status(500).json({ error: "Failed to update trade" });
    }
  });

  app.delete("/api/trades/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id as string);
      await storage.deleteTrade(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Trade delete error:", error);
      res.status(500).json({ error: "Failed to delete trade" });
    }
  });
}
