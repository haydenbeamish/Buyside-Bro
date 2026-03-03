import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { requireApiKey } from "../middleware/apiKey";
import {
  isValidTicker,
  normalizeTicker,
  dedup,
  fetchWithTimeout,
  openrouter,
  LASER_BEAM_API,
  LASER_BEAM_HEADERS,
} from "./shared";
import { recordUsage, checkBroQueryAllowed } from "../creditService";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Returns the hardcoded MSFT fallback analysis used for the homepage hero card
 * when no cached analysis is available.
 */
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

/** Exported so the MSFT cache scheduler in the orchestrator can use it. */
export { getMSFTFallbackAnalysis };

export function registerAnalysisRoutes(app: Express) {
  app.get("/api/analysis/profile/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const fmpUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
      const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;

      const isASX = ticker.endsWith(".AX");

      const profileData = await dedup(`profile_${ticker}`, async () => {
        const [fmpResponse, lbcResponse] = await Promise.all([
          fetchWithTimeout(fmpUrl, {}, 10000).catch(() => null),
          fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 15000).catch(() => null),
        ]);

        const fmpData: any[] = fmpResponse && fmpResponse.ok ? await fmpResponse.json() as any[] : [];
        const fmpProfile = fmpData && fmpData.length > 0 ? fmpData[0] : null;

        let lbcData: any = null;
        if (lbcResponse && lbcResponse.ok) {
          try {
            const lbcRaw = await lbcResponse.json() as any;
            lbcData = lbcRaw?.data || lbcRaw;
          } catch {}
        }

        return { fmpProfile, lbcData };
      });

      const { fmpProfile, lbcData } = profileData;

      // If both sources failed, return appropriate error
      if (!fmpProfile && !lbcData) {
        return res.status(404).json({ error: "Stock not found" });
      }

      const lbcDescription = lbcData?.companyDescription || "";
      const investmentCase = lbcData?.investmentCase || "";

      // For ASX stocks without FMP data, build profile from LBC
      if (!fmpProfile && lbcData) {
        // Derive price from last entry in price history
        const priceHistory = lbcData.charts?.priceHistory5Y || [];
        const lastEntry = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
        const prevEntry = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : null;
        const price = lastEntry?.close || 0;
        const prevPrice = prevEntry?.close || 0;
        const changes = prevPrice ? price - prevPrice : 0;
        const changesPercentage = prevPrice ? ((price - prevPrice) / prevPrice) * 100 : 0;

        return res.json({
          symbol: ticker,
          companyName: lbcData.companyName || ticker,
          sector: "N/A",
          industry: "N/A",
          exchange: isASX ? "ASX" : "N/A",
          marketCap: lbcData.marketCap || 0,
          price,
          changes: Math.round(changes * 1000) / 1000,
          changesPercentage: Math.round(changesPercentage * 100) / 100,
          description: lbcDescription,
          investmentCase,
        });
      }

      // FMP profile exists — use it, but prefer LBC marketCap for ASX stocks
      const profile = fmpProfile!;

      // Truncate long FMP descriptions to first 3 sentences when used as fallback
      let description = lbcDescription;
      if (!description && profile.description) {
        const sentences = profile.description.match(/[^.!?]+[.!?]+/g) || [];
        description = sentences.slice(0, 3).join("").trim();
      }

      res.json({
        symbol: profile.symbol,
        companyName: profile.companyName,
        sector: profile.sector || "N/A",
        industry: profile.industry || "N/A",
        exchange: profile.exchange,
        marketCap: (isASX && lbcData?.marketCap) ? lbcData.marketCap : (profile.marketCap || 0),
        price: profile.price || 0,
        changes: profile.change || 0,
        changesPercentage: profile.changePercentage || 0,
        description: description || "",
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
      const isASX = ticker.endsWith(".AX");

      const financialsData = await dedup(`financials_${ticker}`, async () => {
        const ratiosUrl = `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
        const incomeUrl = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(ticker)}&limit=1&apikey=${process.env.FMP_API_KEY}`;
        const metricsUrl = `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(ticker)}&apikey=${process.env.FMP_API_KEY}`;
        const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;

        const [ratiosRes, incomeRes, metricsRes, lbcResponse] = await Promise.all([
          fetchWithTimeout(ratiosUrl, {}, 10000),
          fetchWithTimeout(incomeUrl, {}, 10000),
          fetchWithTimeout(metricsUrl, {}, 10000),
          isASX ? fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 15000).catch(() => null) : Promise.resolve(null),
        ]);

        const ratios: any[] = ratiosRes.ok ? await ratiosRes.json() as any[] : [];
        const income: any[] = incomeRes.ok ? await incomeRes.json() as any[] : [];
        const metrics: any[] = metricsRes.ok ? await metricsRes.json() as any[] : [];

        const r = ratios[0] || {};
        const i = income[0] || {};
        const m = metrics[0] || {};

        const fmpHasData = Object.keys(r).length > 0 || Object.keys(i).length > 0 || Object.keys(m).length > 0;

        let lbcEV: number | null = null;
        let lbcEvToEbit: number | null = null;
        if (!fmpHasData && lbcResponse && lbcResponse.ok) {
          try {
            const lbcRaw = await lbcResponse.json() as any;
            const lbcData = lbcRaw?.data || lbcRaw;
            lbcEV = typeof lbcData.enterpriseValue === 'number' ? lbcData.enterpriseValue : null;
            lbcEvToEbit = typeof lbcData.trailingEvEbit === 'number' ? lbcData.trailingEvEbit : null;
          } catch {}
        }

        return {
          revenue: i.revenue || 0,
          netIncome: i.netIncome || 0,
          eps: i.eps || r.netIncomePerShareTTM || 0,
          peRatio: r.priceToEarningsRatioTTM || 0,
          pbRatio: r.priceToBookRatioTTM || 0,
          dividendYield: r.dividendYieldTTM || 0,
          roe: m.returnOnEquityTTM || 0,
          debtToEquity: r.debtToEquityRatioTTM || 0,
          enterpriseValue: m.enterpriseValueTTM || lbcEV || null,
          evToEbit: m.enterpriseValueTTM && i.operatingIncome ? m.enterpriseValueTTM / i.operatingIncome : (lbcEvToEbit || null),
        };
      });

      res.json(financialsData);
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
      const historyResult = await dedup(`history_${ticker}`, async () => {
        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const fmpUrl = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(ticker)}&from=${fromDate}&to=${toDate}&apikey=${process.env.FMP_API_KEY}`;

        const response = await fetchWithTimeout(fmpUrl, {}, 10000);
        if (!response.ok) {
          throw new Error(`FMP API error: ${response.status}`);
        }

        const data = await response.json() as any[];
        return (data || []).slice(0, 365).reverse().map((d: any) => ({
          date: d.date,
          price: d.close,
          volume: d.volume,
        }));
      });

      res.json({ ticker, data: historyResult });
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

      const forwardResult = await dedup(`forward_${ticker}`, async () => {
        const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;
        const lbcResponse = await fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 10000);

        if (!lbcResponse.ok) {
          return null;
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

        return { forwardPE, forwardEpsGrowth, pegRatio };
      });

      if (!forwardResult) {
        return res.status(502).json({ error: "Failed to fetch forward metrics from data source" });
      }

      res.json({
        ticker,
        ...forwardResult,
        currentEps: null,
        estimatedEps: null,
      });
    } catch (error) {
      console.error("Forward metrics error:", error);
      res.status(500).json({ error: "Failed to fetch forward metrics" });
    }
  });

  app.get("/api/analysis/company-metrics/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);

      const metrics = await dedup(`company_metrics_${ticker}`, async () => {
        const lbcUrl = `${LASER_BEAM_API}/api/stock/quick-summary/${encodeURIComponent(ticker)}`;
        const lbcResponse = await fetchWithTimeout(lbcUrl, { headers: LASER_BEAM_HEADERS }, 15000);

        if (!lbcResponse.ok) {
          return null;
        }

        const lbcRaw = await lbcResponse.json() as any;
        const lbcData = lbcRaw?.data || lbcRaw;
        const km = lbcData?.keyMetrics;

        if (!km) {
          return null;
        }

        return {
          ticker,
          // Ratios
          currentYearPS: km.ratios?.currentYearPS ?? null,
          forwardYearPS: km.ratios?.forwardYearPS ?? null,
          currentYearPE: km.ratios?.currentYearPE ?? null,
          forwardYearPE: km.ratios?.forwardYearPE ?? null,
          // Growth
          currentYearSalesGrowth: km.growth?.currentYearSalesGrowth ?? null,
          nextYearSalesGrowth: km.growth?.nextYearSalesGrowth ?? null,
          currentYearEarningsGrowth: km.growth?.currentYearEarningsGrowth ?? null,
          nextYearEarningsGrowth: km.growth?.nextYearEarningsGrowth ?? null,
          // Financial Metrics
          currentYearDividendYield: km.financialMetrics?.dividendYield ?? null,
          roe: km.financialMetrics?.roe ?? null,
          debtToEquity: km.financialMetrics?.debtToEquity ?? null,
          pbRatio: km.financialMetrics?.priceToBook ?? null,
        };
      });

      if (!metrics) {
        return res.status(502).json({ error: "Failed to fetch company metrics from data source" });
      }

      res.json(metrics);
    } catch (error) {
      console.error("Company metrics error:", error);
      res.status(500).json({ error: "Failed to fetch company metrics" });
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

  app.get("/api/analysis/filings/:ticker", async (req: any, res: Response) => {
    try {
      const rawTicker = req.params.ticker as string;
      if (!isValidTicker(rawTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }
      const ticker = normalizeTicker(rawTicker);
      const material = req.query.material === "true";
      const filings = await dedup(`filings_${ticker}_${material}`, async () => {
        const response = await fetchWithTimeout(
          `${LASER_BEAM_API}/api/news/${encodeURIComponent(ticker)}?limit=${material ? 20 : 5}`,
          { headers: LASER_BEAM_HEADERS },
          10000
        );
        if (!response.ok) {
          return { ticker, source: "unknown", announcements: [] };
        }
        const json = await response.json() as any;
        const result = json.data || json;
        if (result.announcements) {
          result.announcements = result.announcements.map((a: any) => ({
            ...a,
            items: typeof a.items === "string" ? a.items.split(",").map((s: string) => s.trim()) : a.items,
            itemDescriptions: typeof a.itemDescriptions === "string" ? a.itemDescriptions.split(";").map((s: string) => s.trim()) : a.itemDescriptions,
          }));
          if (material) {
            const materialFormTypes = new Set(["8-K", "10-K", "10-Q"]);
            result.announcements = result.announcements.filter((a: any) => {
              if (result.source === "asx") {
                return a.priceSensitive === true;
              }
              return materialFormTypes.has(a.form);
            });
            result.announcements = result.announcements.slice(0, 5);
          }
        }
        return result;
      });
      res.json(filings);
    } catch (error) {
      console.error("Filings error:", error);
      res.json({ ticker: req.params.ticker, source: "unknown", announcements: [] });
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

  // Streaming deep analysis endpoint using Laser Beam Capital API
  app.post("/api/fundamental-analysis/analyze/stream", requireApiKey, isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      const { ticker, model, mode } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }
      const upperTicker = ticker.toUpperCase();
      if (!isValidTicker(upperTicker)) {
        return res.status(400).json({ error: "Invalid ticker symbol" });
      }

      const analysisMode = mode || "deep_dive";

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

      const upstreamResponse = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...LASER_BEAM_HEADERS },
        body: JSON.stringify({
          ticker: upperTicker,
          model: model || "moonshotai/kimi-k2.5",
          mode: analysisMode,
        }),
      });

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        console.error("Streaming analysis failed:", upstreamResponse.status, errorText);
        return res.status(upstreamResponse.status).json({ error: "Failed to start streaming analysis" });
      }

      // Log usage for daily Bro query counter
      if (userId) {
        await recordUsage(userId, 'deep_analysis', 'laserbeam/fundamental', 0, 0);
      }

      // Upsert a "streaming" row so frontend knows analysis is in-flight
      if (userId) {
        try {
          await db.execute(sql`
            INSERT INTO ai_analysis_results (user_id, ticker, mode, status, analysis, recommendation, error_message, updated_at)
            VALUES (${userId}, ${upperTicker}, ${analysisMode}, 'streaming', '', NULL, NULL, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, ticker, mode) DO UPDATE SET
              status = 'streaming', analysis = '', recommendation = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
          `);
        } catch (e) {
          console.error("Failed to upsert streaming row:", e);
        }
      }

      // Set SSE headers and pipe the upstream stream through
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const upstreamBody = upstreamResponse.body;
      if (!upstreamBody) {
        res.end();
        return;
      }

      // Track client connection state — keep reading upstream even if client leaves
      let clientConnected = true;
      req.on("close", () => {
        clientConnected = false;
      });

      // Accumulate content server-side (mirrors client-side SSE parsing)
      let fullContent = "";
      let recommendation: any = null;
      let streamError: string | null = null;
      let companyName: string | undefined;
      let currentPrice: number | undefined;
      const textDecoder = new TextDecoder();
      let sseBuffer = "";

      const reader = (upstreamBody as any).getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Write to client if still connected
            if (clientConnected) {
              try {
                res.write(value);
              } catch {
                clientConnected = false;
              }
            }

            // Parse SSE lines to accumulate content
            sseBuffer += textDecoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim() || !line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const data = JSON.parse(dataStr);
                const eventType = data.type || data.event;
                switch (eventType) {
                  case "content": {
                    const chunk = data.content || data.text;
                    if (chunk) fullContent += chunk;
                    break;
                  }
                  case "recommendation":
                    recommendation = data.recommendation || data.data || data;
                    break;
                  case "error":
                    streamError = data.message || data.error || "Stream error";
                    break;
                  default: {
                    const fallbackChunk = data.content || data.text;
                    if (fallbackChunk) fullContent += fallbackChunk;
                    break;
                  }
                }
              } catch {
                // ignore JSON parse errors
              }
            }
          }
        } catch (err) {
          console.error("Stream pipe error:", err);
          streamError = streamError || "Stream pipe error";
        } finally {
          if (clientConnected) {
            try { res.end(); } catch {}
          }

          // Save completed result to DB
          if (userId) {
            try {
              const status = streamError ? "error" : "done";
              await db.execute(sql`
                INSERT INTO ai_analysis_results (user_id, ticker, mode, status, analysis, recommendation, company_name, current_price, error_message, updated_at)
                VALUES (${userId}, ${upperTicker}, ${analysisMode}, ${status}, ${fullContent}, ${recommendation ? JSON.stringify(recommendation) : null}::jsonb, ${companyName || null}, ${currentPrice || null}, ${streamError}, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, ticker, mode) DO UPDATE SET
                  status = ${status},
                  analysis = ${fullContent},
                  recommendation = ${recommendation ? JSON.stringify(recommendation) : null}::jsonb,
                  company_name = COALESCE(${companyName || null}, ai_analysis_results.company_name),
                  current_price = COALESCE(${currentPrice || null}, ai_analysis_results.current_price),
                  error_message = ${streamError},
                  updated_at = CURRENT_TIMESTAMP
              `);
            } catch (e) {
              console.error("Failed to save analysis result:", e);
            }
          }
        }
      };

      await pump();
    } catch (error) {
      console.error("Streaming analysis error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to start streaming analysis" });
      } else {
        try { res.end(); } catch {}
      }
    }
  });

  // Get all currently-streaming analyses for the authenticated user
  app.get("/api/analysis/streaming", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const rows = await db.execute(sql`
        SELECT ticker, mode, updated_at
        FROM ai_analysis_results
        WHERE user_id = ${userId} AND status = 'streaming'
      `);

      const items = ((rows as any).rows || rows).map((row: any) => ({
        ticker: row.ticker,
        mode: row.mode,
        updatedAt: row.updated_at,
      }));

      return res.json(items);
    } catch (error) {
      console.error("Failed to fetch streaming analyses:", error);
      res.status(500).json({ error: "Failed to fetch streaming analyses" });
    }
  });

  // Get saved analysis result for a user+ticker+mode
  app.get("/api/analysis/saved/:ticker/:mode", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { ticker, mode } = req.params;
      const upperTicker = ticker.toUpperCase();
      const validModes = ["deep_dive", "earnings_preview", "earnings_review"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }
      if (!isValidTicker(upperTicker)) {
        return res.status(400).json({ error: "Invalid ticker" });
      }

      const rows = await db.execute(sql`
        SELECT ticker, mode, status, recommendation, analysis, company_name, current_price, error_message, updated_at
        FROM ai_analysis_results
        WHERE user_id = ${userId} AND ticker = ${upperTicker} AND mode = ${mode}
        LIMIT 1
      `);

      const row = (rows as any).rows?.[0] || (rows as any)[0];
      if (!row) {
        return res.json(null);
      }

      return res.json({
        ticker: row.ticker,
        mode: row.mode,
        status: row.status,
        recommendation: row.recommendation,
        analysis: row.analysis,
        companyName: row.company_name,
        currentPrice: row.current_price ? parseFloat(row.current_price) : null,
        errorMessage: row.error_message,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      console.error("Failed to fetch saved analysis:", error);
      res.status(500).json({ error: "Failed to fetch saved analysis" });
    }
  });

  // Models endpoint for fundamental analysis
  app.get("/api/fundamental-analysis/models", requireApiKey, async (_req: any, res: Response) => {
    try {
      const response = await fetch(`${LASER_BEAM_API}/api/fundamental-analysis/models`, {
        headers: LASER_BEAM_HEADERS,
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      throw new Error("Upstream failed");
    } catch (error) {
      // Fallback response
      res.json({
        models: [{ id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", provider: "Moonshot AI" }],
      });
    }
  });

  // Deep analysis async job endpoints using Laser Beam Capital API
  // Route used by earnings page (POST body with ticker and mode)
  app.post("/api/fundamental-analysis/jobs", requireApiKey, isAuthenticated, async (req: any, res: Response) => {
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

      const data = await response.json() as any;
      console.log(`[Deep Analysis] Job ${jobId} raw status:`, JSON.stringify({ status: data.status, progress: data.progress }));

      // Normalize status from external API - handle variations
      let status = (data.status || "processing").toLowerCase();
      const progress = data.progress || 0;
      if (status === "complete" || status === "done" || status === "finished" || status === "success") {
        status = "completed";
      }
      if (status === "error" || status === "cancelled") {
        status = "failed";
      }
      // If progress is 100 but status hasn't updated, treat as completed
      if (progress >= 100 && status !== "failed") {
        status = "completed";
      }

      res.json({
        jobId,
        status,
        progress,
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

      const raw = await response.json() as any;
      const data = raw?.data || raw;
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
}
