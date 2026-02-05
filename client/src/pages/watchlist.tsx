import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Loader2, Eye } from "lucide-react";
import type { WatchlistItem } from "@shared/schema";

interface EnrichedWatchlistItem extends WatchlistItem {
  price: number | null;
  dayChangePercent: number;
  marketCap: number | null;
  pe: number | null;
}

interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

function WatchlistStockSearch({
  onSelect,
}: {
  onSelect: (symbol: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
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

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search stocks globally... (e.g., Apple, VOD.L)"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="bg-zinc-800 border-zinc-700 text-white font-mono uppercase pl-10"
          data-testid="input-watchlist-search"
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
              onClick={() => {
                onSelect(stock.symbol, stock.name);
                setQuery("");
                setIsOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left hover:bg-zinc-700 flex items-center justify-between gap-2 border-b border-zinc-700/50 last:border-0"
              data-testid={`watchlist-result-${stock.symbol}`}
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

function formatMarketCap(value: number | null): string {
  if (!value) return "-";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

export default function WatchlistPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const hasSeeded = useRef(false);

  const { data: items, isLoading } = useQuery<EnrichedWatchlistItem[]>({
    queryKey: ["/api/watchlist/enriched"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!hasSeeded.current && items !== undefined && items.length === 0) {
      hasSeeded.current = true;
      apiRequest("POST", "/api/watchlist/seed")
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
          queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
        })
        .catch(() => {});
    }
  }, [items]);

  const addMutation = useMutation({
    mutationFn: async (data: { ticker: string; name: string }) => {
      const res = await apiRequest("POST", "/api/watchlist", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setIsAddOpen(false);
      toast({
        title: "Added to watchlist",
        description: "Stock has been added to your watchlist.",
      });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes("409") || error?.status === 409
        ? "This stock is already in your watchlist."
        : "Failed to add stock. Please try again.";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Removed",
        description: "Stock removed from watchlist.",
      });
    },
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Eye className="h-8 w-8 text-green-400" />
            <h1 className="text-4xl font-bold tracking-tight display-font neon-green-subtle" data-testid="text-watchlist-title">
              WATCHLIST
            </h1>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-900/50 bg-zinc-900 hover:bg-zinc-800 hover:border-green-500/50" data-testid="button-add-watchlist">
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-green-900/30 text-white">
              <DialogHeader>
                <DialogTitle>Add to Watchlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Search for a stock</Label>
                  <WatchlistStockSearch
                    onSelect={(symbol, name) => addMutation.mutate({ ticker: symbol, name })}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  Search by ticker or company name. Supports all global exchanges.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="text-sm text-zinc-500 mb-4">
          {items ? `${items.length} stocks` : "Loading..."} on your watchlist
        </div>

        <div className="bg-zinc-900 border border-green-900/30 rounded-lg">
          <div className="overflow-x-auto relative">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                ))}
              </div>
            ) : items && items.length > 0 ? (
              <table className="w-full text-sm" data-testid="watchlist-table">
                <thead>
                  <tr className="border-b border-green-900/30 text-zinc-500 text-xs uppercase">
                    <th className="px-3 py-3 text-left font-medium sticky left-0 bg-zinc-900 z-10 min-w-[100px]">Ticker</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Price</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Day %</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">Mkt Cap</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">P/E</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-800/50 hover:bg-green-900/10 transition-colors"
                      data-testid={`watchlist-row-${item.ticker}`}
                    >
                      <td className="px-3 py-2.5 sticky left-0 bg-zinc-900 z-10">
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold text-green-400">{item.ticker}</span>
                          <span className="text-xs text-zinc-500 truncate max-w-[180px]">{item.name || item.ticker}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">
                        {item.price ? `$${item.price.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <PercentDisplay value={item.dayChangePercent || 0} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                        {formatMarketCap(item.marketCap)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                        {item.pe ? item.pe.toFixed(1) : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-zinc-600 hover:text-red-400"
                          data-testid={`button-remove-${item.ticker}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 mb-2">Your watchlist is empty</p>
                <p className="text-zinc-600 text-sm">Add stocks to track their price and performance</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
