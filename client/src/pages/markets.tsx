import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketCard } from "@/components/market-card";
import { SectorBadge } from "@/components/sector-badge";
import { PriceChange } from "@/components/price-change";
import { MarketGridSkeleton, ChartSkeleton } from "@/components/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Globe,
  BarChart3,
  Sparkles,
  Clock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketSummary {
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  generatedAt: string;
}

interface SectorPerformance {
  name: string;
  change: number;
}

interface MarketsData {
  indices: MarketIndex[];
  futures: MarketIndex[];
  commodities: MarketIndex[];
  sectors: SectorPerformance[];
  crypto: MarketIndex[];
}

export default function MarketsPage() {
  const { data: markets, isLoading: marketsLoading } = useQuery<MarketsData>({
    queryKey: ["/api/markets"],
    refetchInterval: 60000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<MarketSummary>({
    queryKey: ["/api/markets/summary"],
    refetchInterval: 300000,
  });

  const mockChartData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    value: 4500 + Math.random() * 100 - 50 + (i * 2),
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />
            Markets
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time market data and AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {summaryLoading ? (
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : summary ? (
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">AI Market Summary</h3>
                  <Badge
                    variant="secondary"
                    className={
                      summary.sentiment === "bullish"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : summary.sentiment === "bearish"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {summary.sentiment === "bullish" && <TrendingUp className="h-3 w-3 mr-1" />}
                    {summary.sentiment === "bearish" && <TrendingDown className="h-3 w-3 mr-1" />}
                    {summary.sentiment}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="indices" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="indices" data-testid="tab-indices">
            <BarChart3 className="h-4 w-4 mr-2" />
            Indices
          </TabsTrigger>
          <TabsTrigger value="futures" data-testid="tab-futures">
            <Zap className="h-4 w-4 mr-2" />
            Futures
          </TabsTrigger>
          <TabsTrigger value="commodities" data-testid="tab-commodities">
            Commodities
          </TabsTrigger>
          <TabsTrigger value="sectors" data-testid="tab-sectors">
            Sectors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="mt-4">
          {marketsLoading ? (
            <MarketGridSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {markets?.indices?.map((index) => (
                <MarketCard
                  key={index.symbol}
                  symbol={index.symbol}
                  name={index.name}
                  price={index.price}
                  change={index.change}
                  changePercent={index.changePercent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="futures" className="mt-4">
          {marketsLoading ? (
            <MarketGridSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {markets?.futures?.map((future) => (
                <MarketCard
                  key={future.symbol}
                  symbol={future.symbol}
                  name={future.name}
                  price={future.price}
                  change={future.change}
                  changePercent={future.changePercent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commodities" className="mt-4">
          {marketsLoading ? (
            <MarketGridSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {markets?.commodities?.map((commodity) => (
                <MarketCard
                  key={commodity.symbol}
                  symbol={commodity.symbol}
                  name={commodity.name}
                  price={commodity.price}
                  change={commodity.change}
                  changePercent={commodity.changePercent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sectors" className="mt-4">
          {marketsLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 11 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-32" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {markets?.sectors?.map((sector) => (
                <SectorBadge
                  key={sector.name}
                  name={sector.name}
                  change={sector.change}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg font-semibold">S&P 500 Today</CardTitle>
            <PriceChange value={0.42} size="sm" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Top Movers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {marketsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Gainers
                  </p>
                  {[
                    { symbol: "NVDA", change: 4.2 },
                    { symbol: "TSLA", change: 3.1 },
                    { symbol: "AMD", change: 2.8 },
                  ].map((stock) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="font-mono font-medium text-sm">
                        {stock.symbol}
                      </span>
                      <PriceChange value={stock.change} size="sm" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Losers
                  </p>
                  {[
                    { symbol: "BA", change: -2.4 },
                    { symbol: "INTC", change: -1.8 },
                    { symbol: "WBA", change: -1.5 },
                  ].map((stock) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="font-mono font-medium text-sm">
                        {stock.symbol}
                      </span>
                      <PriceChange value={stock.change} size="sm" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
