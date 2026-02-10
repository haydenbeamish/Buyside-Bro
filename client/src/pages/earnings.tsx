import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  ThumbsUp,
  ThumbsDown,
  Minus,
  Eye,
  FileSearch,
  Sparkles,
  Building2,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";

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

interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
}

type AnalysisMode = "preview" | "review";

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
    setQuery(stock.symbol);
    onSelect(stock.symbol);
    onSubmit(stock.symbol);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      onSubmit(query.toUpperCase().trim());
      setIsOpen(false);
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

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
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
          <span className={`font-mono font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
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
            <p className={`font-mono font-bold ${(forwardMetrics?.forwardEpsGrowth ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
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
      <div className={`${bgColor} ${textColor} px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-base sm:text-lg`}>
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
        const lines = section.trim().split("\n");
        const titleMatch = lines[0]?.match(/^## (.+)/);
        const title = titleMatch ? titleMatch[1] : null;
        const body = title ? lines.slice(1).join("\n").trim() : section.trim();
        if (!body && !title) return null;
        return (
          <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 sm:p-5">
            {title && (
              <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {title}
              </h3>
            )}
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {body.split("\n").map((line, i) => {
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-amber-500 mt-1">&bull;</span>
                      <span>{line.substring(2)}</span>
                    </div>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold text-white mb-2">{line.replace(/\*\*/g, "")}</p>;
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="mb-1">{line}</p>;
              })}
            </div>
          </div>
        );
      })}
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
        const baseProgress = Math.min(apiProgress, 95);
        const timeBasedProgress = Math.min(elapsed * 0.5, 94);
        const newProgress = Math.max(baseProgress, timeBasedProgress, prev);
        const increment = 0.1 + Math.random() * 0.3;
        return Math.min(newProgress + increment, 95);
      });
    }, 150);
    return () => clearInterval(interval);
  }, [apiProgress, isComplete, startTime]);

  const displayProgress = isComplete ? 100 : Math.floor(animatedProgress);
  const modeLabel = mode === "preview" ? "Earnings Preview" : "Earnings Review";

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
              <p className={`text-xl sm:text-2xl font-bold font-mono ${(rec?.upside || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
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
  useDocumentTitle("Earnings Analysis");
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlTicker = urlParams.get("ticker");
  const urlJobId = urlParams.get("jobId");
  const urlMode = urlParams.get("mode") as AnalysisMode | null;

  const [searchTicker, setSearchTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | null>(urlTicker || null);
  const [mode, setMode] = useState<AnalysisMode>(urlMode || "preview");
  const [jobId, setJobId] = useState<string | null>(urlJobId || null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(
    urlJobId ? { jobId: urlJobId, status: "pending", progress: 0, message: "Starting analysis..." } : null
  );
  const [result, setResult] = useState<DeepAnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptRef = useRef<number>(0);
  const jobStartTimeRef = useRef<number>(Date.now());
  const hasAutoStarted = useRef(!!urlJobId);
  const { toast } = useToast();
  const POLLING_TIMEOUT_MS = 5 * 60 * 1000;

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

  const startAnalysis = useCallback(async (ticker: string, analysisMode: AnalysisMode) => {
    if (!gate()) return;
    if (isAtLimit) {
      setShowBroLimit(true);
      return;
    }
    setIsStarting(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setJobStatus(null);
    jobStartTimeRef.current = Date.now();
    pollAttemptRef.current = 0;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    try {
      const res = await apiRequest("POST", "/api/fundamental-analysis/jobs", {
        ticker: ticker.toUpperCase(),
        mode: analysisMode,
      });
      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
        setJobStatus({ jobId: data.jobId, status: "pending", progress: 0, message: "Starting analysis..." });
        refetchBroStatus();
      } else {
        throw new Error("No job ID returned");
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429) {
        setShowBroLimit(true);
        return;
      }
      setError("Failed to start analysis. Please try again.");
      toast({
        title: "Error",
        description: "Failed to start analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  }, [toast, gate, isAtLimit, refetchBroStatus]);

  const pollJobStatus = useCallback(async (currentJobId: string) => {
    const elapsed = Date.now() - jobStartTimeRef.current;
    if (elapsed > POLLING_TIMEOUT_MS) {
      setError("Analysis timed out after 5 minutes. The server may be busy — please try again.");
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    try {
      const res = await fetch(`/api/analysis/deep/job/${currentJobId}`);
      if (!res.ok) throw new Error("Job not found");
      const status = await res.json();
      if (status.jobId !== currentJobId) return;
      setJobStatus(status);
      if (status.status === "completed") {
        const resultRes = await fetch(`/api/analysis/deep/result/${currentJobId}`);
        if (resultRes.ok) {
          const resultData = await resultRes.json();
          setResult(resultData);
        }
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      } else if (status.status === "failed") {
        setError("Analysis failed. Please try again.");
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
    // Schedule next poll with exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
    pollAttemptRef.current += 1;
    const INITIAL_DELAY = 1000;
    const MAX_DELAY = 10000;
    const delay = Math.min(INITIAL_DELAY * Math.pow(2, pollAttemptRef.current), MAX_DELAY);
    pollingRef.current = setTimeout(() => pollJobStatus(currentJobId), delay);
  }, [POLLING_TIMEOUT_MS]);

  useEffect(() => {
    if (jobId && jobStatus?.status !== "completed" && jobStatus?.status !== "failed") {
      pollAttemptRef.current = 0;
      const INITIAL_DELAY = 1000;
      pollingRef.current = setTimeout(() => pollJobStatus(jobId), INITIAL_DELAY);
      return () => {
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [jobId, jobStatus?.status, pollJobStatus]);

  const handleSubmit = (ticker: string) => {
    if (!gate()) return;
    setActiveTicker(ticker);
    if (!hasAutoStarted.current) {
      startAnalysis(ticker, mode);
    }
    hasAutoStarted.current = false;
  };

  const handleModeChange = (newMode: AnalysisMode) => {
    setMode(newMode);
    if (activeTicker && !isLoading) {
      startAnalysis(activeTicker, newMode);
    }
  };

  const isLoading = isStarting || jobStatus?.status === "pending" || jobStatus?.status === "processing";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight display-font neon-green-subtle" data-testid="text-page-title">
              EARNINGS
            </h1>
          </div>
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

        <div className="flex gap-2 mb-6 sm:mb-8">
          <Button
            variant={mode === "preview" ? "default" : "outline"}
            className={mode === "preview"
              ? "bg-amber-600 hover:bg-amber-700 text-white gap-2"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2"
            }
            onClick={() => handleModeChange("preview")}
            disabled={isLoading}
            data-testid="button-mode-preview"
          >
            <Eye className="h-4 w-4" />
            Earnings Preview
          </Button>
          <Button
            variant={mode === "review" ? "default" : "outline"}
            className={mode === "review"
              ? "bg-amber-600 hover:bg-amber-700 text-white gap-2"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2"
            }
            onClick={() => handleModeChange("review")}
            disabled={isLoading}
            data-testid="button-mode-review"
          >
            <FileSearch className="h-4 w-4" />
            Earnings Review
          </Button>
        </div>

        {!activeTicker ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-10 sm:py-16 px-4 text-center">
            <Brain className="h-8 w-8 sm:h-12 sm:w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-2">Search for a stock to analyze</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-2">
              Enter a ticker symbol, then choose whether you want an earnings preview or review.
            </p>
            <p className="text-xs text-zinc-600 max-w-lg mx-auto mb-6">
              <span className="text-blue-400">Preview</span> analyzes what to expect before earnings.{" "}
              <span className="text-orange-400">Review</span> evaluates results after earnings are reported.
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

            {error ? (
              <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Analysis Failed</p>
                    <p className="text-sm text-zinc-400">{error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto border-zinc-700"
                    onClick={() => activeTicker && startAnalysis(activeTicker, mode)}
                    data-testid="button-retry-analysis"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <AnalysisLoader
                ticker={activeTicker || ""}
                mode={mode}
                progress={jobStatus?.progress || 0}
                message={jobStatus?.message || "Starting analysis..."}
                isComplete={false}
              />
            ) : result ? (
              <AnalysisResult result={result} />
            ) : null}
          </div>
        )}
      </div>
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
      <BroLimitModal open={showBroLimit} onClose={() => setShowBroLimit(false)} />
    </div>
  );
}
