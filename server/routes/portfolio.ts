import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { insertPortfolioHoldingSchema } from "@shared/schema";
import { fetchWithTimeout, openrouter } from "./shared";
import { recordUsage, checkBroQueryAllowed } from "../creditService";

export function registerPortfolioRoutes(app: Express) {
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
        const currentPrice = quote.price ?? profile.price ?? Number(holding.currentPrice ?? avgCost);
        const dayChangePercent = quote.changePercentage ?? profile.changePercentage ?? 0;
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
          marketCap: quote.marketCap ?? profile.marketCap ?? null,
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

  // Auto-generated quick portfolio insights (cached 4 hours, non-streaming)
  app.get("/api/portfolio/quick-insights", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      if (holdings.length === 0) {
        return res.json({ insights: null });
      }

      // Check cache first (4 hours = 240 minutes)
      const cacheKey = `portfolio_insights_${userId}`;
      const cached = await storage.getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Build a concise portfolio summary for the prompt
      const positionSummary = holdings.map(h => {
        const shares = Number(h.shares);
        const currentPrice = Number(h.currentPrice || h.avgCost);
        const avgCost = Number(h.avgCost);
        const pnlPct = avgCost > 0 ? (((currentPrice - avgCost) / avgCost) * 100).toFixed(1) : "0";
        return `${h.ticker} (${shares} shares, ${pnlPct}% P&L)`;
      }).join(", ");

      const completion = await openrouter.chat.completions.create({
        model: "moonshotai/kimi-k2.5",
        messages: [
          {
            role: "system",
            content: "You are a concise portfolio analyst. Give 2-3 brief bullet points about the portfolio's key observations. Keep it under 100 words total. Use Australian spelling. No markdown headers — just bullet points starting with •."
          },
          {
            role: "user",
            content: `Give 2-3 brief bullet points about this portfolio: ${positionSummary}`
          }
        ],
        max_tokens: 200,
      });

      const insights = completion.choices[0]?.message?.content || null;
      if (!insights) {
        return res.json({ insights: null });
      }

      const result = { insights, generatedAt: new Date().toISOString() };
      // Cache for 4 hours (240 minutes)
      await storage.setCachedData(cacheKey, result, 240);

      res.json(result);
    } catch (error) {
      console.error("Portfolio quick insights error:", error);
      res.json({ insights: null });
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
}
