import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

export default function AnalysisPage() {
  const [searchTicker, setSearchTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<StockProfile>({
    queryKey: ["/api/analysis/profile", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: financials, isLoading: financialsLoading } = useQuery<Financials>({
    queryKey: ["/api/analysis/financials", activeTicker],
    enabled: !!activeTicker,
  });

  const { data: aiAnalysis, isLoading: aiLoading } = useQuery<AIAnalysis>({
    queryKey: ["/api/analysis/ai", activeTicker],
    enabled: !!activeTicker,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      setActiveTicker(searchTicker.toUpperCase().trim());
    }
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number | undefined, prefix = "", suffix = "") => {
    if (value === undefined || value === null) return "N/A";
    if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B${suffix}`;
    if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M${suffix}`;
    return `${prefix}${value.toLocaleString()}${suffix}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            STOCK ANALYSIS
          </h1>
          <p className="text-zinc-500">
            Deep dive into company fundamentals with AI-powered insights
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="search"
              placeholder="Enter ticker symbol (e.g., AAPL)"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white font-mono uppercase placeholder:normal-case placeholder:font-sans"
              data-testid="input-search-ticker"
            />
          </div>
          <Button 
            type="submit" 
            variant="outline"
            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
            data-testid="button-search"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {!activeTicker ? (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-16 text-center">
            <Search className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-2">
              Search for a stock to analyze
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              Enter a ticker symbol above to see company profile, financial metrics,
              and AI-powered analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map((ticker) => (
                <Badge
                  key={ticker}
                  variant="outline"
                  className="cursor-pointer border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  onClick={() => {
                    setSearchTicker(ticker);
                    setActiveTicker(ticker);
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
                {profile.description && (
                  <p className="mt-4 text-sm text-zinc-500 leading-relaxed line-clamp-3">
                    {profile.description}
                  </p>
                )}
              </div>
            ) : null}

            {aiLoading ? (
              <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40 bg-zinc-800" />
                    <Skeleton className="h-4 w-full bg-zinc-800" />
                    <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                  </div>
                </div>
              </div>
            ) : aiAnalysis ? (
              <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white">AI Analysis</h3>
                      <Badge
                        variant="outline"
                        className={
                          aiAnalysis.sentiment === "bullish"
                            ? "border-green-500/50 text-green-500"
                            : aiAnalysis.sentiment === "bearish"
                            ? "border-red-500/50 text-red-500"
                            : "border-zinc-600 text-zinc-400"
                        }
                      >
                        {aiAnalysis.sentiment}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                      {aiAnalysis.summary}
                    </p>
                    {aiAnalysis.keyPoints && aiAnalysis.keyPoints.length > 0 && (
                      <ul className="space-y-1">
                        {aiAnalysis.keyPoints.map((point, i) => (
                          <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-auto p-0 mb-6">
                <TabsTrigger 
                  value="overview"
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
                  data-testid="tab-overview"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="financials"
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
                  data-testid="tab-financials"
                >
                  Financials
                </TabsTrigger>
                <TabsTrigger 
                  value="ratios"
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
                  data-testid="tab-ratios"
                >
                  Ratios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Revenue</p>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-24 bg-zinc-800" />
                    ) : (
                      <p className="text-xl font-bold font-mono text-white">
                        {formatNumber(financials?.revenue, "$")}
                      </p>
                    )}
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Net Income</p>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-24 bg-zinc-800" />
                    ) : (
                      <p className="text-xl font-bold font-mono text-white">
                        {formatNumber(financials?.netIncome, "$")}
                      </p>
                    )}
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">EPS</p>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-16 bg-zinc-800" />
                    ) : (
                      <p className="text-xl font-bold font-mono text-white">
                        ${financials?.eps?.toFixed(2) || "N/A"}
                      </p>
                    )}
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Dividend Yield</p>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-16 bg-zinc-800" />
                    ) : (
                      <p className="text-xl font-bold font-mono text-white">
                        {financials?.dividendYield
                          ? `${(financials.dividendYield * 100).toFixed(2)}%`
                          : "N/A"}
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financials">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-lg font-semibold">Financial Metrics</h3>
                  </div>
                  <div className="p-4">
                    {financialsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex justify-between">
                            <Skeleton className="h-4 w-24 bg-zinc-800" />
                            <Skeleton className="h-4 w-20 bg-zinc-800" />
                          </div>
                        ))}
                      </div>
                    ) : financials ? (
                      <div className="space-y-4">
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">Revenue (TTM)</span>
                          <span className="font-mono font-medium text-white">
                            {formatNumber(financials.revenue, "$")}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">Net Income (TTM)</span>
                          <span className="font-mono font-medium text-white">
                            {formatNumber(financials.netIncome, "$")}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">Earnings Per Share</span>
                          <span className="font-mono font-medium text-white">
                            ${financials.eps?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-center py-8">
                        No financial data available
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ratios">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-lg font-semibold">Valuation Ratios</h3>
                  </div>
                  <div className="p-4">
                    {financialsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex justify-between">
                            <Skeleton className="h-4 w-24 bg-zinc-800" />
                            <Skeleton className="h-4 w-16 bg-zinc-800" />
                          </div>
                        ))}
                      </div>
                    ) : financials ? (
                      <div className="space-y-4">
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">P/E Ratio</span>
                          <span className="font-mono font-medium text-white">
                            {financials.peRatio?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">P/B Ratio</span>
                          <span className="font-mono font-medium text-white">
                            {financials.pbRatio?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">ROE</span>
                          <span className="font-mono font-medium text-white">
                            {financials.roe
                              ? `${(financials.roe * 100).toFixed(2)}%`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-800">
                          <span className="text-zinc-500">Debt/Equity</span>
                          <span className="font-mono font-medium text-white">
                            {financials.debtToEquity?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-center py-8">
                        No ratio data available
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
