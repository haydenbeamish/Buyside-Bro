import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { streamAnalysis, StreamError } from "@/lib/stream-analysis";
import {
  Search,
  ArrowRight,
  Brain,
  TrendingUp,
  BarChart3,
  DollarSign,
  Loader2,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileSearch,
  Building2,
  Sparkles,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PercentDisplay } from "@/components/percent-display";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { MarkdownSection } from "@/components/markdown-section";

interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

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
}

interface HistoricalPrice {
  date: string;
  price: number;
  volume: number;
}

interface HistoricalData {
  ticker: string;
  data: HistoricalPrice[];
}

interface ForwardMetrics {
  ticker: string;
  forwardPE: number | null;
  forwardEpsGrowth: number | null;
  pegRatio: number | null;
  currentEps: number | null;
  estimatedEps: number | null;
}

interface DeepAnalysisResultData {
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

type AnalysisMode = "preview" | "review" | "deep";
type StreamState = "idle" | "loading" | "streaming" | "done" | "error";

function StockSearchInput({
  value,
  onSelect,
  onSubmit,
}: {
  value: string;
  onSelect: (symbol: string) => void;
  onSubmit: (symbol: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const userTypedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!userTypedRef.current) return;
    const searchStocks = async () => {
      if (query.length < 1) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        if (data.length > 0) setIsOpen(true);
      } catch (e) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    const debounce = setTimeout(searchStocks, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (stock: StockSearchResult) => {
    userTypedRef.current = false;
    setQuery(stock.symbol);
    setResults([]);
    setIsOpen(false);
    onSelect(stock.symbol);
    onSubmit(stock.symbol);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      userTypedRef.current = false;
      setResults([]);
      setIsOpen(false);
      onSubmit(query.toUpperCase().trim());
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search stocks... (e.g., Apple, TSLA, NVDA)"
          value={query}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            userTypedRef.current = true;
            setQuery(val);
            onSelect(val);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white font-mono uppercase"
          data-testid="input-search-ticker"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 animate-spin" />
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
          {results.map((stock, idx) => (
            <button
              key={`${stock.symbol}-${idx}`}
              type="button"
              onClick={() => handleSelect(stock)}
              className="w-full px-3 py-2.5 text-left hover:bg-zinc-700 flex items-center justify-between gap-2 border-b border-zinc-700/50 last:border-0"
              data-testid={`stock-result-${stock.symbol}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-amber-400">{stock.symbol}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded">{stock.exchange}</span>
                </div>
                <p className="text-sm text-zinc-400 truncate">{stock.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StockChart({ data, isLoading }: { data?: HistoricalData; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <Skeleton className="h-5 w-32 bg-zinc-800 mb-4" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
      </div>
    );
  }
  if (!data?.data?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <p className="text-zinc-500 text-center py-8">No chart data available</p>
      </div>
    );
  }
  const chartData = data.data;
  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const priceChange = lastPrice - firstPrice;
  const percentChange = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
  const isPositive = percentChange >= 0;
  const chartColor = isPositive ? "#22c55e" : "#ef4444";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">1 Year Price Chart</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">1Y Return:</span>
          <span className={`font-mono font-semibold ${isPositive ? "text-gain" : "text-loss"}`}>
            {isPositive ? "+" : ""}{percentChange.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-36 sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="earningsChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short" })}
              interval={60}
              axisLine={{ stroke: "#27272a" }}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(val) => `$${val.toFixed(0)}`}
              width={50}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "8px 12px" }}
              labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
              labelFormatter={(label) => new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            />
            <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fill="url(#earningsChartGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KeyInfoCard({
  profile,
  forwardMetrics,
  profileLoading,
  metricsLoading,
}: {
  profile?: StockProfile;
  forwardMetrics?: ForwardMetrics;
  profileLoading: boolean;
  metricsLoading: boolean;
}) {
  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4">
      <h3 className="font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
        <Building2 className="h-4 w-4 text-amber-500" />
        Key Information
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Market Cap</p>
          {profileLoading ? <Skeleton className="h-6 w-20 bg-zinc-800" /> : (
            <p className="font-mono font-bold text-white">{profile?.marketCap != null ? formatMarketCap(profile.marketCap) : "\u2014"}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Forward P/E</p>
          {metricsLoading ? <Skeleton className="h-6 w-16 bg-zinc-800" /> : (
            <p className="font-mono font-bold text-white">{forwardMetrics?.forwardPE != null ? forwardMetrics.forwardPE.toFixed(1) + "x" : "\u2014"}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Forward EPS Growth</p>
          {metricsLoading ? <Skeleton className="h-6 w-16 bg-zinc-800" /> : (
            <p className={`font-mono font-bold ${(forwardMetrics?.forwardEpsGrowth ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
              {forwardMetrics?.forwardEpsGrowth != null ? `${forwardMetrics.forwardEpsGrowth >= 0 ? "+" : ""}${forwardMetrics.forwardEpsGrowth.toFixed(1)}%` : "\u2014"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">PEG Ratio</p>
          {metricsLoading ? <Skeleton className="h-6 w-16 bg-zinc-800" /> : (
            <p className="font-mono font-bold text-white">{forwardMetrics?.pegRatio != null ? forwardMetrics.pegRatio.toFixed(2) : "\u2014"}</p>
          )}
        </div>
      </div>
      {profileLoading ? (
        <div className="space-y-2"><Skeleton className="h-4 w-full bg-zinc-800" /><Skeleton className="h-4 w-3/4 bg-zinc-800" /></div>
      ) : profile?.description ? (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">About</p>
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-4">{profile.description}</p>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisLoader({ ticker, mode, progress: apiProgress, message, isComplete }: { ticker: string; mode: AnalysisMode; progress: number; message: string; isComplete?: boolean }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    if (isComplete) {
      setAnimatedProgress(100);
      return;
    }
    const interval = setInterval(() => {
      setAnimatedProgress((prev) => {
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
  const modeLabel = mode === "preview" ? "Earnings Preview" : mode === "deep" ? "Deep Analysis" : "Earnings Review";

  const loadingStages = [
    { label: "Gathering data", threshold: 20, icon: Search },
    { label: "Analyzing financials", threshold: 40, icon: BarChart3 },
    { label: "Evaluating estimates", threshold: 60, icon: TrendingUp },
    { label: "Running Bro analysis", threshold: 80, icon: Brain },
    { label: "Generating report", threshold: 100, icon: Target },
  ];

  const stageIndex = loadingStages.findIndex((s) => displayProgress < s.threshold);
  const currentStage = stageIndex === -1 ? loadingStages.length - 1 : stageIndex;

  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/20 border border-amber-500/30 rounded-lg p-4 sm:p-8 relative overflow-hidden">
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
              <h3 className="font-bold text-base sm:text-xl text-white">{modeLabel} in Progress</h3>
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
          <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-150" style={{ width: `${displayProgress}%` }} />
        </div>
        {mode === "deep" && displayProgress >= 60 && !isComplete && (
          <p className="text-sm text-amber-400/80 text-center mb-4 animate-pulse">
            Hang tight — Bro is crunching the numbers. Deep analysis can take up to 5 minutes.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {loadingStages.map((stage, i) => {
            const isActive = i === currentStage;
            const isDone = displayProgress >= stage.threshold;
            return (
              <div
                key={stage.label}
                className={`text-center p-2 sm:p-3 rounded-lg transition-all ${isActive ? "bg-amber-500/20 border border-amber-500/50" : isDone ? "bg-zinc-800" : "bg-zinc-900/50"}`}
              >
                <stage.icon className={`h-5 w-5 mx-auto mb-2 ${isActive ? "text-amber-400 animate-pulse" : isDone ? "text-amber-500" : "text-zinc-600"}`} />
                <p className={`text-xs ${isActive ? "text-amber-400" : isDone ? "text-zinc-400" : "text-zinc-600"}`}>{stage.label}</p>
                {isDone && <CheckCircle2 className="h-3 w-3 text-amber-500 mx-auto mt-1" />}
              </div>
            );
          })}
        </div>
        {message && <p className="text-sm text-zinc-500 mt-4 text-center font-mono">{message}</p>}
      </div>
    </div>
  );
}

function AnalysisResult({ result }: { result: DeepAnalysisResultData }) {
  const rec = result.recommendation;
  const modeLabel = result.mode === "preview" ? "Earnings Preview" : result.mode === "review" ? "Earnings Review" : result.mode || "Analysis";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/10 border border-amber-500/20 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-amber-500" />
              <h3 className="font-bold text-xl text-white">Analysis Complete</h3>
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 uppercase text-xs">
                {modeLabel}
              </Badge>
            </div>
            <RecommendationBadge action={rec?.action || "Hold"} confidence={rec?.confidence || 50} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:text-right">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Target Price</p>
              <p className="text-xl sm:text-2xl font-bold font-mono text-white">${rec?.targetPrice?.toFixed(2) || "\u2014"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Upside</p>
              <p className={`text-xl sm:text-2xl font-bold font-mono ${(rec?.upside || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {(rec?.upside || 0) >= 0 ? "+" : ""}{rec?.upside?.toFixed(1) || 0}%
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
      {result.analysis && <MarkdownSection content={result.analysis} />}
    </div>
  );
}

export default function EarningsAnalysisPage() {
  useDocumentTitle("Earnings Analysis", "Expert earnings analysis with preview and review summaries, consensus expectations, beat/miss analysis, and guidance changes. Powered by Claude, Gemini, and DeepSeek analytical models on Buy Side Bro.");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlTicker = urlParams.get("ticker");
  const urlMode = urlParams.get("mode") as AnalysisMode | null;

  const [searchTicker, setSearchTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | null>(urlTicker || null);
  const [mode, setMode] = useState<AnalysisMode>(urlMode || "preview");
  const [result, setResult] = useState<DeepAnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Unified streaming state
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRecommendation, setStreamingRecommendation] = useState<any>(null);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamMessage, setStreamMessage] = useState("");
  const [streamingMode, setStreamingMode] = useState<AnalysisMode>("preview");
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentBufferRef = useRef("");
  const renderFrameRef = useRef<number | null>(null);

  const { gate, showLoginModal, closeLoginModal, isAuthenticated } = useLoginGate();
  const { isAtLimit, refetch: refetchBroStatus } = useBroStatus();
  const [showBroLimit, setShowBroLimit] = useState(false);

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery<StockProfile>({
    queryKey: ["/api/analysis/profile", activeTicker],
    enabled: !!activeTicker,
    retry: 1,
  });

  const { data: historicalData, isLoading: chartLoading, isError: chartError } = useQuery<HistoricalData>({
    queryKey: ["/api/analysis/history", activeTicker],
    enabled: !!activeTicker,
    retry: 1,
  });

  const { data: forwardMetrics, isLoading: metricsLoading, isError: metricsError } = useQuery<ForwardMetrics>({
    queryKey: ["/api/analysis/forward", activeTicker],
    enabled: !!activeTicker,
    retry: 1,
  });

  const hasDataErrors = profileError || chartError || metricsError;

  const handleStartAnalysis = useCallback(async (ticker: string, analysisMode: AnalysisMode) => {
    if (!gate()) return;
    if (isAtLimit) {
      setShowBroLimit(true);
      return;
    }

    // Abort any existing stream
    abortControllerRef.current?.abort();
    if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);

    // Map mode to API mode
    const apiMode = analysisMode === "preview" ? "earnings_preview"
      : analysisMode === "review" ? "earnings_review"
      : "deep_dive";

    // Reset state
    setStreamState("loading");
    setStreamingContent("");
    setStreamingRecommendation(null);
    setStreamProgress(0);
    setStreamMessage("Starting analysis...");
    setStreamingMode(analysisMode);
    setMode(analysisMode);
    setResult(null);
    setError(null);
    contentBufferRef.current = "";

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamAnalysis(
        { ticker: ticker.toUpperCase(), mode: apiMode },
        {
          onProgress: (progress, message) => {
            setStreamProgress(progress);
            setStreamMessage(message);
          },
          onContent: (chunk, fullContent) => {
            contentBufferRef.current = fullContent;
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
            if (renderFrameRef.current) {
              cancelAnimationFrame(renderFrameRef.current);
              renderFrameRef.current = null;
            }
            const analysisResult: DeepAnalysisResultData = {
              ticker: ticker.toUpperCase(),
              mode: analysisMode === "preview" ? "Earnings Preview"
                : analysisMode === "review" ? "Earnings Review"
                : "Deep Analysis",
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
            setResult(analysisResult);
            setStreamState("done");
            refetchBroStatus();
          },
          onError: (errorMsg) => {
            setError(errorMsg);
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
      setError(err.message || "Failed to start analysis. Please try again.");
      setStreamState("error");
    }
  }, [gate, isAtLimit, profile, refetchBroStatus]);

  const handleSubmit = (ticker: string) => {
    if (!gate()) return;
    abortControllerRef.current?.abort();
    if (renderFrameRef.current) {
      cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    }
    setActiveTicker(ticker);
    setResult(null);
    setError(null);
    setStreamState("idle");
    setStreamingContent("");
    setStreamingRecommendation(null);
    setStreamProgress(0);
    setStreamMessage("");
    contentBufferRef.current = "";
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="page-container">
        <div className="mb-6">
          <h1 className="display-font text-xl sm:text-3xl md:text-4xl font-bold tracking-wider text-white mb-2" data-testid="text-page-title">
            EARNINGS
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base">
            Bro Powered earnings analysis — preview what's ahead or review what just happened
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex gap-2">
            <StockSearchInput
              value={searchTicker}
              onSelect={(symbol) => setSearchTicker(symbol)}
              onSubmit={handleSubmit}
            />
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
              onClick={() => searchTicker.trim() && handleSubmit(searchTicker.toUpperCase().trim())}
              data-testid="button-search"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!activeTicker ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-10 sm:py-16 px-4 text-center">
            <Brain className="h-8 w-8 sm:h-12 sm:w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-2">Search for a stock to analyze</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-2">
              Search for a stock, then choose Earnings Preview or Review to start analysis.
            </p>
            <p className="text-xs text-zinc-600 max-w-lg mx-auto mb-6">
              <span className="text-amber-400">Preview</span> analyzes what to expect before earnings.{" "}
              <span className="text-amber-400">Review</span> evaluates results after earnings are reported.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map((ticker) => (
                <Badge
                  key={ticker}
                  variant="outline"
                  className="cursor-pointer border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  onClick={() => {
                    setSearchTicker(ticker);
                    handleSubmit(ticker);
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl sm:text-2xl font-bold font-mono text-white">{profile.symbol}</h2>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">{profile.exchange}</Badge>
                    </div>
                    <p className="text-lg text-zinc-300 mb-2">{profile.companyName}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">{profile.sector}</Badge>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">{profile.industry}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-bold font-mono text-white">${profile.price.toFixed(2)}</p>
                    <PercentDisplay value={profile.changesPercentage} />
                  </div>
                </div>
              </div>
            ) : null}

            {activeTicker && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <StockChart data={historicalData} isLoading={chartLoading} />
                </div>
                <div className="lg:col-span-1">
                  <KeyInfoCard profile={profile} forwardMetrics={forwardMetrics} profileLoading={profileLoading} metricsLoading={metricsLoading} />
                </div>
              </div>
            )}

            {hasDataErrors && !profileLoading && !chartLoading && !metricsLoading && (
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400">
                <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0" />
                Some market data is temporarily unavailable. The Bro analysis will still proceed using available data.
              </div>
            )}

            {/* Mode action cards — show when stock loaded, idle, no result */}
            {activeTicker && streamState === "idle" && !result && !error && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => handleStartAnalysis(activeTicker, "preview")}
                    className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-lg p-6 cursor-pointer transition-all text-left group hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    data-testid="card-earnings-preview"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                        <Eye className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className="font-semibold text-lg text-white">Earnings Preview</h3>
                    </div>
                    <p className="text-sm text-zinc-400">Analyse what to expect before earnings are reported</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartAnalysis(activeTicker, "review")}
                    className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-lg p-6 cursor-pointer transition-all text-left group hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    data-testid="card-earnings-review"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                        <FileSearch className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className="font-semibold text-lg text-white">Earnings Review</h3>
                    </div>
                    <p className="text-sm text-zinc-400">Evaluate results after earnings have been reported</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartAnalysis(activeTicker, "deep")}
                    className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-lg p-6 cursor-pointer transition-all text-left group hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    data-testid="card-deep-analysis"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className="font-semibold text-lg text-white">Deep Analysis</h3>
                    </div>
                    <p className="text-sm text-zinc-400">Comprehensive fundamental analysis with buy/hold/sell recommendation</p>
                  </button>
                </div>
              </>
            )}

            {error || streamState === "error" ? (
              <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Analysis Failed</p>
                    <p className="text-sm text-zinc-400">{error || "An error occurred"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto border-zinc-700"
                    onClick={() => {
                      setError(null);
                      setStreamState("idle");
                      if (activeTicker) handleStartAnalysis(activeTicker, mode);
                    }}
                    data-testid="button-retry-analysis"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : streamState === "loading" ? (
              <AnalysisLoader
                ticker={activeTicker || ""}
                mode={streamingMode}
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
                      {streamingMode === "preview" ? "Earnings Preview" : streamingMode === "review" ? "Earnings Review" : "Deep Dive"}
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
            ) : result ? (
              <>
                <AnalysisResult result={result} />
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 pb-4">
                  <span className="text-sm text-zinc-500">Want a different perspective?</span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-amber-500/50 gap-2"
                      onClick={() => activeTicker && handleStartAnalysis(activeTicker, "preview")}
                      data-testid="button-reanalyse-preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Earnings Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-amber-500/50 gap-2"
                      onClick={() => activeTicker && handleStartAnalysis(activeTicker, "review")}
                      data-testid="button-reanalyse-review"
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                      Earnings Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-amber-500/50 gap-2"
                      onClick={() => activeTicker && handleStartAnalysis(activeTicker, "deep")}
                      data-testid="button-reanalyse-deep"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Deep Analysis
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
      <BroLimitModal open={showBroLimit} onClose={() => setShowBroLimit(false)} />
    </div>
  );
}
