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
  FileText,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
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

interface Financials {
  revenue: number;
  netIncome: number;
  eps: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  roe: number;
  debtToEquity: number;
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

interface SECFiling {
  symbol: string;
  type: string;
  date: string;
  acceptedDate: string;
  link: string;
  finalLink: string;
  cik: string;
}

function FilingsSection({ filings, isLoading }: { filings?: SECFiling[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 bg-zinc-800" />
          <Skeleton className="h-5 w-28 bg-zinc-800" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!filings?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-zinc-400" />
          SEC Filings
        </h3>
        <p className="text-zinc-500 text-center py-6">No filings available</p>
      </div>
    );
  }

  const getBadgeStyle = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes("10-K")) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (t.includes("10-Q")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (t.includes("8-K")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
        <FileText className="h-4 w-4 text-green-500" />
        SEC Filings
      </h3>
      <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
        {filings.map((filing, i) => (
          <a
            key={`${filing.type}-${filing.date}-${i}`}
            href={filing.finalLink || filing.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${getBadgeStyle(filing.type)}`}>
                {filing.type}
              </span>
              <span className="text-sm text-zinc-400">
                {new Date(filing.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

function StockChart({ data, isLoading }: { data?: HistoricalData; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32 bg-zinc-800" />
          <Skeleton className="h-4 w-24 bg-zinc-800" />
        </div>
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
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#71717a', fontSize: 10 }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return d.toLocaleDateString('en-US', { month: 'short' });
              }}
              interval={60}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']}
              tick={{ fill: '#71717a', fontSize: 10 }}
              tickFormatter={(val) => `$${val.toFixed(0)}`}
              width={50}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#chartGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-20 bg-zinc-800" />
      ) : (
        <p className={`text-lg font-bold font-mono ${colorClass || "text-white"}`}>
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
    if (value === undefined || value === null) return "N/A";
    if (value >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`;
    return `${prefix}${value.toLocaleString()}`;
  };

  const dayChangeColor = (profile?.changesPercentage ?? 0) >= 0 ? "text-green-500" : "text-red-500";
  const epsGrowthColor = (forwardMetrics?.forwardEpsGrowth ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-green-500" />
        Key Metrics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Profile metrics */}
        <MetricCard
          label="Market Cap"
          value={profile?.marketCap != null ? formatMarketCap(profile.marketCap) : "—"}
          isLoading={profileLoading}
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
        {/* Forward metrics */}
        <MetricCard
          label="Forward P/E"
          value={forwardMetrics?.forwardPE != null ? `${forwardMetrics.forwardPE.toFixed(1)}x` : "—"}
          isLoading={metricsLoading}
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
        {/* Financial metrics */}
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
          label="EPS"
          value={financials?.eps != null ? `$${financials.eps.toFixed(2)}` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="P/E (TTM)"
          value={financials?.peRatio != null ? financials.peRatio.toFixed(2) : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="P/B Ratio"
          value={financials?.pbRatio != null ? financials.pbRatio.toFixed(2) : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="ROE"
          value={financials?.roe != null ? `${(financials.roe * 100).toFixed(2)}%` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Dividend Yield"
          value={financials?.dividendYield != null ? `${(financials.dividendYield * 100).toFixed(2)}%` : "N/A"}
          isLoading={financialsLoading}
        />
        <MetricCard
          label="Debt/Equity"
          value={financials?.debtToEquity != null ? financials.debtToEquity.toFixed(2) : "N/A"}
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
        const title = titleMatch ? titleMatch[1] : null;
        const body = title ? lines.slice(1).join('\n').trim() : section.trim();
        
        if (!body && !title) return null;
        
        return (
          <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
            {title && (
              <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {title}
              </h3>
            )}
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {body.split('\n').map((line, i) => {
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{line.substring(2)}</span>
                    </div>
                  );
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="font-semibold text-white mb-2">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="mb-1">{line}</p>;
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
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-green-950/20 border border-green-500/30 rounded-lg p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.05),transparent_70%)]" />
      
      <div className="relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <Brain className="h-7 w-7 text-green-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-white">Deep Analysis in Progress</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Analyzing <span className="font-mono text-green-400">{ticker}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-green-400">{displayProgress}%</p>
          </div>
        </div>
        
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-6">
          <div 
            className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-150"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {loadingStages.map((stage, i) => {
            const isActive = i === currentStage;
            const isComplete = displayProgress >= stage.threshold;
            return (
              <div 
                key={stage.label}
                className={`text-center p-3 rounded-lg transition-all ${
                  isActive ? "bg-green-500/20 border border-green-500/50" :
                  isComplete ? "bg-zinc-800" : "bg-zinc-900/50"
                }`}
              >
                <stage.icon className={`h-5 w-5 mx-auto mb-2 ${
                  isActive ? "text-green-400 animate-pulse" :
                  isComplete ? "text-green-500" : "text-zinc-600"
                }`} />
                <p className={`text-xs ${
                  isActive ? "text-green-400" :
                  isComplete ? "text-zinc-400" : "text-zinc-600"
                }`}>
                  {stage.label}
                </p>
                {isComplete && <CheckCircle2 className="h-3 w-3 text-green-500 mx-auto mt-1" />}
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
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-green-950/10 border border-green-500/20 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h3 className="font-bold text-xl text-white">Analysis Complete</h3>
              <Badge variant="outline" className="border-green-500/50 text-green-400 uppercase text-xs">
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

function StockSearchInput({ 
  value, 
  onSelect,
  onSubmit
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!userTypedRef.current) {
      return;
    }
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
    if (e.key === 'Enter' && query.trim()) {
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
          placeholder="Search stocks... (e.g., Apple, TSLA)"
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
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 animate-spin" />
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
                  <span className="font-mono font-semibold text-green-400">{stock.symbol}</span>
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

function AILoadingAnimation({ ticker }: { ticker: string }) {
  const loadingMessages = [
    "Analyzing fundamentals...",
    "Crunching the numbers...",
    "Reading SEC filings...",
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
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-green-950/20 border border-green-500/30 rounded-lg p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.05),transparent_70%)]" />
      
      <div className="relative flex items-start gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <Brain className="h-6 w-6 text-green-500 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-white">Bro's Brain is Working</h3>
            <Badge variant="outline" className="border-green-500/50 text-green-400 animate-pulse">
              analyzing {ticker}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-green-400 font-mono animate-pulse">
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
                className="h-full bg-gradient-to-r from-green-500 via-green-400 to-green-500 rounded-full"
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
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

  const { data: historicalData, isLoading: chartLoading } = useQuery<HistoricalData>({
    queryKey: ["/api/analysis/history", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: forwardMetrics, isLoading: metricsLoading } = useQuery<ForwardMetrics>({
    queryKey: ["/api/analysis/forward", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: secFilings, isLoading: filingsLoading } = useQuery<SECFiling[]>({
    queryKey: ["/api/analysis/sec-filings", activeTicker],
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
      refetchBroStatus();
    },
    onError: (error: any) => {
      if (error?.message?.includes("429")) {
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
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (status.status === "failed") {
        setDeepJobStatus(status);
        setDeepError("Analysis failed. Please try again.");
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        setDeepJobStatus(status);
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, []);

  useEffect(() => {
    if (deepJobId && deepJobStatus?.status !== "completed" && deepJobStatus?.status !== "failed") {
      pollingRef.current = setInterval(() => pollJobStatus(deepJobId), 2000);
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [deepJobId, deepJobStatus?.status, pollJobStatus]);

  const prevTickerRef = useRef<string | null>(activeTicker);
  useEffect(() => {
    if (activeTicker && activeTicker !== prevTickerRef.current) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setDeepJobId(null);
      setDeepJobStatus(null);
      setDeepError(null);
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
        clearInterval(pollingRef.current);
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            COMPANY
          </h1>
          <p className="text-zinc-500">
            Deep dive into company fundamentals with Bro-powered insights
          </p>
        </div>

        <div className="flex gap-2 max-w-md mb-8">
          <StockSearchInput
            value={searchTicker}
            onSelect={(symbol) => setSearchTicker(symbol)}
            onSubmit={(symbol) => handleAnalyze(symbol)}
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
              <StockChart data={historicalData} isLoading={chartLoading} />
            )}

            {/* SEC Filings */}
            {activeTicker && (
              <FilingsSection filings={secFilings} isLoading={filingsLoading} />
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
                          clearInterval(pollingRef.current);
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
            ) : isDeepLoading ? (
              <DeepAnalysisLoader 
                ticker={activeTicker || ""} 
                progress={deepJobStatus?.progress || 0}
                message={deepJobStatus?.message || "Starting analysis..."}
                isComplete={false}
              />
            ) : deepResult ? (
              <DeepAnalysisResult result={deepResult} />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <Brain className="h-10 w-10 text-green-500/60 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">Deep Analysis</h3>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                  Get a comprehensive AI-powered fundamental analysis with buy/hold/sell recommendation for {activeTicker}.
                </p>
                <Button
                  className="bg-green-600 text-black font-bold uppercase tracking-wider"
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
                        clearInterval(pollingRef.current);
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
