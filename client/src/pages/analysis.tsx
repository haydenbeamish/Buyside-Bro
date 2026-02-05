import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChange } from "@/components/price-change";
import {
  TrendingUp,
  Search,
  Building2,
  DollarSign,
  BarChart3,
  Percent,
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          Stock Analysis
        </h1>
        <p className="text-muted-foreground mt-1">
          Deep dive into company fundamentals with AI-powered insights
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Enter ticker symbol (e.g., AAPL)"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="pl-10 font-mono uppercase"
            data-testid="input-search-ticker"
          />
        </div>
        <Button type="submit" data-testid="button-search">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {!activeTicker ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">
              Search for a stock to analyze
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Enter a ticker symbol above to see company profile, financial metrics,
              and AI-powered analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map((ticker) => (
                <Badge
                  key={ticker}
                  variant="secondary"
                  className="cursor-pointer hover-elevate"
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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {profileLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <div className="flex gap-2 mt-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-10 w-28 ml-auto" />
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : profile ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold font-mono">
                        {profile.symbol}
                      </h2>
                      <Badge variant="outline">{profile.exchange}</Badge>
                    </div>
                    <p className="text-lg text-foreground mb-2">
                      {profile.companyName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        <Building2 className="h-3 w-3 mr-1" />
                        {profile.sector}
                      </Badge>
                      <Badge variant="secondary">{profile.industry}</Badge>
                      <Badge variant="secondary">
                        {formatMarketCap(profile.marketCap)} Market Cap
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono">
                      ${profile.price.toFixed(2)}
                    </p>
                    <PriceChange value={profile.changesPercentage} />
                  </div>
                </div>
                {profile.description && (
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {profile.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {aiLoading ? (
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : aiAnalysis ? (
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">AI Analysis</h3>
                      <Badge
                        variant="secondary"
                        className={
                          aiAnalysis.sentiment === "bullish"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : aiAnalysis.sentiment === "bearish"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {aiAnalysis.sentiment}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {aiAnalysis.summary}
                    </p>
                    {aiAnalysis.keyPoints && aiAnalysis.keyPoints.length > 0 && (
                      <ul className="space-y-1">
                        {aiAnalysis.keyPoints.map((point, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">
                Overview
              </TabsTrigger>
              <TabsTrigger value="financials" data-testid="tab-financials">
                Financials
              </TabsTrigger>
              <TabsTrigger value="ratios" data-testid="tab-ratios">
                Ratios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Revenue</span>
                    </div>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-24" />
                    ) : (
                      <p className="text-xl font-bold font-mono">
                        {formatNumber(financials?.revenue, "$")}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs font-medium">Net Income</span>
                    </div>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-24" />
                    ) : (
                      <p className="text-xl font-bold font-mono">
                        {formatNumber(financials?.netIncome, "$")}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <span className="text-xs font-medium">EPS</span>
                    </div>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : (
                      <p className="text-xl font-bold font-mono">
                        ${financials?.eps?.toFixed(2) || "N/A"}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="text-xs font-medium">Dividend Yield</span>
                    </div>
                    {financialsLoading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : (
                      <p className="text-xl font-bold font-mono">
                        {financials?.dividendYield
                          ? `${(financials.dividendYield * 100).toFixed(2)}%`
                          : "N/A"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financials" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  {financialsLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : financials ? (
                    <div className="space-y-4">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Revenue (TTM)</span>
                        <span className="font-mono font-medium">
                          {formatNumber(financials.revenue, "$")}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Net Income (TTM)</span>
                        <span className="font-mono font-medium">
                          {formatNumber(financials.netIncome, "$")}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Earnings Per Share</span>
                        <span className="font-mono font-medium">
                          ${financials.eps?.toFixed(2) || "N/A"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No financial data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ratios" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Valuation Ratios</CardTitle>
                </CardHeader>
                <CardContent>
                  {financialsLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : financials ? (
                    <div className="space-y-4">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">P/E Ratio</span>
                        <span className="font-mono font-medium">
                          {financials.peRatio?.toFixed(2) || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">P/B Ratio</span>
                        <span className="font-mono font-medium">
                          {financials.pbRatio?.toFixed(2) || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">ROE</span>
                        <span className="font-mono font-medium">
                          {financials.roe
                            ? `${(financials.roe * 100).toFixed(2)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Debt/Equity</span>
                        <span className="font-mono font-medium">
                          {financials.debtToEquity?.toFixed(2) || "N/A"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No ratio data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
