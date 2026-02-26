import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  ArrowRight,
  Sparkles,
  Brain,
  TrendingUp,
  BarChart3,
  DollarSign,
  Loader2,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { streamAnalysis, StreamError } from "@/lib/stream-analysis";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { StockSearch } from "@/components/stock-search";
import { PercentDisplay } from "@/components/percent-display";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { MarkdownSection } from "@/components/markdown-section";

interface StockProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  exchange: string;
  marketCap: number;
  price: number;
  changes: number;
  changesPercentage: number;
  description: string;
  investmentCase?: string;
}

interface Financials {
  revenue: number;
  netIncome: number;
  eps: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  roe: number;
  debtToEquity: number;
  enterpriseValue?: number;
  evToEbit?: number;
}

interface AIAnalysis {
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  keyPoints: string[];
}

interface DeepAnalysisResult {
  ticker: string;
  mode: string;
  recommendation: {
    action: string;
    confidence: number;
    targetPrice: number;
    upside: number;
    timeHorizon: string;
    reasoning: string;
  };
  analysis: string;
  companyName?: string;
  currentPrice?: number;
}

type StreamState = "idle" | "loading" | "streaming" | "done" | "error";

interface CompanyMetrics {
  ticker: string;
  // Ratios
  currentYearPS: number | null;   // FY0 P/S
  forwardYearPS: number | null;   // FY1 P/S
  currentYearPE: number | null;   // FY0 P/E
  forwardYearPE: number | null;   // FY1 P/E
  // Growth
  currentYearSalesGrowth: number | null;
  nextYearSalesGrowth: number | null;
  currentYearEarningsGrowth: number | null;
  nextYearEarningsGrowth: number | null;
  // Financial metrics
  currentYearDividendYield: number | null;
  roe: number | null;
  debtToEquity: number | null;
  pbRatio: number | null;
}

interface FilingAnnouncement {
  title: string;
  date: string;
  url: string;
  source: string;
  form?: string;
  reportDate?: string;
  accessionNumber?: string;
  items?: string[];
  itemDescriptions?: string[];
  priceSensitive?: boolean;
  time?: string;
  pages?: number;
  fileSize?: string;
}

interface FilingsResponse {
  ticker: string;
  source: "sec_edgar" | "asx" | string;
  announcements: FilingAnnouncement[];
}


function TradingViewChart({ ticker, exchange }: { ticker: string; exchange?: string }) {
  const iframeSrc = useMemo(() => {
    let tvSymbol = ticker;
    if (ticker.endsWith(".AX")) {
      tvSymbol = `ASX:${ticker.replace(".AX", "")}`;
    } else if (exchange) {
      const exchangeMap: Record<string, string> = {
        NASDAQ: "NASDAQ",
        NYSE: "NYSE",
        AMEX: "AMEX",
        LSE: "LSE",
        "London Stock Exchange": "LSE",
        ASX: "ASX",
        "Australian Securities Exchange": "ASX",
      };
      const prefix = exchangeMap[exchange];
      if (prefix && !ticker.includes(":")) {
        tvSymbol = `${prefix}:${ticker}`;
      }
    }

    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval: "D",
      theme: "dark",
      style: "1",
      locale: "en",
      hide_top_toolbar: "1",
      hide_side_toolbar: "1",
      hide_legend: "1",
      allow_symbol_change: "0",
      save_image: "0",
      calendar: "0",
      hide_volume: "0",
      backgroundColor: "rgba(9, 9, 11, 1)",
      gridColor: "rgba(242, 242, 242, 0.06)",
    });

    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [ticker, exchange]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-[350px] sm:h-[500px] lg:h-[600px]">
      <iframe
        src={iframeSrc}
        style={{ width: "100%", height: "100%", border: "none" }}
        allowFullScreen
        loading="lazy"
        data-testid="chart-tradingview"
      />
    </div>
  );
}

function MetricsTable({
  companyMetrics,
  companyMetricsLoading,
}: {
  companyMetrics?: CompanyMetrics;
  companyMetricsLoading: boolean;
}) {
  const formatPercent = (value: number | null | undefined, signed = false) => {
    if (value === null || value === undefined) return "—";
    const prefix = signed && value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}%`;
  };

  const formatMultiple = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return `${value.toFixed(1)}x`;
  };

  const growthColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "text-white";
    return value >= 0 ? "text-gain" : "text-loss";
  };

  const MetricValue = ({ value, isLoading, colorClass }: { value: string; isLoading: boolean; colorClass?: string }) => (
    <td className="px-3 py-2 text-right font-mono text-sm">
      {isLoading ? (
        <Skeleton className="h-4 w-16 bg-zinc-800 ml-auto" />
      ) : (
        <span className={colorClass || "text-white"}>{value}</span>
      )}
    </td>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <tr>
      <td colSpan={2} className="px-3 pt-3 pb-1">
        <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">{title}</span>
      </td>
    </tr>
  );

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-500" />
        Key Metrics
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-zinc-800/50">
            {/* Ratios */}
            <SectionHeader title="Ratios" />
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">P/S (FY0)</td>
              <MetricValue
                value={formatMultiple(companyMetrics?.currentYearPS)}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">P/S (FY1)</td>
              <MetricValue
                value={formatMultiple(companyMetrics?.forwardYearPS)}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">P/E (FY0)</td>
              <MetricValue
                value={formatMultiple(companyMetrics?.currentYearPE)}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">P/E (FY1)</td>
              <MetricValue
                value={formatMultiple(companyMetrics?.forwardYearPE)}
                isLoading={companyMetricsLoading}
              />
            </tr>

            {/* Growth */}
            <SectionHeader title="Growth" />
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Sales Growth (FY0)</td>
              <MetricValue
                value={formatPercent(companyMetrics?.currentYearSalesGrowth, true)}
                isLoading={companyMetricsLoading}
                colorClass={growthColor(companyMetrics?.currentYearSalesGrowth)}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Sales Growth (FY1)</td>
              <MetricValue
                value={formatPercent(companyMetrics?.nextYearSalesGrowth, true)}
                isLoading={companyMetricsLoading}
                colorClass={growthColor(companyMetrics?.nextYearSalesGrowth)}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Earnings Growth (FY0)</td>
              <MetricValue
                value={formatPercent(companyMetrics?.currentYearEarningsGrowth, true)}
                isLoading={companyMetricsLoading}
                colorClass={growthColor(companyMetrics?.currentYearEarningsGrowth)}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Earnings Growth (FY1)</td>
              <MetricValue
                value={formatPercent(companyMetrics?.nextYearEarningsGrowth, true)}
                isLoading={companyMetricsLoading}
                colorClass={growthColor(companyMetrics?.nextYearEarningsGrowth)}
              />
            </tr>

            {/* Financial Metrics */}
            <SectionHeader title="Financial Metrics" />
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Dividend Yield (FY0)</td>
              <MetricValue
                value={companyMetrics?.currentYearDividendYield != null
                  ? `${companyMetrics.currentYearDividendYield.toFixed(2)}%`
                  : "—"}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">ROE</td>
              <MetricValue
                value={companyMetrics?.roe != null
                  ? `${companyMetrics.roe.toFixed(1)}%`
                  : "—"}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">Debt / Equity</td>
              <MetricValue
                value={companyMetrics?.debtToEquity != null
                  ? `${companyMetrics.debtToEquity.toFixed(1)}%`
                  : "—"}
                isLoading={companyMetricsLoading}
              />
            </tr>
            <tr className="hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-sm text-zinc-400">P/B Ratio</td>
              <MetricValue
                value={companyMetrics?.pbRatio != null
                  ? `${companyMetrics.pbRatio.toFixed(2)}x`
                  : "—"}
                isLoading={companyMetricsLoading}
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentFilings({ ticker }: { ticker: string }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [importantOnly, setImportantOnly] = useState(true);

  const { data: filings, isLoading } = useQuery<FilingsResponse>({
    queryKey: ["/api/analysis/filings", ticker, importantOnly],
    queryFn: async () => {
      const params = importantOnly ? "?material=true" : "";
      const res = await apiRequest("GET", `/api/analysis/filings/${encodeURIComponent(ticker)}${params}`);
      return res.json();
    },
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });

  const isValidDate = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
  };

  const hasAnyInvalidDate = useMemo(() => {
    return filings?.announcements?.some(f => !isValidDate(f.date) || (f.reportDate && !isValidDate(f.reportDate)));
  }, [filings?.announcements]);
  const showDates = !hasAnyInvalidDate;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-500" />
          Recent Announcements
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!filings?.announcements?.length) return null;

  const isOfficialSource = filings.source === "sec_edgar" || filings.source === "asx";
  const heading = isOfficialSource ? "Recent Announcements" : "Recent News";

  const getFormBadge = (filing: FilingAnnouncement) => {
    if (filings.source === "asx") {
      if (filing.priceSensitive) {
        return <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 shrink-0">Price Sensitive</Badge>;
      }
      return null;
    }
    const form = filing.form || "";
    let color = "bg-zinc-700 text-zinc-300";
    if (form === "8-K") color = "bg-amber-600 text-white";
    else if (form === "10-K" || form === "10-Q") color = "bg-blue-600 text-white";
    else if (form === "DEF 14A" || form === "DEFA14A") color = "bg-purple-600 text-white";
    else if (form.startsWith("S-1") || form.startsWith("S-4")) color = "bg-green-600 text-white";
    if (!form) return null;
    return <Badge className={`${color} text-[10px] px-1.5 py-0 shrink-0`}>{form}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-500" />
          {heading}
        </h3>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-zinc-400">Important only</span>
          <Switch checked={importantOnly} onCheckedChange={setImportantOnly} />
        </label>
      </div>
      <div className="space-y-2">
        {filings.announcements.map((filing, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                {getFormBadge(filing)}
                <span className={`text-sm text-zinc-200 flex-1 ${isExpanded ? "" : "truncate"}`}>
                  {filing.title}
                </span>
                {showDates && formatDate(filing.date) && <span className="text-xs text-zinc-500 shrink-0">{formatDate(filing.date)}</span>}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                )}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-zinc-800 pt-2 space-y-2">
                  {filing.itemDescriptions?.length ? (
                    <div className="space-y-1">
                      {filing.itemDescriptions.map((desc, i) => (
                        <p key={i} className="text-xs text-zinc-400">• {desc}</p>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    <span>Source: {filings.source === "sec_edgar" ? "SEC EDGAR" : "ASX"}</span>
                    {showDates && filing.reportDate && formatDate(filing.reportDate) && <span>Report date: {formatDate(filing.reportDate)}</span>}
                    {filing.pages && <span>{filing.pages} pages</span>}
                    {filing.fileSize && <span>{filing.fileSize}</span>}
                  </div>
                  {filing.url && (
                    <a
                      href={filing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      View filing <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeepAnalysisLoader({ ticker, progress: apiProgress, message, isComplete }: { ticker: string; progress: number; message: string; isComplete?: boolean }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [startTime] = useState(() => Date.now());
  
  useEffect(() => {
    if (isComplete) {
      setAnimatedProgress(100);
      return;
    }
    
    const interval = setInterval(() => {
      setAnimatedProgress(prev => {
        const elapsed = (Date.now() - startTime) / 1000;
        const baseProgress = Math.min(apiProgress, 99);
        // Time-based progress: reach ~80% over 4 minutes, leave room for fast finish
        const timeBasedProgress = Math.min(elapsed * 0.33, 80);
        const newProgress = Math.max(baseProgress, timeBasedProgress, prev);
        // Slow start, fast finish: accelerate through the last 20%
        const speed = newProgress >= 80 ? 0.4 + (newProgress - 80) * 0.03 : 0.02 + newProgress * 0.001;
        const increment = speed * (0.8 + Math.random() * 0.4);
        return Math.min(newProgress + increment, 99);
      });
    }, 150);
    
    return () => clearInterval(interval);
  }, [apiProgress, isComplete, startTime]);
  
  const displayProgress = isComplete ? 100 : Math.floor(animatedProgress);
  
  const loadingStages = [
    { label: "Gathering data", threshold: 20, icon: Search },
    { label: "Analyzing financials", threshold: 40, icon: BarChart3 },
    { label: "Evaluating market position", threshold: 60, icon: TrendingUp },
    { label: "Running Bro analysis", threshold: 80, icon: Brain },
    { label: "Generating recommendation", threshold: 100, icon: Target },
  ];
  
  const stageIndex = loadingStages.findIndex(s => displayProgress < s.threshold);
  const currentStage = stageIndex === -1 ? loadingStages.length - 1 : stageIndex;
  
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/20 border border-amber-500/30 rounded-lg p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.05),transparent_70%)]" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Brain className="h-7 w-7 text-amber-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-white">Deep Analysis in Progress</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Analyzing <span className="font-mono text-amber-400">{ticker}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">{displayProgress}%</p>
          </div>
        </div>
        
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-150"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        {displayProgress >= 80 && !isComplete && (
          <p className="text-sm text-amber-400/80 text-center mb-4 animate-pulse">
            Hang tight — Bro is crunching the numbers. Deep analysis can take up to 5 minutes.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {loadingStages.map((stage, i) => {
            const isActive = i === currentStage;
            const isComplete = displayProgress >= stage.threshold;
            return (
              <div
                key={stage.label}
                className={`text-center p-2 sm:p-3 rounded-lg transition-all ${
                  isActive ? "bg-amber-500/20 border border-amber-500/50" :
                  isComplete ? "bg-zinc-800" : "bg-zinc-900/50"
                }`}
              >
                <stage.icon className={`h-5 w-5 mx-auto mb-2 ${
                  isActive ? "text-amber-400 animate-pulse" :
                  isComplete ? "text-amber-500" : "text-zinc-600"
                }`} />
                <p className={`text-xs ${
                  isActive ? "text-amber-400" :
                  isComplete ? "text-zinc-400" : "text-zinc-600"
                }`}>
                  {stage.label}
                </p>
                {isComplete && <CheckCircle2 className="h-3 w-3 text-amber-500 mx-auto mt-1" />}
              </div>
            );
          })}
        </div>
        
        {message && (
          <p className="text-sm text-zinc-500 mt-4 text-center font-mono">{message}</p>
        )}
      </div>
    </div>
  );
}

function DeepAnalysisResult({ result }: { result: DeepAnalysisResult }) {
  const rec = result.recommendation;
  const targetPrice = rec?.targetPrice != null ? Number(rec.targetPrice) : NaN;
  const upside = rec?.upside != null ? Number(rec.upside) : NaN;
  const confidence = rec?.confidence != null ? Number(rec.confidence) : 50;
  const analysisText = typeof result.analysis === "string" ? result.analysis : "";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/10 border border-amber-500/20 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-amber-500" />
              <h3 className="font-bold text-xl text-white">Analysis Complete</h3>
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 uppercase text-xs">
                {result.mode || "Deep Dive"}
              </Badge>
            </div>
            <RecommendationBadge action={rec?.action || "Hold"} confidence={confidence} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:text-right">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Target Price</p>
              <p className="text-2xl font-bold font-mono text-white">
                {!isNaN(targetPrice) ? `$${targetPrice.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Upside</p>
              <p className={`text-2xl font-bold font-mono ${!isNaN(upside) && upside >= 0 ? "text-gain" : "text-loss"}`}>
                {!isNaN(upside) ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {rec?.timeHorizon && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <Clock className="h-4 w-4" />
            Time horizon: <span className="text-white">{rec.timeHorizon}</span>
          </div>
        )}

        {rec?.reasoning && (
          <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <p className="text-sm text-zinc-300 leading-relaxed">{rec.reasoning}</p>
          </div>
        )}
      </div>

      {analysisText && (
        <MarkdownSection content={analysisText} />
      )}
    </div>
  );
}

function AILoadingAnimation({ ticker }: { ticker: string }) {
  const loadingMessages = [
    "Analyzing fundamentals...",
    "Crunching the numbers...",
    "Reviewing financial statements...",
    "Evaluating market position...",
    "Assessing growth potential...",
  ];
  
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loadingMessages.length]);

  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/20 border border-amber-500/30 rounded-lg p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.05),transparent_70%)]" />

      <div className="relative flex items-start gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Brain className="h-6 w-6 text-amber-500 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-white">Bro's Brain is Working</h3>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 animate-pulse">
              analyzing {ticker}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-amber-400 font-mono animate-pulse">
                {loadingMessages[messageIndex]}
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: TrendingUp, label: "Trends" },
                { icon: BarChart3, label: "Metrics" },
                { icon: DollarSign, label: "Value" },
                { icon: Sparkles, label: "Insights" },
              ].map((item, i) => (
                <div 
                  key={item.label}
                  className="bg-zinc-800/50 rounded-lg p-2 flex flex-col items-center gap-1 border border-zinc-700/50"
                  style={{ 
                    animation: 'pulse 2s ease-in-out infinite',
                    animationDelay: `${i * 200}ms`
                  }}
                >
                  <item.icon className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs text-zinc-600">{item.label}</span>
                </div>
              ))}
            </div>
            
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 rounded-full"
                style={{
                  width: '60%',
                  animation: 'loading-bar 2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; opacity: 0.5; }
          50% { width: 70%; opacity: 1; }
          100% { width: 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function AnalysisPage() {
  useDocumentTitle("Company Analysis", "Hedge fund quality deep dive stock analysis with BUY/HOLD/SELL recommendations, confidence scores, and target prices. Expert research using SEC filings, financials, and multiple analytical models on Buy Side Bro.");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlTicker = urlParams.get("ticker");

  const [searchTicker, setSearchTicker] = useState(urlTicker || "MSFT");
  const [activeTicker, setActiveTicker] = useState<string | null>(urlTicker || "MSFT");
  const [deepResult, setDeepResult] = useState<DeepAnalysisResult | null>(null);
  const [deepError, setDeepError] = useState<string | null>(null);
  const deepResultCache = useRef<Record<string, DeepAnalysisResult>>({});

  // Streaming state
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRecommendation, setStreamingRecommendation] = useState<any>(null);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamMessage, setStreamMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentBufferRef = useRef("");
  const renderFrameRef = useRef<number | null>(null);

  const { gate, showLoginModal, closeLoginModal, isAuthenticated } = useLoginGate();
  const { isAtLimit, refetch: refetchBroStatus } = useBroStatus();
  const [showBroLimit, setShowBroLimit] = useState(false);

  const handleAnalyze = useCallback((symbol: string) => {
    if (!isAuthenticated && symbol.toUpperCase() !== "MSFT") {
      if (!gate()) return;
    }
    setSearchTicker(symbol);
    setActiveTicker(symbol);
  }, [isAuthenticated, gate]);

  const { data: profile, isLoading: profileLoading } = useQuery<StockProfile>({
    queryKey: ["/api/analysis/profile", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: financials } = useQuery<Financials>({
    queryKey: ["/api/analysis/financials", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: companyMetrics, isLoading: companyMetricsLoading } = useQuery<CompanyMetrics>({
    queryKey: ["/api/analysis/company-metrics", activeTicker],
    enabled: !!activeTicker,
  });

  const queryClientRef = useQueryClient();

  // Fetch saved analysis result from DB
  const { data: savedResult } = useQuery<{
    ticker: string;
    mode: string;
    status: string;
    recommendation: any;
    analysis: string;
    companyName: string | null;
    currentPrice: number | null;
    updatedAt: string;
  } | null>({
    queryKey: ["/api/analysis/saved", activeTicker, "deep_dive"],
    enabled: !!activeTicker && isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.status === "streaming" ? 3000 : false;
    },
  });

  // Populate deepResult from saved data when returning to the page
  useEffect(() => {
    if (
      savedResult &&
      savedResult.status === "done" &&
      savedResult.analysis &&
      !deepResult &&
      streamState === "idle"
    ) {
      const result: DeepAnalysisResult = {
        ticker: savedResult.ticker,
        mode: savedResult.mode,
        recommendation: savedResult.recommendation?.recommendation || savedResult.recommendation || {
          action: "Hold",
          confidence: 50,
          targetPrice: 0,
          upside: 0,
          timeHorizon: "",
          reasoning: "",
        },
        analysis: savedResult.analysis,
        companyName: savedResult.companyName || undefined,
        currentPrice: savedResult.currentPrice || undefined,
      };
      setDeepResult(result);
      deepResultCache.current[savedResult.ticker] = result;
    }
  }, [savedResult, deepResult, streamState]);

  const handleRunDeepAnalysis = useCallback(async () => {
    if (!gate()) return;
    if (isAtLimit) {
      setShowBroLimit(true);
      return;
    }
    if (!activeTicker) return;

    // Abort any existing stream
    abortControllerRef.current?.abort();
    if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);

    // Reset streaming state
    setStreamState("loading");
    setStreamingContent("");
    setStreamingRecommendation(null);
    setStreamProgress(0);
    setStreamMessage("Starting analysis...");
    setDeepResult(null);
    setDeepError(null);
    contentBufferRef.current = "";

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamAnalysis(
        { ticker: activeTicker, mode: "deep_dive" },
        {
          onProgress: (progress, message) => {
            setStreamProgress(progress);
            setStreamMessage(message);
          },
          onContent: (chunk, fullContent) => {
            contentBufferRef.current = fullContent;
            if (streamState !== "streaming") {
              setStreamState("streaming");
            }
            // Batched rendering via rAF
            if (!renderFrameRef.current) {
              renderFrameRef.current = requestAnimationFrame(() => {
                setStreamingContent(contentBufferRef.current);
                setStreamState("streaming");
                renderFrameRef.current = null;
              });
            }
          },
          onRecommendation: (rec) => {
            setStreamingRecommendation(rec);
          },
          onDone: (fullContent, recommendation) => {
            // Flush any remaining buffered content
            if (renderFrameRef.current) {
              cancelAnimationFrame(renderFrameRef.current);
              renderFrameRef.current = null;
            }
            const result: DeepAnalysisResult = {
              ticker: activeTicker,
              mode: "deep_dive",
              recommendation: recommendation?.recommendation || recommendation || {
                action: "Hold",
                confidence: 50,
                targetPrice: 0,
                upside: 0,
                timeHorizon: "",
                reasoning: "",
              },
              analysis: fullContent,
              companyName: profile?.companyName,
              currentPrice: profile?.price,
            };
            setDeepResult(result);
            deepResultCache.current[activeTicker] = result;
            setStreamState("done");
            refetchBroStatus();
            queryClientRef.invalidateQueries({ queryKey: ["/api/analysis/saved", activeTicker, "deep_dive"] });
          },
          onError: (errorMsg) => {
            setDeepError(errorMsg);
            setStreamState("error");
          },
        },
        controller.signal,
      );
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (err instanceof StreamError && err.status === 429) {
        setShowBroLimit(true);
        setStreamState("idle");
        return;
      }
      setDeepError(err.message || "Failed to start analysis. Please try again.");
      setStreamState("error");
    }
  }, [gate, isAtLimit, activeTicker, profile, refetchBroStatus]);

  // Ticker change: abort stream, reset state, load cached
  const prevTickerRef = useRef<string | null>(activeTicker);
  useEffect(() => {
    if (activeTicker && activeTicker !== prevTickerRef.current) {
      abortControllerRef.current?.abort();
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      setStreamState("idle");
      setStreamingContent("");
      setStreamingRecommendation(null);
      setStreamProgress(0);
      setStreamMessage("");
      setDeepError(null);
      contentBufferRef.current = "";
      const cached = deepResultCache.current[activeTicker];
      if (cached) {
        setDeepResult(cached);
      } else {
        setDeepResult(null);
      }
    }
    prevTickerRef.current = activeTicker;
    return () => {
      abortControllerRef.current?.abort();
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [activeTicker]);

  // Load MSFT cached analysis for unauthenticated users
  useEffect(() => {
    if (!isAuthenticated && activeTicker === "MSFT" && !deepResult && streamState === "idle") {
      fetch("/api/analysis/deep/cached/MSFT")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setDeepResult(data);
            deepResultCache.current["MSFT"] = data;
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, activeTicker, streamState]);

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };


  return (
    <div className="min-h-screen bg-black text-white">
      <div className="page-container">
        <div className="mb-4 sm:mb-6">
          <h1 className="display-font text-xl sm:text-3xl md:text-4xl font-bold tracking-wider text-white mb-1 sm:mb-2">
            COMPANY
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base">
            Deep dive into company fundamentals with Bro Powered insights
          </p>
        </div>

        <div className="flex gap-2 max-w-full sm:max-w-md mb-6 sm:mb-8">
          <StockSearch
            value={searchTicker}
            onSelect={(symbol) => setSearchTicker(symbol)}
            onChangeValue={(val) => setSearchTicker(val)}
            onSubmit={(symbol) => handleAnalyze(symbol)}
            className="flex-1"
            inputTestId="input-search-ticker"
            optionIdPrefix="analysis-option"
          />
          <Button 
            type="button" 
            variant="outline"
            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
            onClick={() => searchTicker.trim() && handleAnalyze(searchTicker.toUpperCase().trim())}
            data-testid="button-search"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {!activeTicker ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-16 text-center">
            <Brain className="h-12 w-12 text-amber-500 mx-auto mb-4 animate-pulse" />
            <h3 className="font-semibold text-white mb-2">
              Search for a stock to analyze
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              Enter a ticker symbol above to see company profile, financial metrics,
              and Bro Powered analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map((ticker) => (
                <Badge
                  key={ticker}
                  variant="outline"
                  className="cursor-pointer border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  onClick={() => {
                    setSearchTicker(ticker);
                    handleAnalyze(ticker);
                  }}
                  data-testid={`quick-search-${ticker}`}
                >
                  {ticker}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 md:px-5 md:py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 md:h-6 w-16 md:w-20 bg-zinc-800" />
                    <Skeleton className="h-4 w-32 md:w-40 bg-zinc-800" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 md:h-6 w-20 md:w-24 bg-zinc-800" />
                    <Skeleton className="h-4 w-12 bg-zinc-800" />
                  </div>
                </div>
              </div>
            ) : profile ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 md:px-5 md:py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg md:text-xl font-bold font-mono text-white">
                      {profile.symbol}
                    </h2>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                      {profile.exchange}
                    </Badge>
                    <span className="text-sm text-zinc-400 truncate hidden sm:inline">
                      {profile.companyName}
                    </span>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs hidden md:inline-flex">
                      {profile.sector}
                    </Badge>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs hidden md:inline-flex">
                      {profile.industry}
                    </Badge>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-sm font-mono font-semibold hidden sm:inline-flex">
                      Mkt Cap {formatMarketCap(profile.marketCap)}
                    </Badge>
                    {financials?.enterpriseValue != null && (
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-sm font-mono font-semibold hidden sm:inline-flex">
                        EV {formatMarketCap(financials.enterpriseValue)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2 md:gap-3">
                    <p className="text-lg md:text-2xl font-bold font-mono text-white">
                      ${profile.price.toFixed(2)}
                    </p>
                    <PercentDisplay value={profile.changesPercentage} />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Company Description & Investment Case */}
            {activeTicker && !profileLoading && (profile?.description || profile?.investmentCase) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                {profile?.description && (
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-amber-500" />
                      About {profile.companyName}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{profile.description}</p>
                  </div>
                )}
                {profile?.investmentCase && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-1">Investment Case</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed">{profile.investmentCase}</p>
                  </div>
                )}
              </div>
            )}

            {/* Key Metrics Table - loads immediately */}
            {activeTicker && (
              <MetricsTable
                companyMetrics={companyMetrics}
                companyMetricsLoading={companyMetricsLoading}
              />
            )}

            {/* Recent Filings */}
            {activeTicker && <RecentFilings ticker={activeTicker} />}

            {/* Full-width chart */}
            {activeTicker && (
              <TradingViewChart ticker={activeTicker} exchange={profile?.exchange} />
            )}


            {deepError || streamState === "error" ? (
              <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Analysis Failed</p>
                    <p className="text-sm text-zinc-400">{deepError || "An error occurred"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto border-zinc-700"
                    onClick={() => {
                      setDeepError(null);
                      setStreamState("idle");
                      handleRunDeepAnalysis();
                    }}
                    data-testid="button-retry-analysis"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : streamState === "loading" ? (
              <DeepAnalysisLoader
                ticker={activeTicker || ""}
                progress={streamProgress}
                message={streamMessage || "Starting analysis..."}
              />
            ) : streamState === "streaming" ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/10 border border-amber-500/20 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="h-6 w-6 text-amber-500 animate-pulse" />
                    <h3 className="font-bold text-xl text-white">Streaming Analysis</h3>
                    <Badge variant="outline" className="border-amber-500/50 text-amber-400 uppercase text-xs">
                      Deep Dive
                    </Badge>
                    <span className="flex items-center gap-1.5 ml-auto">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-400">Live</span>
                    </span>
                  </div>
                  {streamingRecommendation && (
                    <div className="mb-4">
                      <RecommendationBadge
                        action={streamingRecommendation.action || streamingRecommendation.recommendation?.action || "Hold"}
                        confidence={streamingRecommendation.confidence || streamingRecommendation.recommendation?.confidence || 50}
                      />
                    </div>
                  )}
                </div>
                {streamingContent && <MarkdownSection content={streamingContent} />}
              </div>
            ) : deepResult ? (
              <DeepAnalysisResult result={deepResult} />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <Brain className="h-10 w-10 text-amber-500/60 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Deep Analysis</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                  Get a comprehensive hedge fund quality fundamental analysis with buy/hold/sell recommendation for {activeTicker}.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="terminal"
                    className="uppercase tracking-wider"
                    onClick={handleRunDeepAnalysis}
                    disabled={streamState === "loading" || streamState === "streaming"}
                    data-testid="button-run-deep-analysis"
                  >
                    Run Deep Analysis
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
      <BroLimitModal open={showBroLimit} onClose={() => setShowBroLimit(false)} />
    </div>
  );
}
