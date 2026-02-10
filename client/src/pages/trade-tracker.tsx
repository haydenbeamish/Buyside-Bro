import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { useBroStatus } from "@/hooks/use-bro-status";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { LoginGateModal } from "@/components/login-gate-modal";
import { StockSearch } from "@/components/stock-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp, Loader2, ChevronDown, ChevronUp,
  Trophy, Target, BarChart3, ArrowUpRight, ArrowDownRight, Trash2,
  AlertTriangle, Lock, Plus, Building2, X,
  Calculator, Percent, Scale, CheckCircle2, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Trade } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────

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

interface ForwardMetrics {
  ticker: string;
  forwardPE: number | null;
  forwardEpsGrowth: number | null;
  pegRatio: number | null;
  currentEps: number | null;
  estimatedEps: number | null;
}

interface Analytics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalPnL: number;
  winStreak: number;
  lossStreak: number;
  currentStreak: number;
  currentStreakType: string | null;
  strategyBreakdown: { strategy: string; count: number; winRate: number; totalPnL: number; expectancy: number }[];
  ideaSourceBreakdown: { source: string; count: number; winRate: number; totalPnL: number }[];
  dayOfWeekPerformance: { day: string; count: number; avgPnL: number; totalPnL: number }[];
  holdingPeriodAnalysis: { period: string; count: number; totalPnL: number; winRate: number }[];
}

// ─── Dummy Data ───────────────────────────────────────────────────

const DUMMY_TRADES = [
  { id: 1, ticker: "NVDA", companyName: "NVIDIA Corporation", action: "buy", shares: "50", price: "450.00", totalValue: "22500.00", notes: "AI chip leader, strong data center growth", strategyTag: "momentum", setupType: "fundamental", emotionalState: "confident", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-09-15T10:30:00Z", chartSnapshot: [400,410,420,415,430,445,460,455,470,480,490,500] },
  { id: 2, ticker: "AAPL", companyName: "Apple Inc.", action: "buy", shares: "100", price: "178.50", totalValue: "17850.00", notes: "iPhone 16 cycle upcoming, services growth", strategyTag: "growth", setupType: "catalyst_driven", emotionalState: "neutral", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-08-20T14:00:00Z", chartSnapshot: [170,172,175,173,178,180,182,185,183,186,188,190] },
  { id: 3, ticker: "TSLA", companyName: "Tesla, Inc.", action: "buy", shares: "30", price: "245.00", totalValue: "7350.00", notes: "Robotaxi catalyst, oversold bounce play", strategyTag: "contrarian", setupType: "technical", emotionalState: "anxious", ideaSource: "friend", ideaSourceName: "Mike", tradedAt: "2024-07-10T09:45:00Z", chartSnapshot: [260,255,250,240,235,230,225,220,218,215,210,205] },
  { id: 4, ticker: "MSFT", companyName: "Microsoft Corporation", action: "buy", shares: "40", price: "380.00", totalValue: "15200.00", notes: "Copilot monetization ramp, Azure growth", strategyTag: "growth", setupType: "fundamental", emotionalState: "confident", ideaSource: "broker", ideaSourceName: "Morgan Stanley", tradedAt: "2024-10-05T11:00:00Z", chartSnapshot: [370,375,378,380,385,390,388,392,395,400,405,410] },
  { id: 5, ticker: "AMZN", companyName: "Amazon.com, Inc.", action: "buy", shares: "60", price: "155.00", totalValue: "9300.00", notes: "AWS re-acceleration, margin expansion", strategyTag: "growth", setupType: "fundamental", emotionalState: "excited", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-06-18T13:30:00Z", chartSnapshot: [145,148,150,153,155,158,160,163,165,170,175,180] },
  { id: 6, ticker: "META", companyName: "Meta Platforms, Inc.", action: "buy", shares: "35", price: "480.00", totalValue: "16800.00", notes: "Reels monetization, Llama AI platform", strategyTag: "momentum", setupType: "fundamental", emotionalState: "confident", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-11-01T10:00:00Z", chartSnapshot: [450,460,470,475,480,485,490,500,510,520,530,540] },
  { id: 7, ticker: "GOOGL", companyName: "Alphabet Inc.", action: "buy", shares: "45", price: "150.00", totalValue: "6750.00", notes: "Search AI integration, Cloud growth", strategyTag: "value", setupType: "fundamental", emotionalState: "neutral", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-08-01T09:30:00Z", chartSnapshot: [140,142,145,148,150,152,155,158,160,163,165,170] },
  { id: 8, ticker: "JPM", companyName: "JPMorgan Chase & Co.", action: "buy", shares: "50", price: "195.00", totalValue: "9750.00", notes: "Net interest income peak, strong trading desk", strategyTag: "value", setupType: "market_conditions", emotionalState: "neutral", ideaSource: "friend", ideaSourceName: "Sarah", tradedAt: "2024-07-25T10:15:00Z", chartSnapshot: [185,188,190,192,195,198,200,202,205,210,215,220] },
  { id: 9, ticker: "NVDA", companyName: "NVIDIA Corporation", action: "sell", shares: "25", price: "520.00", totalValue: "13000.00", notes: "Taking partial profits after earnings run", strategyTag: "momentum", setupType: "technical", emotionalState: "confident", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-11-20T15:00:00Z", chartSnapshot: [480,490,500,510,520,515,510,505,500,495,490,485] },
  { id: 10, ticker: "TSLA", companyName: "Tesla, Inc.", action: "sell", shares: "30", price: "210.00", totalValue: "6300.00", notes: "Stop loss hit, thesis broken", strategyTag: "contrarian", setupType: "technical", emotionalState: "anxious", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-08-15T11:30:00Z", chartSnapshot: [245,240,235,230,225,220,215,210,205,200,195,190] },
  { id: 11, ticker: "AAPL", companyName: "Apple Inc.", action: "sell", shares: "50", price: "195.00", totalValue: "9750.00", notes: "Trimming to lock in gains ahead of earnings", strategyTag: "swing", setupType: "catalyst_driven", emotionalState: "neutral", ideaSource: "broker", ideaSourceName: "Morgan Stanley", tradedAt: "2024-10-20T14:30:00Z", chartSnapshot: [178,180,183,185,188,190,192,194,195,196,197,198] },
  { id: 12, ticker: "AMZN", companyName: "Amazon.com, Inc.", action: "buy", shares: "40", price: "175.00", totalValue: "7000.00", notes: "Adding on dip, Prime Day strong numbers", strategyTag: "growth", setupType: "catalyst_driven", emotionalState: "excited", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-09-25T10:30:00Z", chartSnapshot: [165,168,170,172,175,178,180,182,185,188,190,193] },
  { id: 13, ticker: "META", companyName: "Meta Platforms, Inc.", action: "sell", shares: "15", price: "530.00", totalValue: "7950.00", notes: "Reducing position, approaching fair value", strategyTag: "momentum", setupType: "fundamental", emotionalState: "neutral", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-12-01T09:45:00Z", chartSnapshot: [480,490,500,510,520,530,535,530,525,520,515,510] },
  { id: 14, ticker: "GOOGL", companyName: "Alphabet Inc.", action: "sell", shares: "45", price: "142.00", totalValue: "6390.00", notes: "Antitrust risk, rotating out", strategyTag: "value", setupType: "market_conditions", emotionalState: "anxious", ideaSource: "friend", ideaSourceName: "Mike", tradedAt: "2024-09-05T11:00:00Z", chartSnapshot: [150,148,146,144,142,140,138,136,135,134,133,132] },
  { id: 15, ticker: "MSFT", companyName: "Microsoft Corporation", action: "buy", shares: "20", price: "410.00", totalValue: "8200.00", notes: "Adding on strength, Copilot adoption accelerating", strategyTag: "growth", setupType: "fundamental", emotionalState: "confident", ideaSource: "broker", ideaSourceName: "Morgan Stanley", tradedAt: "2024-12-10T10:00:00Z", chartSnapshot: [395,398,400,403,405,408,410,413,415,418,420,425] },
  { id: 16, ticker: "JPM", companyName: "JPMorgan Chase & Co.", action: "sell", shares: "50", price: "220.00", totalValue: "11000.00", notes: "Full exit, rate cut cycle concern", strategyTag: "value", setupType: "market_conditions", emotionalState: "neutral", ideaSource: "friend", ideaSourceName: "Sarah", tradedAt: "2024-11-15T14:00:00Z", chartSnapshot: [195,200,205,210,215,218,220,222,225,220,218,215] },
  { id: 17, ticker: "NVDA", companyName: "NVIDIA Corporation", action: "buy", shares: "20", price: "480.00", totalValue: "9600.00", notes: "Re-entry on pullback, Blackwell demand strong", strategyTag: "momentum", setupType: "catalyst_driven", emotionalState: "fomo", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-12-15T09:30:00Z", chartSnapshot: [510,505,500,495,490,485,480,478,480,485,490,495] },
  { id: 18, ticker: "AAPL", companyName: "Apple Inc.", action: "buy", shares: "30", price: "192.00", totalValue: "5760.00", notes: "Apple Intelligence launch, upgrading cycle", strategyTag: "swing", setupType: "catalyst_driven", emotionalState: "confident", ideaSource: "self", ideaSourceName: "Self", tradedAt: "2024-11-25T13:00:00Z", chartSnapshot: [188,189,190,191,192,193,194,195,196,197,198,200] },
  { id: 19, ticker: "TSLA", companyName: "Tesla, Inc.", action: "buy", shares: "15", price: "340.00", totalValue: "5100.00", notes: "Post-election rally, regulatory tailwinds", strategyTag: "momentum", setupType: "catalyst_driven", emotionalState: "fomo", ideaSource: "friend", ideaSourceName: "Mike", tradedAt: "2024-12-05T10:00:00Z", chartSnapshot: [290,300,310,320,330,340,345,350,355,360,365,370] },
  { id: 20, ticker: "AMZN", companyName: "Amazon.com, Inc.", action: "sell", shares: "40", price: "190.00", totalValue: "7600.00", notes: "Full exit, taking profits, rotating to small caps", strategyTag: "growth", setupType: "fundamental", emotionalState: "neutral", ideaSource: "broker", ideaSourceName: "Goldman Sachs", tradedAt: "2024-12-20T15:30:00Z", chartSnapshot: [175,178,180,183,185,187,189,190,191,192,193,195] },
];

const DUMMY_PRICES: Record<string, number> = {
  NVDA: 520, AAPL: 198, TSLA: 370, MSFT: 425, AMZN: 195, META: 540, GOOGL: 170, JPM: 220,
};

function computeDemoAnalytics(): Analytics {
  const tradesWithPnL = DUMMY_TRADES.map(t => {
    const entryPrice = parseFloat(t.price);
    const shares = parseFloat(t.shares);
    const currentPrice = DUMMY_PRICES[t.ticker] || entryPrice;
    const pnl = t.action === "buy" ? (currentPrice - entryPrice) * shares : (entryPrice - currentPrice) * shares;
    const returnPct = entryPrice > 0 ? ((t.action === "buy" ? currentPrice - entryPrice : entryPrice - currentPrice) / entryPrice) * 100 : 0;
    return { ...t, pnl, returnPct, currentPrice };
  });
  const winners = tradesWithPnL.filter(t => t.pnl > 0);
  const losers = tradesWithPnL.filter(t => t.pnl < 0);
  const totalPnL = tradesWithPnL.reduce((s, t) => s + t.pnl, 0);
  const winRate = (winners.length / tradesWithPnL.length) * 100;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0;
  const expectancy = totalPnL / tradesWithPnL.length;
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const returns = tradesWithPnL.map(t => t.returnPct);
  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
  const sharpeRatio = Math.sqrt(variance) > 0 ? meanReturn / Math.sqrt(variance) : 0;
  let peak = 0, maxDrawdown = 0, cumPnL = 0;
  const sorted = [...tradesWithPnL].sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
  for (const t of sorted) { cumPnL += t.pnl; if (cumPnL > peak) peak = cumPnL; const dd = peak - cumPnL; if (dd > maxDrawdown) maxDrawdown = dd; }
  let winStreak = 0, lossStreak = 0, currentStreak = 0;
  let currentStreakType: string | null = null;
  let tw = 0, tl = 0;
  for (const t of sorted) {
    if (t.pnl > 0) { tw++; tl = 0; if (tw > winStreak) winStreak = tw; currentStreak = tw; currentStreakType = "win"; }
    else if (t.pnl < 0) { tl++; tw = 0; if (tl > lossStreak) lossStreak = tl; currentStreak = tl; currentStreakType = "loss"; }
    else { tw = 0; tl = 0; currentStreak = 0; currentStreakType = null; }
  }
  const stratMap = new Map<string, { count: number; wins: number; totalPnL: number }>();
  for (const t of tradesWithPnL) { const key = t.strategyTag || "Untagged"; const e = stratMap.get(key) || { count: 0, wins: 0, totalPnL: 0 }; e.count++; if (t.pnl > 0) e.wins++; e.totalPnL += t.pnl; stratMap.set(key, e); }
  const strategyBreakdown = Array.from(stratMap.entries()).map(([strategy, d]) => ({ strategy, count: d.count, winRate: (d.wins / d.count) * 100, totalPnL: d.totalPnL, expectancy: d.totalPnL / d.count }));
  const srcMap = new Map<string, { count: number; wins: number; totalPnL: number }>();
  for (const t of tradesWithPnL) { const key = t.ideaSourceName || "Unknown"; const e = srcMap.get(key) || { count: 0, wins: 0, totalPnL: 0 }; e.count++; if (t.pnl > 0) e.wins++; e.totalPnL += t.pnl; srcMap.set(key, e); }
  const ideaSourceBreakdown = Array.from(srcMap.entries()).map(([source, d]) => ({ source, count: d.count, winRate: (d.wins / d.count) * 100, totalPnL: d.totalPnL })).sort((a, b) => b.totalPnL - a.totalPnL);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayMap = new Map<number, { count: number; totalPnL: number }>();
  for (const t of tradesWithPnL) { const day = new Date(t.tradedAt).getDay(); const e = dayMap.get(day) || { count: 0, totalPnL: 0 }; e.count++; e.totalPnL += t.pnl; dayMap.set(day, e); }
  const dayOfWeekPerformance = Array.from(dayMap.entries()).map(([d, data]) => ({ day: dayNames[d], count: data.count, avgPnL: data.totalPnL / data.count, totalPnL: data.totalPnL })).sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));
  return { totalTrades: tradesWithPnL.length, winRate, profitFactor, expectancy, avgWin, avgLoss, sharpeRatio, maxDrawdown, totalPnL, winStreak, lossStreak, currentStreak, currentStreakType, strategyBreakdown, ideaSourceBreakdown, dayOfWeekPerformance, holdingPeriodAnalysis: [{ period: "1-7 days", count: 3, totalPnL: 1200, winRate: 66.7 }, { period: "1-4 weeks", count: 7, totalPnL: 5400, winRate: 71.4 }, { period: "1-3 months", count: 8, totalPnL: 8200, winRate: 62.5 }, { period: "3-12 months", count: 2, totalPnL: 3100, winRate: 50.0 }] };
}

// ─── Helper Components ────────────────────────────────────────────

function MiniChart({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const w = 120; const h = 40;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const isUp = data[data.length - 1] >= data[0];
  return (<svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}><polyline fill="none" stroke={isUp ? "#22c55e" : "#ef4444"} strokeWidth="1.5" points={points} /></svg>);
}

// Same MetricCard as Company page — auto-hides when value is zero/N/A
function MetricCard({ label, value, isLoading, colorClass }: { label: string; value: string; isLoading: boolean; colorClass?: string }) {
  const zeroValues = ["\u2014", "N/A", "$0", "$0.00", "0.00", "0.00%", "$0.0", "0.0", "0.0%", "0.00x", "0.0x"];
  if (!isLoading && (zeroValues.includes(value) || value === "")) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-3">
      <p className="text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      {isLoading ? (<Skeleton className="h-6 w-20 bg-zinc-800" />) : (<p className={`text-sm sm:text-lg font-bold font-mono truncate ${colorClass || "text-white"}`}>{value}</p>)}
    </div>
  );
}

// Same MetricsGrid as Company page
function MetricsGrid({ profile, financials, forwardMetrics, profileLoading, financialsLoading, metricsLoading }: { profile?: StockProfile; financials?: Financials; forwardMetrics?: ForwardMetrics; profileLoading: boolean; financialsLoading: boolean; metricsLoading: boolean }) {
  const formatMarketCap = (value: number) => { if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`; if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`; if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`; return `$${value.toLocaleString()}`; };
  const formatLargeNumber = (value: number | undefined, prefix = "") => { if (value === undefined || value === null || value === 0) return "N/A"; if (value >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`; if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`; if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`; return `${prefix}${value.toLocaleString()}`; };
  const isASX = profile?.symbol?.endsWith(".AX") || false;
  const dayChangeColor = (profile?.changesPercentage ?? 0) >= 0 ? "text-green-500" : "text-red-500";
  const epsGrowthColor = (forwardMetrics?.forwardEpsGrowth ?? 0) >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white flex items-center gap-2"><BarChart3 className="h-4 w-4 text-amber-500" /> Key Metrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        <MetricCard label="Market Cap" value={profile?.marketCap != null ? formatMarketCap(profile.marketCap) : "\u2014"} isLoading={profileLoading} />
        <MetricCard label="Enterprise Value" value={financials?.enterpriseValue != null ? formatMarketCap(financials.enterpriseValue) : "N/A"} isLoading={financialsLoading} />
        <MetricCard label="Price" value={profile?.price != null ? `$${profile.price.toFixed(2)}` : "\u2014"} isLoading={profileLoading} />
        <MetricCard label="Day Change" value={profile?.changesPercentage != null ? `${profile.changesPercentage >= 0 ? "+" : ""}${profile.changesPercentage.toFixed(2)}%` : "\u2014"} isLoading={profileLoading} colorClass={dayChangeColor} />
        <MetricCard label="P/E (Forward)" value={forwardMetrics?.forwardPE != null ? `${forwardMetrics.forwardPE.toFixed(1)}x` : "\u2014"} isLoading={metricsLoading} />
        <MetricCard label="P/E (Trailing)" value={financials?.peRatio != null ? financials.peRatio.toFixed(2) : "N/A"} isLoading={financialsLoading} />
        <MetricCard label="Fwd EPS Growth" value={forwardMetrics?.forwardEpsGrowth != null ? `${forwardMetrics.forwardEpsGrowth >= 0 ? "+" : ""}${forwardMetrics.forwardEpsGrowth.toFixed(1)}%` : "\u2014"} isLoading={metricsLoading} colorClass={epsGrowthColor} />
        <MetricCard label="PEG Ratio" value={forwardMetrics?.pegRatio != null ? forwardMetrics.pegRatio.toFixed(2) : "\u2014"} isLoading={metricsLoading} />
        <MetricCard label={isASX ? "EV/EBIT (Forward)" : "EV/EBIT (Trailing)"} value={financials?.evToEbit != null ? `${financials.evToEbit.toFixed(1)}x` : "N/A"} isLoading={financialsLoading} />
        <MetricCard label="Dividend Yield" value={financials?.dividendYield != null ? `${(financials.dividendYield * 100).toFixed(2)}%` : "N/A"} isLoading={financialsLoading} />
        <MetricCard label="Revenue" value={formatLargeNumber(financials?.revenue, "$")} isLoading={financialsLoading} />
        <MetricCard label="Net Income" value={formatLargeNumber(financials?.netIncome, "$")} isLoading={financialsLoading} />
        <MetricCard label="ROE" value={financials?.roe != null ? `${(financials.roe * 100).toFixed(2)}%` : "N/A"} isLoading={financialsLoading} />
        {(financialsLoading || !financials || financials.debtToEquity * 100 >= -100) && (
          <MetricCard label="Debt/Equity" value={financials?.debtToEquity != null ? `${(financials.debtToEquity * 100).toFixed(1)}%` : "N/A"} isLoading={financialsLoading} />
        )}
        {(financialsLoading || !financials || financials.pbRatio >= 0) && (
          <MetricCard label="P/B Ratio" value={financials?.pbRatio != null ? financials.pbRatio.toFixed(2) : "N/A"} isLoading={financialsLoading} />
        )}
      </div>
    </div>
  );
}

// Analytics-specific metric card (different styling from company-page MetricCard)
function AnalyticsMetricCard({ label, value, subValue, color }: { label: string; value: string; subValue?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color || "text-white"}`}>{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1000000000) return `$${(val / 1000000000).toFixed(1)}B`;
  if (abs >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatPnL(val: number): string { return `${val >= 0 ? "+" : ""}${formatCurrency(val)}`; }

// ─── TradingView Chart ────────────────────────────────────────────

function TradingViewChart({ ticker, exchange, height = "h-[350px] sm:h-[450px]" }: { ticker: string; exchange?: string; height?: string }) {
  const iframeSrc = useMemo(() => {
    let tvSymbol = ticker;
    if (ticker.endsWith(".AX")) { tvSymbol = `ASX:${ticker.replace(".AX", "")}`; }
    else if (exchange) {
      const exchangeMap: Record<string, string> = { NASDAQ: "NASDAQ", NYSE: "NYSE", AMEX: "AMEX", LSE: "LSE", "London Stock Exchange": "LSE", ASX: "ASX", "Australian Securities Exchange": "ASX" };
      const prefix = exchangeMap[exchange];
      if (prefix && !ticker.includes(":")) tvSymbol = `${prefix}:${ticker}`;
    }
    const params = new URLSearchParams({ symbol: tvSymbol, interval: "D", theme: "dark", style: "1", locale: "en", hide_top_toolbar: "1", hide_side_toolbar: "1", hide_legend: "1", allow_symbol_change: "0", save_image: "0", calendar: "0", hide_volume: "0", backgroundColor: "rgba(9, 9, 11, 1)", gridColor: "rgba(242, 242, 242, 0.06)" });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [ticker, exchange]);
  return (<div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden ${height}`}><iframe src={iframeSrc} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen loading="lazy" /></div>);
}

// ─── Analytics Dashboard ──────────────────────────────────────────

function AnalyticsDashboard({ analytics, isDemo }: { analytics: Analytics; isDemo: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <BarChart3 className="w-4 h-4" /><span className="font-medium">Analytics Dashboard</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AnalyticsMetricCard label="Win Rate" value={`${analytics.winRate.toFixed(1)}%`} color={analytics.winRate >= 50 ? "text-green-400" : "text-red-400"} />
          <AnalyticsMetricCard label="Profit Factor" value={analytics.profitFactor === Infinity ? "---" : analytics.profitFactor.toFixed(2)} color={analytics.profitFactor >= 1 ? "text-green-400" : "text-red-400"} />
          <AnalyticsMetricCard label="Expectancy" value={formatPnL(analytics.expectancy)} color={analytics.expectancy >= 0 ? "text-green-400" : "text-red-400"} />
          <AnalyticsMetricCard label="Total P&L" value={formatPnL(analytics.totalPnL)} color={analytics.totalPnL >= 0 ? "text-green-400" : "text-red-400"} />
          <AnalyticsMetricCard label="Avg Win" value={formatPnL(analytics.avgWin)} color="text-green-400" />
          <AnalyticsMetricCard label="Avg Loss" value={formatPnL(analytics.avgLoss)} color="text-red-400" />
          <AnalyticsMetricCard label="Sharpe Ratio" value={analytics.sharpeRatio.toFixed(2)} color={analytics.sharpeRatio >= 1 ? "text-green-400" : analytics.sharpeRatio >= 0 ? "text-amber-400" : "text-red-400"} />
          <AnalyticsMetricCard label="Max Drawdown" value={formatCurrency(analytics.maxDrawdown)} color="text-red-400" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <AnalyticsMetricCard label="Win Streak" value={`${analytics.winStreak}`} color="text-green-400" />
          <AnalyticsMetricCard label="Loss Streak" value={`${analytics.lossStreak}`} color="text-red-400" />
          <AnalyticsMetricCard label="Current" value={`${analytics.currentStreak} ${analytics.currentStreakType || ""}`} color={analytics.currentStreakType === "win" ? "text-green-400" : analytics.currentStreakType === "loss" ? "text-red-400" : "text-zinc-400"} />
        </div>
        {analytics.ideaSourceBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">Who Made You The Most Money?</h3></div>
            <div className="space-y-2">
              {analytics.ideaSourceBreakdown.map((src, i) => (
                <div key={src.source} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 text-center font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-orange-400" : "text-zinc-500"}`}>{i === 0 ? "\ud83c\udfc6" : `#${i + 1}`}</span>
                    <span className="text-zinc-300">{src.source}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500 text-xs">{src.count} trades</span>
                    <span className="text-zinc-500 text-xs">{src.winRate.toFixed(0)}% win</span>
                    <span className={`font-mono font-semibold ${src.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnL(src.totalPnL)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {analytics.strategyBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Strategy Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-zinc-500 text-xs border-b border-zinc-800"><th className="text-left py-2">Strategy</th><th className="text-right py-2">Trades</th><th className="text-right py-2">Win Rate</th><th className="text-right py-2">P&L</th><th className="text-right py-2">Expectancy</th></tr></thead>
              <tbody>{analytics.strategyBreakdown.map(s => (<tr key={s.strategy} className="border-b border-zinc-800/50"><td className="py-2 text-zinc-300 capitalize">{s.strategy}</td><td className="py-2 text-right text-zinc-400">{s.count}</td><td className={`py-2 text-right ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{s.winRate.toFixed(0)}%</td><td className={`py-2 text-right font-mono ${s.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnL(s.totalPnL)}</td><td className={`py-2 text-right font-mono ${s.expectancy >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnL(s.expectancy)}</td></tr>))}</tbody></table>
            </div>
          </div>
        )}
        {analytics.dayOfWeekPerformance.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Day of Week Performance</h3>
            <div className="flex items-end gap-2 h-24">
              {analytics.dayOfWeekPerformance.map(d => { const maxAbs = Math.max(...analytics.dayOfWeekPerformance.map(x => Math.abs(x.avgPnL))); const barH = maxAbs > 0 ? (Math.abs(d.avgPnL) / maxAbs) * 80 : 0; return (<div key={d.day} className="flex-1 flex flex-col items-center gap-1"><div className="flex-1 flex items-end w-full"><div className={`w-full rounded-t ${d.avgPnL >= 0 ? "bg-green-500/60" : "bg-red-500/60"}`} style={{ height: `${Math.max(barH, 4)}px` }} /></div><span className="text-[10px] text-zinc-500">{d.day.slice(0, 3)}</span></div>); })}
            </div>
          </div>
        )}
        {analytics.holdingPeriodAnalysis.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Holding Period Analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {analytics.holdingPeriodAnalysis.filter(h => h.count > 0).map(h => (<div key={h.period} className="bg-zinc-800/50 rounded p-2"><p className="text-xs text-zinc-500">{h.period}</p><p className={`text-sm font-mono font-semibold ${h.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnL(h.totalPnL)}</p><p className="text-xs text-zinc-500">{h.count} trades | {h.winRate.toFixed(0)}% win</p></div>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────

function TradeCard({ trade, onDelete, isDemo }: { trade: any; onDelete?: (id: number) => void; isDemo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const pnl = trade.pnl;
  const hasPnL = typeof pnl === "number";
  const profileSnap = trade.profileSnapshot as any;
  const financialsSnap = trade.financialsSnapshot as any;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors">
        <Badge className={`text-xs shrink-0 ${trade.action === "buy" ? "bg-green-900/50 text-green-400 border-green-800" : "bg-red-900/50 text-red-400 border-red-800"}`}>{trade.action === "buy" ? "BUY" : "SELL"}</Badge>
        <span className="font-mono font-semibold text-amber-400 shrink-0">{trade.ticker}</span>
        <span className="text-zinc-400 text-sm truncate hidden sm:inline">{parseFloat(trade.shares).toLocaleString()} @ ${parseFloat(trade.price).toFixed(2)}</span>
        {trade.strategyTag && (<Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 shrink-0 hidden md:inline-flex">{trade.strategyTag}</Badge>)}
        <div className="flex-1" />
        {hasPnL && (<span className={`font-mono text-sm font-semibold shrink-0 ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnL(pnl)}{typeof trade.returnPct === "number" && <span className="ml-1 text-xs opacity-80">({trade.returnPct >= 0 ? "+" : ""}{trade.returnPct.toFixed(1)}%)</span>}</span>)}
        <span className="text-xs text-zinc-600 shrink-0 hidden sm:inline">{new Date(trade.tradedAt).toLocaleDateString()}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-zinc-500 text-xs">Shares</span><p className="text-white">{parseFloat(trade.shares).toLocaleString()}</p></div>
            <div><span className="text-zinc-500 text-xs">Price</span><p className="text-white">${parseFloat(trade.price).toFixed(2)}</p></div>
            <div><span className="text-zinc-500 text-xs">Total</span><p className="text-white">${trade.totalValue ? parseFloat(trade.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "\u2014"}</p></div>
            <div><span className="text-zinc-500 text-xs">Date</span><p className="text-white">{new Date(trade.tradedAt).toLocaleDateString()}</p></div>
          </div>
          {(trade.setupType || trade.emotionalState || trade.ideaSource) && (
            <div className="flex flex-wrap gap-2">
              {trade.setupType && <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{trade.setupType.replace("_", " ")}</Badge>}
              {trade.emotionalState && <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{trade.emotionalState}</Badge>}
              {trade.ideaSource && (<Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{trade.ideaSourceName || trade.ideaSource}</Badge>)}
            </div>
          )}
          {trade.notes && (<p className="text-sm text-zinc-400 bg-zinc-800/50 rounded p-2">{trade.notes}</p>)}
          {(profileSnap || financialsSnap) && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium">Snapshot at time of trade</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {profileSnap?.sector && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">Sector</span><p className="text-xs text-white truncate">{profileSnap.sector}</p></div>)}
                {profileSnap?.industry && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">Industry</span><p className="text-xs text-white truncate">{profileSnap.industry}</p></div>)}
                {profileSnap?.marketCap > 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">Mkt Cap</span><p className="text-xs text-white font-mono">{formatCurrency(profileSnap.marketCap)}</p></div>)}
                {financialsSnap?.peRatio > 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">P/E</span><p className="text-xs text-white font-mono">{financialsSnap.peRatio.toFixed(1)}</p></div>)}
                {financialsSnap?.roe != null && financialsSnap.roe !== 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">ROE</span><p className="text-xs text-white font-mono">{(financialsSnap.roe * 100).toFixed(1)}%</p></div>)}
                {financialsSnap?.evToEbit != null && financialsSnap.evToEbit > 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">EV/EBIT</span><p className="text-xs text-white font-mono">{financialsSnap.evToEbit.toFixed(1)}</p></div>)}
                {financialsSnap?.debtToEquity != null && financialsSnap.debtToEquity !== 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">D/E</span><p className="text-xs text-white font-mono">{(financialsSnap.debtToEquity * 100).toFixed(1)}%</p></div>)}
                {financialsSnap?.pbRatio != null && financialsSnap.pbRatio > 0 && (<div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-[10px] text-zinc-500">P/B</span><p className="text-xs text-white font-mono">{financialsSnap.pbRatio.toFixed(2)}</p></div>)}
              </div>
            </div>
          )}
          {trade.chartSnapshot && Array.isArray(trade.chartSnapshot) && trade.chartSnapshot.length > 1 && (<MiniChart data={trade.chartSnapshot} />)}
          {!isDemo && trade.ticker && (<TradingViewChart ticker={trade.ticker} height="h-[250px]" />)}
          {!isDemo && onDelete && (<button onClick={(e) => { e.stopPropagation(); onDelete(trade.id); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-2"><Trash2 className="w-3 h-3" /> Delete trade</button>)}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab Content ────────────────────────────────────────

function AnalyticsTabContent() {
  const { isAuthenticated } = useAuth();
  const { isPro } = useBroStatus();
  const demoAnalytics = useMemo(() => computeDemoAnalytics(), []);

  const { data: trades = [] } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
    enabled: isAuthenticated && isPro,
  });
  const { data: realAnalytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/trades/analytics"],
    enabled: isAuthenticated && isPro,
  });

  const hasEnoughTrades = trades.length >= 10;

  if (!isAuthenticated || !isPro) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1"><p className="text-amber-400 font-medium text-sm">This is sample data</p><p className="text-zinc-400 text-xs mt-0.5">Upgrade to Pro to track your real trades and unlock full analytics.</p></div>
          <a href="/subscription"><Button size="sm" className="neon-button shrink-0"><Lock className="w-3 h-3 mr-1" /> Upgrade</Button></a>
        </div>
        <AnalyticsDashboard analytics={demoAnalytics} isDemo={true} />
      </div>
    );
  }

  if (!hasEnoughTrades) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="flex-1"><p className="text-blue-400 font-medium text-sm">Sample data shown below</p><p className="text-zinc-400 text-xs mt-0.5">Log at least 10 trades in the Trade Journal to see your real analytics.</p></div>
        </div>
        <AnalyticsDashboard analytics={demoAnalytics} isDemo={true} />
      </div>
    );
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-20 bg-zinc-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (realAnalytics && realAnalytics.totalTrades > 0) {
    return <AnalyticsDashboard analytics={realAnalytics} isDemo={false} />;
  }

  return <AnalyticsDashboard analytics={demoAnalytics} isDemo={true} />;
}

// ─── Trade Journal Tab Content ────────────────────────────────────

function DemoTradeJournal() {
  const [filterTicker, setFilterTicker] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const demoTradesWithPnL = useMemo(() => DUMMY_TRADES.map(t => { const ep = parseFloat(t.price); const sh = parseFloat(t.shares); const cp = DUMMY_PRICES[t.ticker] || ep; return { ...t, pnl: t.action === "buy" ? (cp - ep) * sh : (ep - cp) * sh }; }), []);
  const filteredTrades = useMemo(() => demoTradesWithPnL.filter(t => { if (filterTicker && !t.ticker.includes(filterTicker.toUpperCase())) return false; if (filterStrategy && t.strategyTag !== filterStrategy) return false; if (filterAction && t.action !== filterAction) return false; return true; }), [demoTradesWithPnL, filterTicker, filterStrategy, filterAction]);

  return (
    <div className="space-y-6">
      <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <div className="flex-1"><p className="text-amber-400 font-medium text-sm">This is sample data</p><p className="text-zinc-400 text-xs mt-0.5">Upgrade to Pro to track your real trades and unlock full analytics.</p></div>
        <a href="/subscription"><Button size="sm" className="neon-button shrink-0"><Lock className="w-3 h-3 mr-1" /> Upgrade</Button></a>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Filter by ticker..." value={filterTicker} onChange={(e) => setFilterTicker(e.target.value.toUpperCase())} className="bg-zinc-800 border-zinc-700 text-white w-40 text-sm" data-testid="input-filter-ticker" />
        <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">All strategies</option><option value="momentum">Momentum</option><option value="growth">Growth</option><option value="contrarian">Contrarian</option><option value="value">Value</option><option value="swing">Swing</option></select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">All actions</option><option value="buy">Buys</option><option value="sell">Sells</option></select>
      </div>
      <div className="space-y-2">{filteredTrades.map(t => (<TradeCard key={t.id} trade={t} isDemo={true} />))}</div>
    </div>
  );
}

function RealTradeJournal() {
  const { toast } = useToast();
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell" | null>(null);
  const [filterTicker, setFilterTicker] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split("T")[0]);
  const [strategyTag, setStrategyTag] = useState("");
  const [setupType, setSetupType] = useState("");
  const [emotionalState, setEmotionalState] = useState("");
  const [ideaSource, setIdeaSource] = useState("");
  const [ideaSourceName, setIdeaSourceName] = useState("");
  const [notes, setNotes] = useState("");
  const [updatePortfolio, setUpdatePortfolio] = useState(true);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { data: strategies = [] } = useQuery<string[]>({ queryKey: ["/api/trades/labels/strategies"] });
  const { data: setups = [] } = useQuery<string[]>({ queryKey: ["/api/trades/labels/setups"] });
  const { data: sources = [] } = useQuery<string[]>({ queryKey: ["/api/trades/labels/sources"] });
  const { data: profile, isLoading: profileLoading } = useQuery<StockProfile>({ queryKey: ["/api/analysis/profile/" + selectedTicker], enabled: !!selectedTicker });
  const { data: financials, isLoading: financialsLoading } = useQuery<Financials>({ queryKey: ["/api/analysis/financials/" + selectedTicker], enabled: !!selectedTicker });
  const { data: historyRaw } = useQuery<any>({ queryKey: ["/api/analysis/history/" + selectedTicker], enabled: !!selectedTicker });
  const { data: forwardMetrics, isLoading: metricsLoading } = useQuery<ForwardMetrics>({ queryKey: ["/api/analysis/forward/" + selectedTicker], enabled: !!selectedTicker });

  const chartData = useMemo(() => {
    const arr = historyRaw?.data || historyRaw;
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map((d: any) => d.close ?? d.price).filter(Boolean);
  }, [historyRaw]);

  useEffect(() => { if (profile?.price && profile.price > 0) setPrice(profile.price.toFixed(2)); }, [profile?.price]);
  useEffect(() => { setTradeAction(null); setShares(""); setTradeDate(new Date().toISOString().split("T")[0]); setStrategyTag(""); setSetupType(""); setEmotionalState(""); setIdeaSource(""); setIdeaSourceName(""); setNotes(""); }, [selectedTicker]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/trades", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/labels/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/labels/setups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/labels/sources"] });
      if (updatePortfolio) { queryClient.invalidateQueries({ queryKey: ["/api/portfolio/enriched"] }); queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }); }
      toast({ title: "Trade logged", description: `${tradeAction!.toUpperCase()} ${shares} shares of ${selectedTicker} @ $${price}` });
      setTradeAction(null); setShares(""); setTradeDate(new Date().toISOString().split("T")[0]); setStrategyTag(""); setSetupType(""); setEmotionalState(""); setIdeaSource(""); setIdeaSourceName(""); setNotes("");
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to log trade";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/trades/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/trades"] }); queryClient.invalidateQueries({ queryKey: ["/api/trades/analytics"] }); toast({ title: "Trade deleted" }); },
  });

  const handleSelectTicker = useCallback((symbol: string, name: string) => { setSelectedTicker(symbol); setSelectedName(name); }, []);

  const handleSubmit = () => {
    if (!shares || !price || !tradeAction) return;
    createMutation.mutate({
      ticker: selectedTicker, companyName: selectedName || profile?.companyName || selectedTicker, action: tradeAction, shares, price,
      tradedAt: new Date(tradeDate).toISOString(), strategyTag: strategyTag || null, setupType: setupType || null, emotionalState: emotionalState || null,
      ideaSource: ideaSource || null, ideaSourceName: ideaSourceName || null, notes: notes || null,
      profileSnapshot: profile || null, financialsSnapshot: financials || null,
      chartSnapshot: chartData.length > 0 ? chartData : null, forwardMetricsSnapshot: forwardMetrics || null,
      portfolioUpdated: updatePortfolio, updatePortfolio,
    });
  };

  const totalValue = shares && price ? (parseFloat(shares) * parseFloat(price)).toFixed(2) : "0.00";
  const emotions = ["confident", "neutral", "anxious", "excited", "fomo", "fearful"];
  const tradesWithPnL = useMemo(() => trades.map(t => ({ ...t })), [trades]);
  const filteredTrades = useMemo(() => tradesWithPnL.filter(t => { if (filterTicker && !t.ticker.includes(filterTicker.toUpperCase())) return false; if (filterStrategy && t.strategyTag !== filterStrategy) return false; if (filterAction && t.action !== filterAction) return false; return true; }), [tradesWithPnL, filterTicker, filterStrategy, filterAction]);
  const uniqueStrategies = useMemo(() => { const s = new Set(trades.map(t => t.strategyTag).filter(Boolean)); return Array.from(s) as string[]; }, [trades]);
  const clearSelection = () => { setSelectedTicker(""); setSelectedName(""); setTradeAction(null); };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Trade Journal</h3>
        <StockSearch onSelect={handleSelectTicker} placeholder="Search for a stock to trade..." clearOnSelect={false} />

        {selectedTicker && !profile && profileLoading && (<div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>)}

        {selectedTicker && profile && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-amber-400 text-xl">{profile.symbol}</span>
                  <span className="text-zinc-300 text-sm truncate">{profile.companyName}</span>
                  <button onClick={clearSelection} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {profile.sector && (<Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400"><Building2 className="w-3 h-3 mr-1" />{profile.sector}</Badge>)}
                  {profile.industry && (<Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{profile.industry}</Badge>)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-white font-mono text-xl font-bold">${profile.price.toFixed(2)}</span>
                <div className={`text-sm font-mono ${profile.changes >= 0 ? "text-green-400" : "text-red-400"}`}>{profile.changes >= 0 ? "+" : ""}{profile.changes?.toFixed(2)} ({profile.changesPercentage?.toFixed(2)}%)</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setTradeAction(tradeAction === "buy" ? null : "buy")} className={`flex-1 font-semibold text-lg py-5 ${tradeAction === "buy" ? "bg-green-600 hover:bg-green-500 text-white ring-2 ring-green-400" : "bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-800"}`}><ArrowUpRight className="w-5 h-5 mr-1" /> BUY</Button>
              <Button onClick={() => setTradeAction(tradeAction === "sell" ? null : "sell")} className={`flex-1 font-semibold text-lg py-5 ${tradeAction === "sell" ? "bg-red-600 hover:bg-red-500 text-white ring-2 ring-red-400" : "bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-800"}`}><ArrowDownRight className="w-5 h-5 mr-1" /> SELL</Button>
            </div>

            {tradeAction && (
              <div className="space-y-4 border-t border-zinc-800 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-zinc-400 text-xs">Shares</Label><Input type="number" step="any" min="0" placeholder="100" value={shares} onChange={(e) => setShares(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                  <div><Label className="text-zinc-400 text-xs">Price ($)</Label><Input type="number" step="0.01" min="0" placeholder="150.00" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-zinc-400 text-xs">Trade Date</Label><Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                  <div><Label className="text-zinc-400 text-xs">Total Value</Label><div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white font-mono text-sm">${totalValue}</div></div>
                </div>
                <button type="button" onClick={() => setShowMoreDetails(!showMoreDetails)} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors w-full py-1">
                  {showMoreDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>More Details (optional)</span>
                </button>
                {showMoreDetails && (
                  <div className="space-y-4 border-l-2 border-zinc-800 pl-3">
                    <div><Label className="text-zinc-400 text-xs">Strategy Tag</Label><Input placeholder="e.g., momentum, value, swing" value={strategyTag} onChange={(e) => setStrategyTag(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1" list="strategy-list" /><datalist id="strategy-list">{strategies.map(s => <option key={s} value={s} />)}</datalist></div>
                    <div><Label className="text-zinc-400 text-xs">Setup Type</Label><select value={setupType} onChange={(e) => setSetupType(e.target.value)} className="w-full mt-1 bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">Select...</option><option value="technical">Technical</option><option value="fundamental">Fundamental</option><option value="catalyst_driven">Catalyst Driven</option><option value="market_conditions">Market Conditions</option></select></div>
                    <div><Label className="text-zinc-400 text-xs">Emotional State</Label><div className="flex flex-wrap gap-2 mt-1">{emotions.map(e => (<button key={e} onClick={() => setEmotionalState(emotionalState === e ? "" : e)} className={`px-3 py-1 rounded-full text-xs border transition-colors ${emotionalState === e ? "border-amber-500 bg-amber-900/30 text-amber-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>{e}</button>))}</div></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-zinc-400 text-xs">Idea Source</Label><select value={ideaSource} onChange={(e) => setIdeaSource(e.target.value)} className="w-full mt-1 bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">Select...</option><option value="self">Self</option><option value="broker">Broker</option><option value="friend">Friend</option><option value="research">Research</option><option value="fund_manager">Fund Manager</option><option value="other">Other</option></select></div>
                      <div><Label className="text-zinc-400 text-xs">Source Name</Label><Input placeholder="e.g., Goldman Sachs" value={ideaSourceName} onChange={(e) => setIdeaSourceName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1" list="source-list" /><datalist id="source-list">{sources.map(s => <option key={s} value={s} />)}</datalist></div>
                    </div>
                    <div><Label className="text-zinc-400 text-xs">Notes</Label><Textarea placeholder="Why are you making this trade?" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white mt-1 min-h-[60px]" /></div>
                  </div>
                )}
                <div className="flex items-center gap-3"><Switch checked={updatePortfolio} onCheckedChange={setUpdatePortfolio} /><Label className="text-zinc-400 text-sm">Update Portfolio</Label></div>
                <Button onClick={handleSubmit} disabled={!shares || !price || createMutation.isPending} className={`w-full font-semibold py-5 ${tradeAction === "buy" ? "bg-green-600 hover:bg-green-500 text-white" : "bg-red-600 hover:bg-red-500 text-white"}`}>{createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `${tradeAction === "buy" ? "Buy" : "Sell"} ${selectedTicker}`}</Button>
              </div>
            )}

            <MetricsGrid profile={profile} financials={financials} forwardMetrics={forwardMetrics} profileLoading={profileLoading} financialsLoading={financialsLoading} metricsLoading={metricsLoading} />
            <TradingViewChart ticker={selectedTicker} exchange={profile.exchange} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Trade History</h3>
        {trades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Filter by ticker..." value={filterTicker} onChange={(e) => setFilterTicker(e.target.value.toUpperCase())} className="bg-zinc-800 border-zinc-700 text-white w-40 text-sm" />
            <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">All strategies</option>{uniqueStrategies.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"><option value="">All actions</option><option value="buy">Buys</option><option value="sell">Sells</option></select>
          </div>
        )}
        {tradesLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 bg-zinc-800" />)}</div>
        ) : filteredTrades.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center"><Target className="w-8 h-8 text-zinc-600 mx-auto mb-3" /><p className="text-zinc-400 text-sm">No trades yet. Search for a stock above to log your first trade.</p></div>
        ) : (
          <div className="space-y-2">{filteredTrades.map(t => (<TradeCard key={t.id} trade={t} isDemo={false} onDelete={(id) => deleteMutation.mutate(id)} />))}</div>
        )}
      </div>
    </div>
  );
}

function TradeJournalTabContent() {
  const { isAuthenticated } = useAuth();
  const { isPro } = useBroStatus();

  if (isAuthenticated && isPro) {
    return <RealTradeJournal />;
  }
  return <DemoTradeJournal />;
}

// ─── Position Size Calculator ─────────────────────────────────────

function PositionSizeCalculator() {
  const { isAuthenticated } = useAuth();
  const { isPro } = useBroStatus();

  const { data: portfolioData } = useQuery<any[]>({
    queryKey: ["/api/portfolio/enriched"],
    enabled: isAuthenticated === true,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["/api/trades/analytics"],
    enabled: isAuthenticated && isPro,
  });

  const computedPortfolioValue = useMemo(() => {
    if (!portfolioData || !Array.isArray(portfolioData)) return 0;
    return portfolioData.reduce((sum: number, item: any) => {
      const cp = item.currentPrice || 0;
      const sh = parseFloat(item.shares) || 0;
      return sum + cp * sh;
    }, 0);
  }, [portfolioData]);

  const [portfolioSize, setPortfolioSize] = useState("");
  const [selectedStock, setSelectedStock] = useState<{ ticker: string; name: string } | null>(null);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [riskPercent, setRiskPercent] = useState(1);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  useEffect(() => {
    if (computedPortfolioValue > 0 && !portfolioSize) {
      setPortfolioSize(computedPortfolioValue.toFixed(2));
    }
  }, [computedPortfolioValue]);

  const handleStockSelect = async (ticker: string, name: string) => {
    setSelectedStock({ ticker, name });
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/analysis/profile/${encodeURIComponent(ticker)}`);
      if (res.ok) {
        const data = await res.json();
        const price = data?.price || data?.profile?.price || 0;
        if (price > 0) {
          setEntryPrice(price.toString());
          setStopLoss((price * 0.9).toFixed(2));
          setTargetPrice((price * 1.3).toFixed(2));
        }
      }
    } catch {}
    setFetchingPrice(false);
  };

  const ps = parseFloat(portfolioSize) || 0;
  const ep = parseFloat(entryPrice) || 0;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(targetPrice) || 0;

  const allFilled = ps > 0 && ep > 0 && sl > 0 && tp > 0 && sl !== ep;

  const dollarRiskPerShare = Math.abs(ep - sl);
  const riskAmount = ps * (riskPercent / 100);
  const positionSize = dollarRiskPerShare > 0 ? Math.floor(riskAmount / dollarRiskPerShare) : 0;
  const positionValue = positionSize * ep;
  const pctOfPortfolio = ps > 0 ? (positionValue / ps) * 100 : 0;
  const riskRewardRatio = dollarRiskPerShare > 0 ? (tp - ep) / (ep - sl) : 0;

  const dollarLossAtStop = positionSize * dollarRiskPerShare;
  const pctLossAtStop = ps > 0 ? (dollarLossAtStop / ps) * 100 : 0;
  const dollarGainAtTarget = positionSize * (tp - ep);
  const pctGainAtTarget = ps > 0 ? (dollarGainAtTarget / ps) * 100 : 0;

  const rrFeedback = useMemo(() => {
    if (!allFilled) return null;
    const rr = Math.abs(riskRewardRatio);
    if (rr >= 5) return { color: "bg-green-900/30 border-green-800 text-green-400", icon: <Sparkles className="w-4 h-4" />, message: "Excellent risk/reward! Even with a 20% win rate you'd be profitable." };
    if (rr >= 2) return { color: "bg-green-900/30 border-green-800 text-green-400", icon: <CheckCircle2 className="w-4 h-4" />, message: "Good risk/reward. Bro approves." };
    if (rr >= 1) return { color: "bg-amber-900/30 border-amber-800 text-amber-400", icon: <Scale className="w-4 h-4" />, message: "Decent. At 1:1 you need 50% win rate, at 2:1 you only need 34%." };
    return { color: "bg-red-900/30 border-red-800 text-red-400", icon: <AlertTriangle className="w-4 h-4" />, message: "Below average risk/reward. At 1:1 you need to win >50% of trades just to break even." };
  }, [allFilled, riskRewardRatio]);

  const winRateRef = [
    { rate: "30%", rr: "2.33:1" },
    { rate: "40%", rr: "1.50:1" },
    { rate: "50%", rr: "1.00:1" },
    { rate: "60%", rr: "0.67:1" },
    { rate: "70%", rr: "0.43:1" },
    { rate: "80%", rr: "0.25:1" },
  ];

  const hasUserAnalytics = analytics && analytics.totalTrades > 0;
  const userWinRate = hasUserAnalytics ? analytics.winRate : null;
  const userWinRateDecimal = userWinRate !== null ? userWinRate / 100 : null;
  const requiredRR = userWinRateDecimal !== null && userWinRateDecimal > 0 ? (1 - userWinRateDecimal) / userWinRateDecimal : null;
  const avgRR = hasUserAnalytics && analytics.avgLoss !== 0 ? analytics.avgWin / Math.abs(analytics.avgLoss) : null;
  const kellyPct = userWinRateDecimal !== null && avgRR !== null && avgRR > 0 ? (userWinRateDecimal - ((1 - userWinRateDecimal) / avgRR)) * 100 : null;

  const fmtDollar = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" /> Position Size Calculator
        </h3>

        <div>
          <Label className="text-zinc-400 text-xs">Select Stock</Label>
          <div className="mt-1">
            <StockSearch
              onSelect={handleStockSelect}
              placeholder="Search for a stock..."
              clearOnSelect={false}
              value={selectedStock?.ticker || ""}
              inputTestId="input-sizer-stock-search"
              optionIdPrefix="sizer-stock-option"
            />
          </div>
          {selectedStock && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs font-mono">{selectedStock.ticker}</Badge>
              <span className="text-xs text-zinc-400 truncate">{selectedStock.name}</span>
              {fetchingPrice && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
              <button
                onClick={() => { setSelectedStock(null); setEntryPrice(""); }}
                className="ml-auto text-zinc-500 hover:text-zinc-300"
                data-testid="button-clear-stock"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-400 text-xs">Portfolio Value</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="100000"
                value={portfolioSize}
                onChange={(e) => setPortfolioSize(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white pl-7"
                data-testid="input-portfolio-size"
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Current Price (Entry)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={selectedStock ? "Fetching..." : "150.00"}
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white pl-7"
                data-testid="input-entry-price"
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Stop Loss Price</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="140.00"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white pl-7"
                data-testid="input-stop-loss"
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400 text-xs">Target Price</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="180.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white pl-7"
                data-testid="input-target-price"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-zinc-400 text-xs flex items-center gap-1"><Percent className="w-3 h-3" /> Portfolio Risk %</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Math.min(100, Math.max(0.1, parseFloat(e.target.value) || 0.1)))}
              className="bg-zinc-800 border-zinc-700 text-white w-20 text-sm text-center"
              data-testid="input-risk-percent"
            />
          </div>
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={riskPercent}
            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-zinc-500 mt-1">Suggested: 0.5% - 2%</p>
        </div>
      </div>

      {allFilled && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" /> Trade Summary
              {selectedStock && <span className="text-xs text-zinc-500 font-normal ml-auto">{selectedStock.ticker}</span>}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-800/50 rounded-md p-3">
                <p className="text-xs text-zinc-500 mb-1">Quantity</p>
                <p className="text-lg font-bold font-mono text-amber-400" data-testid="text-shares-qty">{positionSize.toLocaleString()}<span className="text-xs text-zinc-500 ml-1">shares</span></p>
              </div>
              <div className="bg-zinc-800/50 rounded-md p-3">
                <p className="text-xs text-zinc-500 mb-1">Position Value</p>
                <p className="text-lg font-bold font-mono text-white" data-testid="text-position-value">{fmtDollar(positionValue)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-md p-3">
                <p className="text-xs text-zinc-500 mb-1">Portfolio Value</p>
                <p className="text-lg font-bold font-mono text-zinc-300" data-testid="text-portfolio-value">{fmtDollar(ps)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-md p-3">
                <p className="text-xs text-zinc-500 mb-1">% of Portfolio</p>
                <p className={`text-lg font-bold font-mono ${pctOfPortfolio > 25 ? "text-red-400" : pctOfPortfolio > 10 ? "text-amber-400" : "text-green-400"}`} data-testid="text-pct-portfolio">{pctOfPortfolio.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-red-900/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4" /> If Stop Loss Hit
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">$ Loss</p>
                  <p className="text-lg font-bold font-mono text-red-400" data-testid="text-dollar-loss">-{fmtDollar(dollarLossAtStop)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">% Loss on Portfolio</p>
                  <p className="text-lg font-bold font-mono text-red-400" data-testid="text-pct-loss">-{pctLossAtStop.toFixed(2)}%</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Risk per share: {fmtDollar(dollarRiskPerShare)}</p>
            </div>

            <div className="bg-zinc-900 border border-green-900/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" /> If Target Hit
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">$ Gain</p>
                  <p className="text-lg font-bold font-mono text-green-400" data-testid="text-dollar-gain">+{fmtDollar(dollarGainAtTarget)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">% Gain on Portfolio</p>
                  <p className="text-lg font-bold font-mono text-green-400" data-testid="text-pct-gain">+{pctGainAtTarget.toFixed(2)}%</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Reward per share: {fmtDollar(tp - ep)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AnalyticsMetricCard label="Risk Amount" value={fmtDollar(riskAmount)} color="text-red-400" />
            <AnalyticsMetricCard label="Dollar Risk/Share" value={fmtDollar(dollarRiskPerShare)} color="text-zinc-300" />
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="text-risk-reward">
              <p className="text-xs text-zinc-500 mb-1">Risk/Reward</p>
              <p className={`text-lg font-bold font-mono ${riskRewardRatio >= 2 ? "text-green-400" : riskRewardRatio >= 1 ? "text-amber-400" : "text-red-400"}`}>
                {Math.abs(riskRewardRatio).toFixed(2)}:1
              </p>
            </div>
          </div>
          <div data-testid="text-position-size" className="sr-only">{positionSize}</div>

          {rrFeedback && (
            <div className={`border rounded-lg p-4 flex items-start gap-3 ${rrFeedback.color}`}>
              {rrFeedback.icon}
              <p className="text-sm">{rrFeedback.message}</p>
            </div>
          )}

          {isAuthenticated && hasUserAnalytics && userWinRate !== null && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /> Your Stats</h4>
              <div className="space-y-2 text-sm">
                <p className="text-zinc-300">Your Win Rate: <span className="font-mono font-bold text-amber-400">{userWinRate.toFixed(1)}%</span></p>
                {requiredRR !== null && (
                  <p className="text-zinc-400">Based on your {userWinRate.toFixed(1)}% win rate, you need at least <span className="font-mono font-semibold text-white">{requiredRR.toFixed(2)}:1</span> risk/reward to be profitable</p>
                )}
                {kellyPct !== null && (
                  <p className="text-zinc-400">Optimal position size (Kelly): <span className="font-mono font-semibold text-white">{Math.max(0, kellyPct).toFixed(1)}%</span> of portfolio</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Win Rate vs Required Risk/Reward</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                    <th className="text-left py-2 pr-4">Win Rate</th>
                    <th className="text-right py-2">Min R:R to Break Even</th>
                  </tr>
                </thead>
                <tbody>
                  {winRateRef.map(row => (
                    <tr key={row.rate} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300 font-mono">{row.rate}</td>
                      <td className="py-2 text-right text-zinc-300 font-mono">{row.rr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function TradeTrackerPage() {
  useDocumentTitle("Trade Tools");
  const { isAuthenticated } = useAuth();
  const { isPro } = useBroStatus();
  const { gate, showLoginModal, closeLoginModal } = useLoginGate();
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="display-font text-xl sm:text-3xl md:text-4xl font-bold tracking-wider text-white">TRADE TOOLS</h1>
            <p className="text-zinc-500 text-sm mt-1">Log trades, track performance, find your edge</p>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <div className="overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-4 sm:mb-6 inline-flex min-w-max gap-1">
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-analytics"
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="journal"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-trade-journal"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Trade Journal
              </TabsTrigger>
              <TabsTrigger
                value="sizer"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-position-sizer"
              >
                <Calculator className="w-3.5 h-3.5 mr-1.5" />
                Position Sizer
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analytics">
            <AnalyticsTabContent />
          </TabsContent>

          <TabsContent value="journal">
            <TradeJournalTabContent />
          </TabsContent>

          <TabsContent value="sizer">
            <PositionSizeCalculator />
          </TabsContent>
        </Tabs>
      </div>
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
    </div>
  );
}
