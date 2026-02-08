import { useState, useEffect, useRef, useCallback } from "react";
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
import { queryClient, apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Sparkles,
  Loader2,
  Search,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { PortfolioHolding } from "@shared/schema";
import logoImg from "@assets/image_1770442846290.png";
import ReactMarkdown from "react-markdown";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";

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
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

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
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search stocks... (e.g., Apple, TSLA)"
          value={query}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setQuery(val);
            onSelect(val);
            setActiveIndex(-1);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={(e) => {
            if (!isOpen || results.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => i < results.length - 1 ? i + 1 : 0); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => i > 0 ? i - 1 : results.length - 1); }
            else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(results[activeIndex]); }
            else if (e.key === 'Escape') { setIsOpen(false); setActiveIndex(-1); }
          }}
          className="bg-zinc-800 border-zinc-700 text-white font-mono uppercase pl-10"
          data-testid="input-stock-search"
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `portfolio-option-${activeIndex}` : undefined}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 animate-spin" />
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl" role="listbox">
          {results.map((stock, idx) => (
            <button
              key={`${stock.symbol}-${idx}`}
              id={`portfolio-option-${idx}`}
              type="button"
              onClick={() => handleSelect(stock)}
              className={`w-full px-3 py-2.5 text-left hover:bg-zinc-700 flex items-center justify-between gap-2 border-b border-zinc-700/50 last:border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:bg-zinc-700 ${idx === activeIndex ? 'bg-zinc-700' : ''}`}
              data-testid={`stock-result-${stock.symbol}`}
              role="option"
              aria-selected={idx === activeIndex}
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

function ThinkingLoader() {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = [
    "Analyzing your positions...",
    "Reviewing sector allocation...",
    "Checking risk exposure...",
    "Evaluating diversification...",
    "Researching your holdings...",
    "Preparing recommendations...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <img 
          src={logoImg} 
          alt="Loading" 
          className="w-20 h-20 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]" 
        />
        <Loader2 className="absolute -bottom-2 -right-2 w-6 h-6 text-amber-500 animate-spin" />
      </div>
      <p className="text-lg text-amber-400 font-medium mb-2">Bro is thinking...</p>
      <p className="text-sm text-zinc-400 animate-pulse">{statuses[statusIndex]}</p>
      
      <div className="flex items-center gap-4 sm:gap-8 mt-8">
        {[
          { icon: BarChart3, label: "Analysis" },
          { icon: Target, label: "Targets" },
          { icon: AlertTriangle, label: "Risks" },
          { icon: CheckCircle, label: "Actions" },
        ].map((item, idx) => (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className={`p-3 rounded-full bg-zinc-800 border border-zinc-800 ${idx <= statusIndex % 4 ? 'border-amber-500/50' : ''}`}>
              <item.icon className={`w-5 h-5 ${idx <= statusIndex % 4 ? 'text-amber-500' : 'text-zinc-600'}`} />
            </div>
            <span className={`text-xs ${idx <= statusIndex % 4 ? 'text-amber-400' : 'text-zinc-600'}`}>{item.label}</span>
          </div>
        ))}
      </div>
      
      <div className="w-64 h-1 bg-zinc-800 rounded-full mt-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full animate-[loading_2s_ease-in-out_infinite]" 
             style={{ width: '60%' }} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  useDocumentTitle("Portfolio Tracker");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({
    ticker: "",
    shares: "",
    avgCost: "",
  });
  const { toast } = useToast();
  const broSectionRef = useRef<HTMLDivElement>(null);
  const { gate, showLoginModal, closeLoginModal, isAuthenticated } = useLoginGate();
  const { isAtLimit, refetch: refetchBroStatus } = useBroStatus();
  const [showBroLimit, setShowBroLimit] = useState(false);

  const { data: holdings, isLoading: holdingsLoading } = useQuery<EnrichedHolding[]>({
    queryKey: ["/api/portfolio/enriched"],
    enabled: isAuthenticated, refetchInterval: 60000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
    enabled: isAuthenticated,
  });

  const { data: analysis } = useQuery<{ analysis: string }>({
    queryKey: ["/api/portfolio/analysis"],
    enabled: isAuthenticated && !!holdings && holdings.length > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portfolio/review");
      return res.json();
    },
    onSuccess: () => {
      refetchBroStatus();
      setTimeout(() => {
        broSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    },
    onError: (error: any) => {
      if (error instanceof ApiError && error.status === 429) {
        setShowBroLimit(true);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to get your bro's opinion. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetBroOpinion = () => {
    if (!gate()) return;
    if (isAtLimit) {
      setShowBroLimit(true);
      return;
    }
    reviewMutation.mutate();
    setTimeout(() => {
      broSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDelete = useCallback((id: number, ticker: string) => {
    if (!gate()) return;

    const prevData = queryClient.getQueryData<EnrichedHolding[]>(["/api/portfolio/enriched"]);

    queryClient.setQueryData<EnrichedHolding[]>(
      ["/api/portfolio/enriched"],
      (old) => old?.filter((h) => h.id !== id) ?? []
    );

    const timer = setTimeout(async () => {
      try {
        await apiRequest("DELETE", `/api/portfolio/${id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/enriched"] });
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      } catch {
        if (prevData) queryClient.setQueryData(["/api/portfolio/enriched"], prevData);
        toast({ title: "Error", description: "Failed to remove position.", variant: "destructive" });
      }
    }, 5000);
    deleteTimerRef.current = timer;

    toast({
      title: `${ticker} removed`,
      description: "Position removed from portfolio.",
      action: (
        <ToastAction altText="Undo remove" onClick={() => {
          clearTimeout(timer);
          if (prevData) queryClient.setQueryData(["/api/portfolio/enriched"], prevData);
        }}>
          Undo
        </ToastAction>
      ),
    });
  }, [gate, toast]);

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gate()) return;
    if (!newHolding.ticker || !newHolding.shares || !newHolding.avgCost) return;
    addMutation.mutate(newHolding);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight display-font neon-green-subtle">
            PORTFOLIO
          </h1>
          <div className="flex items-center gap-3">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-amber-500/50" data-testid="button-add-position">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
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
                      <p className="text-xs text-amber-400 font-mono">Selected: {newHolding.ticker}</p>
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
                    className="w-full bg-amber-600 hover:bg-amber-500 text-black font-semibold"
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4">
            <p className="text-zinc-500 text-[11px] sm:text-xs uppercase tracking-wide mb-1">Total Value</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <p className="text-base sm:text-2xl font-bold font-mono text-white truncate">
                ${stats?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
              </p>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4">
            <p className="text-zinc-500 text-[11px] sm:text-xs uppercase tracking-wide mb-1">Total Gain</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <div>
                <p className="text-base sm:text-2xl font-bold font-mono text-white truncate">
                  ${Math.abs(stats?.totalGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <PercentDisplay value={stats?.totalGainPercent || 0} />
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4">
            <p className="text-zinc-500 text-[11px] sm:text-xs uppercase tracking-wide mb-1">Day Change</p>
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
                  <p className="text-base sm:text-2xl font-bold font-mono text-white truncate">
                    ${Math.abs(stats?.dayChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <PercentDisplay value={stats?.dayChangePercent || 0} />
                </div>
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4">
            <p className="text-zinc-500 text-[11px] sm:text-xs uppercase tracking-wide mb-1">Positions</p>
            {holdingsLoading ? (
              <Skeleton className="h-8 w-12 bg-zinc-800" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold font-mono text-white">{holdings?.length || 0}</p>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Holdings</h2>

        <div className="mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="overflow-x-auto relative scroll-fade-right">
              {holdingsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                  ))}
                </div>
              ) : holdings && holdings.length > 0 ? (
                <>
                  {/* Mobile card view */}
                  <div className="sm:hidden divide-y divide-zinc-800/50" data-testid="holdings-mobile">
                    {holdings.map((holding) => {
                      const currentPrice = Number(holding.currentPrice || holding.avgCost);
                      return (
                        <div
                          key={holding.id}
                          className="px-3 py-3.5 flex items-center justify-between gap-2"
                          data-testid={`holding-row-${holding.ticker}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-amber-400 text-sm">{holding.ticker}</span>
                              <span className="text-xs text-zinc-500 truncate">{holding.name || holding.ticker}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="font-mono text-sm text-white">${currentPrice.toFixed(2)}</span>
                              <span className="text-xs text-zinc-400">${(holding.value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2 shrink-0">
                            <div>
                              <div className="text-sm"><PercentDisplay value={holding.pnlPercent || 0} /></div>
                              <div className="text-xs"><PercentDisplay value={holding.dayChangePercent || 0} /></div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(holding.id, holding.ticker)}
                              className="text-zinc-500 hover:text-red-500 min-h-[44px] min-w-[44px]"
                              data-testid={`button-delete-${holding.ticker}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <table className="hidden sm:table w-full text-sm" data-testid="holdings-table">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
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
                            className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors"
                            data-testid={`holding-row-${holding.ticker}`}
                          >
                            <td className="px-3 py-2.5 sticky left-0 bg-zinc-900 z-10">
                              <div className="flex flex-col">
                                <span className="font-mono font-semibold text-amber-400">{holding.ticker}</span>
                                <span className="text-xs text-zinc-500 truncate max-w-[120px]">{holding.name || holding.ticker}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">
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
                            <td className="px-3 py-2.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(holding.id, holding.ticker)}
                                  className="text-zinc-500 hover:text-red-500 min-h-[44px] min-w-[44px]"
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
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 mb-4">No holdings yet</p>
                  <Button 
                    onClick={() => setIsAddOpen(true)}
                    variant="outline"
                    className="border-zinc-800 bg-zinc-800 hover:bg-zinc-700 hover:border-amber-500/50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Position
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bro's Analysis Section */}
        <div ref={broSectionRef} className="bg-zinc-900 border border-amber-500/30 rounded-lg shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Buy Side Bro" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
              <div>
                <h2 className="text-lg font-semibold text-white display-font">Your Bro's Opinion</h2>
                <p className="text-xs text-zinc-500">Professional Portfolio Review</p>
              </div>
            </div>
            {!reviewMutation.isPending && !reviewMutation.data && (
              <button 
                onClick={handleGetBroOpinion}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-500 transition-all group"
                disabled={reviewMutation.isPending || !holdings || holdings.length === 0}
                data-testid="button-get-bro-opinion"
              >
                <Sparkles className="w-4 h-4 text-amber-400 group-hover:drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] transition-all" />
                <span className="text-amber-400 text-sm font-medium">Get Bro's Opinion</span>
              </button>
            )}
          </div>
          
          <div className="p-6">
            {reviewMutation.isPending ? (
              <ThinkingLoader />
            ) : reviewMutation.data?.review ? (
              <div className="prose prose-invert prose-amber max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-2xl font-bold text-amber-400 mb-4 display-font">{children}</h1>,
                    h2: ({children}) => <h2 className="text-xl font-semibold text-amber-400 mt-6 mb-3 display-font">{children}</h2>,
                    h3: ({children}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>,
                    p: ({children}) => <p className="text-zinc-300 mb-3 leading-relaxed">{children}</p>,
                    ul: ({children}) => <ul className="list-disc list-inside text-zinc-300 mb-4 space-y-1">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal list-inside text-zinc-300 mb-4 space-y-1">{children}</ol>,
                    li: ({children}) => <li className="text-zinc-300">{children}</li>,
                    strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                    table: ({children}) => (
                      <div className="overflow-x-auto my-4">
                        <table className="w-full text-sm border border-zinc-800 rounded-lg overflow-hidden">{children}</table>
                      </div>
                    ),
                    thead: ({children}) => <thead className="bg-amber-900/20">{children}</thead>,
                    th: ({children}) => <th className="px-3 py-2 text-left text-amber-400 font-semibold border-b border-zinc-800">{children}</th>,
                    td: ({children}) => <td className="px-3 py-2 text-zinc-300 border-b border-zinc-800/50">{children}</td>,
                    code: ({children}) => <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-400 text-sm">{children}</code>,
                    blockquote: ({children}) => <blockquote className="border-l-4 border-amber-500 pl-4 italic text-zinc-400 my-4">{children}</blockquote>,
                  }}
                >
                  {reviewMutation.data.review}
                </ReactMarkdown>
                
                <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
                  <button
                    onClick={handleGetBroOpinion}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-500 transition-all text-sm"
                    data-testid="button-refresh-opinion"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-medium">Refresh Analysis</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <img 
                    src={logoImg} 
                    alt="Buy Side Bro" 
                    className="w-16 h-16 object-contain opacity-50" 
                  />
                </div>
                <p className="text-zinc-500 mb-2">Ready to review your portfolio</p>
                <p className="text-zinc-600 text-sm mb-6">
                  {holdings && holdings.length > 0 
                    ? "Click the button above to get a detailed analysis of your holdings"
                    : "Add some holdings first to get your bro's expert opinion"
                  }
                </p>
                {holdings && holdings.length > 0 && (
                  <button
                    onClick={handleGetBroOpinion}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-amber-500/50 bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-500 transition-all group"
                    data-testid="button-get-bro-opinion-center"
                  >
                    <Sparkles className="w-5 h-5 text-amber-400 group-hover:drop-shadow-[0_0_8px_rgba(255,215,0,0.6)] transition-all" />
                    <span className="text-amber-400 font-medium">Get Bro's Opinion</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
        <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
        <BroLimitModal open={showBroLimit} onClose={() => setShowBroLimit(false)} />
    </div>
  );
}
