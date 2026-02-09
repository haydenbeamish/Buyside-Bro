import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ThumbsUp,
  ThumbsDown,
  Minus,
  Building2,
} from "lucide-react";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { StockSearch } from "@/components/stock-search";

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

interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
}

interface ForwardMetrics {
  ticker: string;
  forwardPE: number | null;
  forwardEpsGrowth: number | null;
  pegRatio: number | null;
  currentEps: number | null;
  estimatedEps: number | null;
}


function TradingViewChart({ ticker, exchange }: { ticker: string; exchange?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';

    // Build TradingView symbol: ASX stocks need "ASX:" prefix without .AX suffix
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

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      hide_legend: true,
      hide_volume: false,
      hotlist: false,
      interval: "D",
      locale: "en",
      save_image: false,
      style: "1",
      symbol: tvSymbol,
      theme: "dark",
      timezone: "Etc/UTC",
      backgroundColor: "#09090b",
      gridColor: "rgba(242, 242, 242, 0.06)",
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: true,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [ticker, exchange]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden" style={{ height: "600px" }}>
      <style>{`.tradingview-widget-container, .tradingview-widget-container > div, .tradingview-widget-container iframe { height: 100% !important; width: 100% !important; }`}</style>
      <div
        className="tradingview-widget-container"
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  isLoading,
  colorClass
}: {
  label: string;
  value: string;
  isLoading: boolean;
  colorClass?: string;
}) {
  const zeroValues = ["—", "N/A", "$0", "$0.00", "0.00", "0.00%", "$0.0", "0.0", "0.0%", "0.00x", "0.0x"];
  if (!isLoading && (zeroValues.includes(value) || value === "")) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-3">
      <p className="text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-20 bg-zinc-800" />
      ) : (
        <p className={`text-sm sm:text-lg font-bold font-mono truncate ${colorClass || "text-white"}`}>
          {value}
        </p>
      )}
    </div>
  );
}

function MetricsGrid({
  profile,
  financials,
  forwardMetrics,
  profileLoading,
  financialsLoading,
  metricsLoading
}: {
  profile?: StockProfile;
  financials?: Financials;
  forwardMetrics?: ForwardMetrics;
  profileLoading: boolean;
  financialsLoading: boolean;
  metricsLoading: boolean;
}) {
  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatLargeNumber = (value: number | undefined, prefix = "") => {
    if (value === undefined || value === null || value === 0) return "N/A";
    if (value >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`;
    return `${prefix}${value.toLocaleString()}`;
  };

  const isASX = profile?.symbol?.endsWith(".AX") || false;
  const dayChangeColor = (profile?.changesPercentage ?? 0) >= 0 ? "text-green-500" : "text-red-500";
  const epsGrowthColor = (forwardMetrics?.forwardEpsGrowth ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-500" />
        Key Metrics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        <MetricCard
          label="Market Cap"
          value={profile?.marketCap != null ? formatMarketCap(profile.marketCap) : "—"}
          isLoading={profileLoading}
        />
        <MetricCard
          label="Enterprise Value"
          value={financials?.enterpriseValue != null ? formatMarketCap(financials.enterpriseValue) : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Price"
          value={profile?.price != null ? `$${profile.price.toFixed(2)}` : "—"}
          isLoading={profileLoading}
        />
        <MetricCard
          label="Day Change"
          value={profile?.changesPercentage != null
            ? `${profile.changesPercentage >= 0 ? "+" : ""}${profile.changesPercentage.toFixed(2)}%`
            : "—"}
          isLoading={profileLoading}
          colorClass={dayChangeColor}
        />
        <MetricCard
          label="P/E (Forward)"
          value={forwardMetrics?.forwardPE != null ? `${forwardMetrics.forwardPE.toFixed(1)}x` : "—"}
          isLoading={metricsLoading}
        />
        <MetricCard
          label="P/E (Trailing)"
          value={financials?.peRatio != null ? financials.peRatio.toFixed(2) : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Fwd EPS Growth"
          value={forwardMetrics?.forwardEpsGrowth != null
            ? `${forwardMetrics.forwardEpsGrowth >= 0 ? "+" : ""}${forwardMetrics.forwardEpsGrowth.toFixed(1)}%`
            : "—"}
          isLoading={metricsLoading}
          colorClass={epsGrowthColor}
        />
        <MetricCard
          label="PEG Ratio"
          value={forwardMetrics?.pegRatio != null ? forwardMetrics.pegRatio.toFixed(2) : "—"}
          isLoading={metricsLoading}
        />
        <MetricCard
          label={isASX ? "EV/EBIT (Forward)" : "EV/EBIT (Trailing)"}
          value={financials?.evToEbit != null ? `${financials.evToEbit.toFixed(1)}x` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Dividend Yield"
          value={financials?.dividendYield != null ? `${(financials.dividendYield * 100).toFixed(2)}%` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Revenue"
          value={formatLargeNumber(financials?.revenue, "$")}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Net Income"
          value={formatLargeNumber(financials?.netIncome, "$")}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="ROE"
          value={financials?.roe != null ? `${(financials.roe * 100).toFixed(2)}%` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Debt/Equity"
          value={financials?.debtToEquity != null ? `${(financials.debtToEquity * 100).toFixed(1)}%` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="P/B Ratio"
          value={financials?.pbRatio != null ? financials.pbRatio.toFixed(2) : "N/A"}
          isLoading={financialsLoading}
        />
      </div>
    </div>
  );
}

function RecommendationBadge({ action, confidence }: { action: string; confidence: number }) {
  const actionLower = action?.toLowerCase() || "hold";
  let bgColor = "bg-zinc-700";
  let textColor = "text-zinc-300";
  let Icon = Minus;
  
  if (actionLower === "buy" || actionLower === "strong buy") {
    bgColor = "bg-green-600";
    textColor = "text-white";
    Icon = ThumbsUp;
  } else if (actionLower === "sell" || actionLower === "strong sell") {
    bgColor = "bg-red-600";
    textColor = "text-white";
    Icon = ThumbsDown;
  }
  
  return (
    <div className="flex items-center gap-3">
      <div className={`${bgColor} ${textColor} px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-lg`}>
        <Icon className="h-5 w-5" />
        {action?.toUpperCase() || "HOLD"}
      </div>
      <div className="text-sm text-zinc-400">
        <span className="font-mono text-white">{confidence}%</span> confidence
      </div>
    </div>
  );
}

function MarkdownSection({ content }: { content: string }) {
  const sections = content.split(/(?=^## )/m);
  
  return (
    <div className="space-y-6 prose prose-invert max-w-none">
      {sections.map((section, idx) => {
        const lines = section.trim().split('\n');
        const titleMatch = lines[0]?.match(/^## (.+)/);
        const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '') : null;
        const body = title ? lines.slice(1).join('\n').trim() : section.trim();
        
        if (!body && !title) return null;
        
        return (
          <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
            {title && (
              <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {title}
              </h3>
            )}
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {body.split('\n').map((line, i) => {
                const clean = line.replace(/\*\*/g, '');
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{clean.substring(2)}</span>
                    </div>
                  );
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="font-semibold text-white mb-2">{clean}</p>;
                }
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="mb-1">{clean}</p>;
              })}
            </div>
          </div>
        );
      })}
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
        const baseProgress = Math.min(apiProgress, 95);
        const timeBasedProgress = Math.min(elapsed * 0.5, 94);
        const newProgress = Math.max(baseProgress, timeBasedProgress, prev);
        const increment = 0.1 + Math.random() * 0.3;
        const nextProgress = Math.min(newProgress + increment, 95);
        return nextProgress;
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
              <p className={`text-2xl font-bold font-mono ${!isNaN(upside) && upside >= 0 ? "text-green-500" : "text-red-500"}`}>
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

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
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
  useDocumentTitle("Company Analysis");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlTicker = urlParams.get("ticker");
  const urlJobId = urlParams.get("jobId");

  const [searchTicker, setSearchTicker] = useState(urlTicker || "MSFT");
  const [activeTicker, setActiveTicker] = useState<string | null>(urlTicker || "MSFT");
  const [deepJobId, setDeepJobId] = useState<string | null>(urlJobId || null);
  const [deepJobStatus, setDeepJobStatus] = useState<JobStatus | null>(
    urlJobId ? { jobId: urlJobId, status: "pending", progress: 0, message: "Starting analysis..." } : null
  );
  const [deepResult, setDeepResult] = useState<DeepAnalysisResult | null>(null);
  const [deepError, setDeepError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptRef = useRef<number>(0);
  const deepResultCache = useRef<Record<string, DeepAnalysisResult>>({});

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

  const { data: financials, isLoading: financialsLoading } = useQuery<Financials>({
    queryKey: ["/api/analysis/financials", activeTicker],
    enabled: !!activeTicker,
  });


  const { data: forwardMetrics, isLoading: metricsLoading } = useQuery<ForwardMetrics>({
    queryKey: ["/api/analysis/forward", activeTicker],
    enabled: !!activeTicker,
  });


  const startDeepAnalysis = useMutation({
    mutationFn: async (ticker: string) => {
      const res = await apiRequest("POST", `/api/analysis/deep/${ticker}`);
      return res.json();
    },
    onSuccess: (data) => {
      setDeepJobId(data.jobId);
      setDeepJobStatus({ jobId: data.jobId, status: "pending", progress: 0, message: "Starting analysis..." });
      setDeepResult(null);
      setDeepError(null);
      pollAttemptRef.current = 0;
      refetchBroStatus();
    },
    onError: (error: any) => {
      if (error instanceof ApiError && error.status === 429) {
        setShowBroLimit(true);
        return;
      }
      setDeepError("Failed to start analysis. Please try again.");
      console.error("Deep analysis error:", error);
    },
  });

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/analysis/deep/job/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      const status = await res.json();
      // Guard against stale updates - only update if this is still the current job
      if (status.jobId !== jobId) {
        return; // Ignore stale update
      }

      if (status.status === "completed") {
        // Fetch result BEFORE updating status so the loader stays visible
        const resultRes = await fetch(`/api/analysis/deep/result/${jobId}`);
        if (resultRes.ok) {
          const result = await resultRes.json();
          setDeepResult(result);
          if (activeTicker) {
            deepResultCache.current[activeTicker] = result;
          }
        } else {
          setDeepError("Failed to load analysis result. Please try again.");
        }
        // Update status after result is set so both render together
        setDeepJobStatus(status);
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      } else if (status.status === "failed") {
        setDeepJobStatus(status);
        setDeepError("Analysis failed. Please try again.");
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      } else {
        setDeepJobStatus(status);
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
    // Schedule next poll with exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
    pollAttemptRef.current += 1;
    const INITIAL_DELAY = 1000;
    const MAX_DELAY = 10000;
    const delay = Math.min(INITIAL_DELAY * Math.pow(2, pollAttemptRef.current), MAX_DELAY);
    pollingRef.current = setTimeout(() => pollJobStatus(jobId), delay);
  }, []);

  useEffect(() => {
    if (deepJobId && deepJobStatus?.status !== "completed" && deepJobStatus?.status !== "failed") {
      pollAttemptRef.current = 0;
      const INITIAL_DELAY = 1000;
      pollingRef.current = setTimeout(() => pollJobStatus(deepJobId), INITIAL_DELAY);
      return () => {
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [deepJobId, deepJobStatus?.status, pollJobStatus]);

  const prevTickerRef = useRef<string | null>(activeTicker);
  useEffect(() => {
    if (activeTicker && activeTicker !== prevTickerRef.current) {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
      setDeepJobId(null);
      setDeepJobStatus(null);
      setDeepError(null);
      setShowCompletionAnimation(false);
      const cached = deepResultCache.current[activeTicker];
      if (cached) {
        setDeepResult(cached);
      } else {
        setDeepResult(null);
      }
    }
    prevTickerRef.current = activeTicker;
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeTicker]);

  useEffect(() => {
    if (!isAuthenticated && activeTicker === "MSFT" && !deepResult && !deepJobId) {
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
  }, [isAuthenticated, activeTicker]);

  const isJobComplete = deepJobStatus?.status === "completed";
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);

  // When job completes, briefly show 100% progress before revealing the result
  useEffect(() => {
    if (isJobComplete && deepResult) {
      setShowCompletionAnimation(true);
      const timer = setTimeout(() => {
        setShowCompletionAnimation(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isJobComplete, deepResult]);

  const isDeepLoading = startDeepAnalysis.isPending ||
    (deepJobStatus?.status === "pending" || deepJobStatus?.status === "processing");

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };


  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1 sm:mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            COMPANY
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base">
            Deep dive into company fundamentals with Bro-powered insights
          </p>
        </div>

        <div className="flex gap-2 max-w-full sm:max-w-md mb-6 sm:mb-8">
          <StockSearch
            value={searchTicker}
            onSelect={(symbol) => setSearchTicker(symbol)}
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
            <Search className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-2">
              Search for a stock to analyze
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              Enter a ticker symbol above to see company profile, financial metrics,
              and Bro-powered analysis.
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32 bg-zinc-800" />
                    <Skeleton className="h-4 w-48 bg-zinc-800" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-10 w-28 ml-auto bg-zinc-800" />
                    <Skeleton className="h-5 w-20 ml-auto bg-zinc-800" />
                  </div>
                </div>
              </div>
            ) : profile ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold font-mono text-white">
                        {profile.symbol}
                      </h2>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {profile.exchange}
                      </Badge>
                    </div>
                    <p className="text-lg text-zinc-300 mb-2">
                      {profile.companyName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {profile.sector}
                      </Badge>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {profile.industry}
                      </Badge>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {formatMarketCap(profile.marketCap)} Market Cap
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono text-white">
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

            {/* Key Metrics Grid - loads immediately */}
            {activeTicker && (
              <MetricsGrid
                profile={profile}
                financials={financials}
                forwardMetrics={forwardMetrics}
                profileLoading={profileLoading}
                financialsLoading={financialsLoading}
                metricsLoading={metricsLoading}
              />
            )}

            {/* Full-width chart */}
            {activeTicker && (
              <TradingViewChart ticker={activeTicker} exchange={profile?.exchange} />
            )}


            {deepError ? (
              <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Analysis Failed</p>
                    <p className="text-sm text-zinc-400">{deepError}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto border-zinc-700"
                    onClick={() => {
                      if (!gate()) return;
                      if (isAtLimit) {
                        setShowBroLimit(true);
                        return;
                      }
                      if (activeTicker) {
                        // Clear error and state before retrying
                        setDeepError(null);
                        setDeepJobId(null);
                        setDeepJobStatus(null);
                        setDeepResult(null);
                        if (pollingRef.current) {
                          clearTimeout(pollingRef.current);
                          pollingRef.current = null;
                        }
                        startDeepAnalysis.mutate(activeTicker);
                      }
                    }}
                    data-testid="button-retry-analysis"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : isDeepLoading || showCompletionAnimation ? (
              <DeepAnalysisLoader
                ticker={activeTicker || ""}
                progress={deepJobStatus?.progress || 0}
                message={showCompletionAnimation ? "Analysis complete!" : (deepJobStatus?.message || "Starting analysis...")}
                isComplete={isJobComplete}
              />
            ) : deepResult ? (
              <DeepAnalysisResult result={deepResult} />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <Brain className="h-10 w-10 text-amber-500/60 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Deep Analysis</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                  Get a comprehensive AI-powered fundamental analysis with buy/hold/sell recommendation for {activeTicker}.
                </p>
                <Button
                  className="bg-amber-600 text-black font-bold uppercase tracking-wider"
                  onClick={() => {
                    if (!gate()) return;
                    if (isAtLimit) {
                      setShowBroLimit(true);
                      return;
                    }
                    if (activeTicker) {
                      setDeepError(null);
                      setDeepJobId(null);
                      setDeepJobStatus(null);
                      setDeepResult(null);
                      if (pollingRef.current) {
                        clearTimeout(pollingRef.current);
                        pollingRef.current = null;
                      }
                      startDeepAnalysis.mutate(activeTicker);
                    }
                  }}
                  disabled={startDeepAnalysis.isPending}
                  data-testid="button-run-deep-analysis"
                >
                  Run Deep Analysis
                </Button>
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
