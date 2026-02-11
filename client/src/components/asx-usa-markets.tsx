import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { ExternalLink, TrendingUp, TrendingDown, Clock, Activity, Newspaper, BarChart3 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface MarketItem {
  name: string;
  price: number;
  change1D: number;
  change1M?: number;
  change1Q?: number;
  change1Y?: number;
  vs10D?: number;
  vs20D?: number;
  vs200D?: number;
  category?: string;
}

interface UsStatus {
  status: "pre-market" | "open" | "after-hours" | "closed" | "unknown";
  currentTimeET: string;
  currentTimeAEST: string;
  nextEvent: string;
  minutesToNext: number;
}

interface IntradayPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IntradayData {
  symbols: Record<string, IntradayPoint[]>;
  fetchedAt: string;
}

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
}

interface MarketSummary {
  summary: string;
  generatedAt: string;
}

interface MarketsData {
  globalMarkets: MarketItem[];
  futures: MarketItem[];
  commodities: MarketItem[];
  usaThematics: MarketItem[];
  usaSectors: MarketItem[];
  usaEqualWeight: MarketItem[];
  asxSectors: MarketItem[];
  forex: MarketItem[];
  lastUpdated: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string; pulse: boolean }> = {
  "open":        { label: "MARKET OPEN",    color: "text-green-400", dotColor: "bg-green-400", pulse: true },
  "pre-market":  { label: "PRE-MARKET",     color: "text-yellow-400", dotColor: "bg-yellow-400", pulse: true },
  "after-hours": { label: "AFTER HOURS",    color: "text-orange-400", dotColor: "bg-orange-400", pulse: true },
  "closed":      { label: "MARKET CLOSED",  color: "text-zinc-500", dotColor: "bg-zinc-500", pulse: false },
  "unknown":     { label: "—",              color: "text-zinc-500", dotColor: "bg-zinc-500", pulse: false },
};

function formatMinutes(mins: number): string {
  if (mins <= 0) return "now";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-Components ──────────────────────────────────────────────────

function SessionStatusHeader({ status }: { status?: UsStatus }) {
  const cfg = STATUS_CONFIG[status?.status || "unknown"];
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <h2 className="display-font text-lg sm:text-2xl font-bold tracking-wider text-white">
          US MARKETS
        </h2>
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2.5 w-2.5`}>
            {cfg.pulse && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotColor} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dotColor}`} />
          </span>
          <span className={`text-xs sm:text-sm ticker-font font-semibold ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>
      {status && status.status !== "unknown" && (
        <div className="flex items-center gap-4 text-xs ticker-font text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>ET {status.currentTimeET.split(", ").pop()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>AEST {status.currentTimeAEST.split(", ").pop()}</span>
          </div>
          {status.nextEvent && (
            <span className="text-zinc-600">
              {status.nextEvent} in {formatMinutes(status.minutesToNext)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data, width = 80, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return <div style={{ width, height }} className="bg-zinc-800/50 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={isUp ? "#22c55e" : "#ef4444"} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function IndexOverviewCards({ globalMarkets, intradayData }: { globalMarkets: MarketItem[]; intradayData?: IntradayData }) {
  const indices = useMemo(() => {
    const tickers = ["SPY", "QQQ", "DIA"];
    return tickers.map(ticker => {
      const item = globalMarkets.find(m => m.name?.toUpperCase().includes(ticker) || m.name?.includes(
        ticker === "SPY" ? "S&P" : ticker === "QQQ" ? "Nasdaq" : "Dow"
      ));
      const sparkData = intradayData?.symbols?.[ticker]?.map(d => d.close) || [];
      return { ticker, item, sparkData };
    });
  }, [globalMarkets, intradayData]);

  const labels: Record<string, string> = { SPY: "S&P 500", QQQ: "Nasdaq 100", DIA: "Dow Jones" };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
      {indices.map(({ ticker, item, sparkData }) => {
        const change = item?.change1D ?? 0;
        const isUp = change >= 0;
        const borderColor = isUp ? "border-green-500/30" : "border-red-500/30";
        return (
          <div key={ticker} className={`bg-zinc-900/60 border ${borderColor} rounded-lg p-2.5 sm:p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs text-zinc-500 ticker-font">{labels[ticker]}</span>
              <span className="text-[10px] text-zinc-600 ticker-font">{ticker}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm sm:text-lg font-bold ticker-font text-white">
                  {item ? `$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                </p>
                <p className={`text-xs sm:text-sm ticker-font font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
                  {isUp ? "+" : ""}{change.toFixed(2)}%
                </p>
              </div>
              <MiniSparkline data={sparkData} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IntradayChart({ intradayData }: { intradayData?: IntradayData }) {
  const [selected, setSelected] = useState<string>("SPY");
  const symbols = ["SPY", "QQQ", "DIA"];

  const chartData = useMemo(() => {
    const raw = intradayData?.symbols?.[selected] || [];
    return raw.map(d => ({
      time: d.time?.split(" ")[1]?.slice(0, 5) || "",
      price: d.close,
      volume: d.volume,
    }));
  }, [intradayData, selected]);

  const openPrice = chartData.length > 0 ? chartData[0].price : 0;
  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const isUp = lastPrice >= openPrice;

  if (!intradayData || chartData.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-500" />
            <span className="text-sm ticker-font text-zinc-400">Intraday Performance</span>
          </div>
          <div className="flex gap-1">
            {symbols.map(s => (
              <button key={s} onClick={() => setSelected(s)}
                className={`px-2 py-0.5 text-[10px] sm:text-xs ticker-font rounded ${selected === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center h-[180px] sm:h-[220px] text-zinc-600 text-sm ticker-font">
          {intradayData ? "No intraday data for today" : <Skeleton className="w-full h-full bg-zinc-800/50 rounded" />}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 sm:p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-500" />
          <span className="text-sm ticker-font text-zinc-400">Intraday Performance</span>
          <span className={`text-xs ticker-font font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
            {isUp ? "+" : ""}{((lastPrice - openPrice) / openPrice * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex gap-1">
          {symbols.map(s => (
            <button key={s} onClick={() => setSelected(s)}
              className={`px-2 py-0.5 text-[10px] sm:text-xs ticker-font rounded transition-colors ${selected === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px" }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, selected]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isUp ? "#22c55e" : "#ef4444"}
            strokeWidth={1.5}
            fill="url(#chartGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectorPerformanceBars({ sectors }: { sectors: MarketItem[] }) {
  const sorted = useMemo(
    () => [...sectors].sort((a, b) => b.change1D - a.change1D),
    [sectors]
  );
  const maxAbs = useMemo(
    () => Math.max(...sorted.map(s => Math.abs(s.change1D)), 0.1),
    [sorted]
  );

  if (sorted.length === 0) return null;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 sm:p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-zinc-500" />
        <span className="text-sm ticker-font text-zinc-400">Sector Performance</span>
      </div>
      <div className="space-y-1.5">
        {sorted.map((sector, idx) => {
          const isUp = sector.change1D >= 0;
          const barWidth = Math.max((Math.abs(sector.change1D) / maxAbs) * 100, 2);
          const isTop3 = idx < 3;
          const isBottom3 = idx >= sorted.length - 3;
          return (
            <div key={sector.name} className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="w-[100px] sm:w-[140px] truncate text-right ticker-font text-zinc-400 flex items-center justify-end gap-1.5">
                {isTop3 && <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />}
                {isBottom3 && <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />}
                <span className="truncate">{sector.name}</span>
              </div>
              <div className="flex-1 h-5 relative flex items-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-[1px] bg-zinc-800" />
                </div>
                <div
                  className={`h-4 rounded-sm ${isUp ? "bg-green-500/70" : "bg-red-500/70"}`}
                  style={{ width: `${barWidth}%`, minWidth: "4px" }}
                />
              </div>
              <span className={`w-[52px] text-right ticker-font font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                {isUp ? "+" : ""}{sector.change1D.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopBottomMovers({ markets }: { markets?: MarketsData }) {
  const { top, bottom } = useMemo(() => {
    if (!markets) return { top: [], bottom: [] };
    const all = [
      ...(markets.usaSectors || []),
      ...(markets.usaThematics || []),
      ...(markets.usaEqualWeight || []),
    ];
    const sorted = [...all].sort((a, b) => b.change1D - a.change1D);
    return {
      top: sorted.slice(0, 5),
      bottom: sorted.slice(-5).reverse(),
    };
  }, [markets]);

  if (top.length === 0) return null;

  const MoverTable = ({ items, type }: { items: MarketItem[]; type: "top" | "bottom" }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        {type === "top" ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
        <span className="text-xs ticker-font text-zinc-400 font-medium">
          {type === "top" ? "Top Performers" : "Bottom Performers"}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-zinc-600 ticker-font w-3">{i + 1}</span>
              <span className="text-xs ticker-font text-zinc-300 truncate">{item.name}</span>
            </div>
            <span className={`text-xs ticker-font font-semibold flex-shrink-0 ${item.change1D >= 0 ? "text-green-400" : "text-red-400"}`}>
              {item.change1D >= 0 ? "+" : ""}{item.change1D.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
      <MoverTable items={top} type="top" />
      <MoverTable items={bottom} type="bottom" />
    </div>
  );
}

function MarketBreadthCards({ sectors }: { sectors: MarketItem[] }) {
  if (sectors.length === 0) return null;

  const advancing = sectors.filter(s => s.change1D > 0).length;
  const declining = sectors.filter(s => s.change1D < 0).length;
  const avgChange = sectors.reduce((sum, s) => sum + s.change1D, 0) / sectors.length;
  const sorted = [...sectors].sort((a, b) => b.change1D - a.change1D);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const cards = [
    { label: "ADVANCE / DECLINE", value: `${advancing} / ${declining}`, color: advancing > declining ? "text-green-400" : "text-red-400" },
    { label: "AVG SECTOR MOVE", value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`, color: avgChange >= 0 ? "text-green-400" : "text-red-400" },
    { label: "BEST SECTOR", value: `${best.name}`, sub: `${best.change1D >= 0 ? "+" : ""}${best.change1D.toFixed(1)}%`, color: "text-green-400" },
    { label: "WORST SECTOR", value: `${worst.name}`, sub: `${worst.change1D >= 0 ? "+" : ""}${worst.change1D.toFixed(1)}%`, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
      {cards.map(card => (
        <div key={card.label} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-wide ticker-font mb-1">{card.label}</p>
          <p className={`text-sm sm:text-base font-bold ticker-font truncate ${card.color}`}>{card.value}</p>
          {card.sub && <p className={`text-[10px] sm:text-xs ticker-font ${card.color}`}>{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function NewsHeadlines({ news }: { news?: { market: NewsArticle[] } }) {
  const articles = news?.market?.slice(0, 6) || [];

  if (articles.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="w-4 h-4 text-zinc-500" />
          <span className="text-sm ticker-font text-zinc-400">Market Headlines</span>
        </div>
        <Skeleton className="h-20 w-full bg-zinc-800/50 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 sm:p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-zinc-500" />
        <span className="text-sm ticker-font text-zinc-400">Market Headlines</span>
      </div>
      <div className="space-y-2">
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-zinc-800/50 transition-colors group"
          >
            <span className="text-zinc-600 text-[10px] ticker-font mt-0.5 flex-shrink-0">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-zinc-300 group-hover:text-white transition-colors line-clamp-1">
                {article.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-zinc-600 ticker-font">{article.source}</span>
                <span className="text-[10px] text-zinc-700 ticker-font">{timeAgo(article.publishedAt)}</span>
              </div>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

function MarketNarrativeSummary({ summary }: { summary?: MarketSummary }) {
  if (!summary?.summary) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
        <Skeleton className="h-16 w-full bg-zinc-800/50 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border-l-2 border-[#FFD700]/30 rounded-r-lg p-3 sm:p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#FFD700]/60 ticker-font mb-2">Market Narrative</p>
      <div
        className="text-xs sm:text-sm text-zinc-400 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: summary.summary }}
      />
      <p className="text-[10px] text-zinc-600 ticker-font mt-2">
        Updated {timeAgo(summary.generatedAt)}
      </p>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────

export default function AsxUsaMarketsSection({ markets }: { markets?: MarketsData }) {
  const { data: usStatus } = useQuery<UsStatus>({
    queryKey: ["/api/markets/us-status"],
    refetchInterval: 30000,
  });

  const { data: intradayData } = useQuery<IntradayData>({
    queryKey: ["/api/markets/intraday"],
    refetchInterval: 60000,
  });

  const { data: news } = useQuery<{ market: NewsArticle[] }>({
    queryKey: ["/api/news"],
    refetchInterval: 300000,
  });

  const { data: marketSummary } = useQuery<MarketSummary>({
    queryKey: ["/api/markets/summary"],
    refetchInterval: 300000,
  });

  const usaSectors = markets?.usaSectors || [];

  return (
    <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-zinc-800/60">
      <SessionStatusHeader status={usStatus} />
      <IndexOverviewCards
        globalMarkets={markets?.globalMarkets || []}
        intradayData={intradayData}
      />
      <IntradayChart intradayData={intradayData} />
      <SectorPerformanceBars sectors={usaSectors} />
      <MarketBreadthCards sectors={usaSectors} />
      <TopBottomMovers markets={markets} />
      <NewsHeadlines news={news} />
      <MarketNarrativeSummary summary={marketSummary} />
    </div>
  );
}
