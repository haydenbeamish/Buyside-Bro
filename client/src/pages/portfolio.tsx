import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Sparkles,
  X,
  Loader2,
  Search,
} from "lucide-react";
import type { PortfolioHolding } from "@shared/schema";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import logoImg from "@assets/image_1770292490089.png";
import ReactMarkdown from "react-markdown";

interface PortfolioStats {
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

interface EnrichedHolding extends PortfolioHolding {
  dayChangePercent: number;
  value: number;
  dayPnL: number;
  totalPnL: number;
  pnlPercent: number;
  marketCap: number | null;
  pe: number | null;
  epsGrowth: number | null;
  nextEarnings: string | null;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

function StockTickerInput({ 
  value, 
  onSelect 
}: { 
  value: string; 
  onSelect: (symbol: string) => void;
}) {
  const [ticker, setTicker] = useState(value);

  const popularStocks = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'JPM', name: 'JPMorgan' },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Enter ticker symbol (e.g., AAPL)"
          value={ticker}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setTicker(val);
            onSelect(val);
          }}
          className="bg-zinc-800 border-zinc-700 text-white font-mono uppercase pl-10"
          data-testid="input-stock-ticker"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {popularStocks.map((stock) => (
          <button
            key={stock.symbol}
            type="button"
            onClick={() => {
              setTicker(stock.symbol);
              onSelect(stock.symbol);
            }}
            className="px-2 py-1 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 hover:text-green-400 transition-colors"
            data-testid={`quick-select-${stock.symbol}`}
          >
            {stock.symbol}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Type any ticker symbol from global exchanges</p>
    </div>
  );
}

function formatMarketCap(value: number | null): string {
  if (!value) return "-";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function formatEarningsDate(date: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function BroReviewModal({ 
  isOpen, 
  onClose, 
  review, 
  isLoading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  review: string | null;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-4xl max-h-[85vh] mx-4 bg-zinc-900 border border-green-500/30 rounded-lg shadow-[0_0_30px_rgba(0,255,0,0.2)] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-green-900/30">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Buy Side Bro" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]" />
            <div>
              <h2 className="text-lg font-semibold text-white display-font">Your Bro's Opinion</h2>
              <p className="text-xs text-zinc-500">Professional Portfolio Review</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
            data-testid="button-close-review"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <img 
                  src={logoImg} 
                  alt="Loading" 
                  className="w-20 h-20 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(0,255,0,0.5)]" 
                />
                <Loader2 className="absolute -bottom-2 -right-2 w-6 h-6 text-green-500 animate-spin" />
              </div>
              <p className="mt-4 text-zinc-400">Your bro is analyzing your portfolio...</p>
              <p className="text-xs text-zinc-600 mt-1">This may take a moment</p>
            </div>
          ) : review ? (
            <div className="prose prose-invert prose-green max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({children}) => <h1 className="text-2xl font-bold text-green-400 mb-4 display-font">{children}</h1>,
                  h2: ({children}) => <h2 className="text-xl font-semibold text-green-400 mt-6 mb-3 display-font">{children}</h2>,
                  h3: ({children}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>,
                  p: ({children}) => <p className="text-zinc-300 mb-3 leading-relaxed">{children}</p>,
                  ul: ({children}) => <ul className="list-disc list-inside text-zinc-300 mb-4 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal list-inside text-zinc-300 mb-4 space-y-1">{children}</ol>,
                  li: ({children}) => <li className="text-zinc-300">{children}</li>,
                  strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                  table: ({children}) => (
                    <div className="overflow-x-auto my-4">
                      <table className="w-full text-sm border border-green-900/30 rounded-lg overflow-hidden">{children}</table>
                    </div>
                  ),
                  thead: ({children}) => <thead className="bg-green-900/20">{children}</thead>,
                  th: ({children}) => <th className="px-3 py-2 text-left text-green-400 font-semibold border-b border-green-900/30">{children}</th>,
                  td: ({children}) => <td className="px-3 py-2 text-zinc-300 border-b border-zinc-800/50">{children}</td>,
                  code: ({children}) => <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-green-400 text-sm">{children}</code>,
                  blockquote: ({children}) => <blockquote className="border-l-4 border-green-500 pl-4 italic text-zinc-400 my-4">{children}</blockquote>,
                }}
              >
                {review}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              No review available. Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({
    ticker: "",
    shares: "",
    avgCost: "",
  });
  const { toast } = useToast();

  const { data: holdings, isLoading: holdingsLoading } = useQuery<EnrichedHolding[]>({
    queryKey: ["/api/portfolio/enriched"],
    refetchInterval: 60000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
  });

  const { data: analysis } = useQuery<{ analysis: string }>({
    queryKey: ["/api/portfolio/analysis"],
    enabled: !!holdings && holdings.length > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portfolio/review");
      return res.json();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get your bro's opinion. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetBroOpinion = () => {
    setIsReviewOpen(true);
    reviewMutation.mutate();
  };

  const addMutation = useMutation({
    mutationFn: async (data: { ticker: string; shares: string; avgCost: string }) => {
      const res = await apiRequest("POST", "/api/portfolio", {
        ticker: data.ticker.toUpperCase(),
        shares: data.shares,
        avgCost: data.avgCost,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      setIsAddOpen(false);
      setNewHolding({ ticker: "", shares: "", avgCost: "" });
      toast({
        title: "Position added",
        description: "Your holding has been added to the portfolio.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add position. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      toast({
        title: "Position removed",
        description: "The holding has been removed from your portfolio.",
      });
    },
  });

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolding.ticker || !newHolding.shares || !newHolding.avgCost) return;
    addMutation.mutate(newHolding);
  };

  const pieData = holdings?.map((h) => ({
    name: h.ticker,
    value: Number(h.shares) * Number(h.currentPrice || h.avgCost),
  })) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-4xl font-bold tracking-tight display-font neon-green-subtle">
            PORTFOLIO
          </h1>
          <div className="flex items-center gap-3">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-900/50 bg-zinc-900 hover:bg-zinc-800 hover:border-green-500/50" data-testid="button-add-position">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-green-900/30 text-white">
                <DialogHeader>
                  <DialogTitle>Add New Position</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddHolding} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Stock Ticker</Label>
                    <StockTickerInput
                      value={newHolding.ticker}
                      onSelect={(symbol) => setNewHolding({ ...newHolding, ticker: symbol })}
                    />
                    {newHolding.ticker && (
                      <p className="text-xs text-green-400 font-mono">Selected: {newHolding.ticker}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shares" className="text-zinc-300">Number of Shares</Label>
                    <Input
                      id="shares"
                      type="number"
                      step="0.0001"
                      placeholder="100"
                      value={newHolding.shares}
                      onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white font-mono"
                      data-testid="input-shares"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avgCost" className="text-zinc-300">Average Cost per Share</Label>
                    <Input
                      id="avgCost"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={newHolding.avgCost}
                      onChange={(e) => setNewHolding({ ...newHolding, avgCost: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white font-mono"
                      data-testid="input-avg-cost"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-500 text-black font-semibold"
                    disabled={addMutation.isPending}
                    data-testid="button-submit-position"
                  >
                    {addMutation.isPending ? "Adding..." : "Add Position"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Total Value</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <p className="text-2xl font-bold font-mono text-white">
                ${stats?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
              </p>
            )}
          </div>
          <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Total Gain</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <div>
                <p className="text-2xl font-bold font-mono text-white">
                  ${Math.abs(stats?.totalGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <PercentDisplay value={stats?.totalGainPercent || 0} />
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Day Change</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <div className="flex items-center gap-2">
                {(stats?.dayChange || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-2xl font-bold font-mono text-white">
                    ${Math.abs(stats?.dayChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <PercentDisplay value={stats?.dayChangePercent || 0} />
                </div>
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Positions</p>
            {holdingsLoading ? (
              <Skeleton className="h-8 w-12 bg-zinc-800" />
            ) : (
              <p className="text-2xl font-bold font-mono text-white">{holdings?.length || 0}</p>
            )}
          </div>
        </div>

        {analysis && (
          <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Sparkles className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">Bro's Opinion</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {analysis.analysis}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Holdings</h2>
          <button 
            onClick={handleGetBroOpinion}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/50 bg-green-900/20 hover:bg-green-900/40 hover:border-green-500 transition-all group"
            disabled={reviewMutation.isPending}
            data-testid="button-get-bro-opinion"
          >
            <img 
              src={logoImg} 
              alt="Buy Side Bro" 
              className="w-6 h-6 object-contain group-hover:drop-shadow-[0_0_8px_rgba(0,255,0,0.6)] transition-all" 
            />
            <span className="text-green-400 text-sm font-medium">Get Your Bro's Opinion</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-green-900/30 rounded-lg">
            <div className="overflow-x-auto relative">
              {holdingsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                  ))}
                </div>
              ) : holdings && holdings.length > 0 ? (
                <table className="w-full text-sm" data-testid="holdings-table">
                  <thead>
                    <tr className="border-b border-green-900/30 text-zinc-500 text-xs uppercase">
                      <th className="px-3 py-3 text-left font-medium sticky left-0 bg-zinc-900 z-10 min-w-[100px]">Ticker</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Price</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Cost</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">% P&L</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Day %</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Qty</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Value</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Day P&L</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Total P&L</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Mkt Cap</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">P/E</th>
                      <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Earnings</th>
                      <th className="px-3 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => {
                      const currentPrice = Number(holding.currentPrice || holding.avgCost);
                      const avgCost = Number(holding.avgCost);
                      const shares = Number(holding.shares);

                      return (
                        <tr 
                          key={holding.id} 
                          className="border-b border-zinc-800/50 hover:bg-green-900/10 transition-colors"
                          data-testid={`holding-row-${holding.ticker}`}
                        >
                          <td className="px-3 py-2.5 sticky left-0 bg-zinc-900 z-10">
                            <span className="font-mono font-semibold text-zinc-200">
                              {holding.ticker}
                            </span>
                            {holding.name && (
                              <p className="text-xs text-zinc-500 truncate max-w-[100px]">
                                {holding.name}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-300 whitespace-nowrap">
                            ${currentPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-300 whitespace-nowrap">
                            ${avgCost.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <PercentDisplay value={holding.pnlPercent || 0} />
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <PercentDisplay value={holding.dayChangePercent || 0} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-300 whitespace-nowrap">
                            {shares.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-300 whitespace-nowrap">
                            ${(holding.value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className={`font-mono text-sm ${(holding.dayPnL || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {(holding.dayPnL || 0) >= 0 ? "+" : ""}${Math.abs(holding.dayPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className={`font-mono text-sm ${(holding.totalPnL || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {(holding.totalPnL || 0) >= 0 ? "+" : ""}${Math.abs(holding.totalPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                            {formatMarketCap(holding.marketCap)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                            {holding.pe ? holding.pe.toFixed(1) : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                            {formatEarningsDate(holding.nextEarnings)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(holding.id)}
                              disabled={deleteMutation.isPending}
                              className="text-zinc-500 hover:text-red-500 h-7 w-7"
                              data-testid={`button-delete-${holding.ticker}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 mb-4">No holdings yet</p>
                  <Button 
                    onClick={() => setIsAddOpen(true)}
                    variant="outline"
                    className="border-green-900/50 bg-zinc-800 hover:bg-zinc-700 hover:border-green-500/50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Position
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-green-900/30 rounded-lg">
            <div className="p-4 border-b border-green-900/30">
              <h2 className="text-lg font-semibold">Allocation</h2>
            </div>
            <div className="p-4">
              {holdingsLoading ? (
                <Skeleton className="h-48 w-full bg-zinc-800" />
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number) => [
                        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        "Value",
                      ]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                  Add holdings to see allocation
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BroReviewModal 
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        review={reviewMutation.data?.review || null}
        isLoading={reviewMutation.isPending}
      />
    </div>
  );
}
