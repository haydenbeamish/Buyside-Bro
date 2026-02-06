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
import { Plus, Trash2, Search, Loader2, Eye, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Link } from "wouter";
import type { WatchlistItem } from "@shared/schema";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useAuth } from "@/hooks/use-auth";

interface EnrichedWatchlistItem extends WatchlistItem {
  price: number | null;
  dayChangePercent: number;
  marketCap: number | null;
  pe: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  avgVolume: number | null;
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

function formatVolume(value: number | null): string {
  if (!value) return "-";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function FiftyTwoWeekBar({ price, low, high }: { price: number | null; low: number | null; high: number | null }) {
  if (!price || !low || !high || high === low) {
    return <span className="text-zinc-600 text-xs">-</span>;
  }
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  const color = pct >= 66 ? "bg-green-500" : pct >= 33 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex flex-col gap-0.5 min-w-[80px]">
      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
        <span>{low.toFixed(0)}</span>
        <span>{high.toFixed(0)}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InlineNoteEditor({ itemId, initialNote }: { itemId: number; initialNote: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const save = async () => {
    setEditing(false);
    try {
      await apiRequest("PATCH", `/api/watchlist/${itemId}/notes`, { notes: value });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
    } catch {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-300 outline-none focus:border-green-500"
        maxLength={200}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 truncate block"
      title={value || "Click to add note"}
    >
      {value || <span className="italic text-zinc-600">Add note...</span>}
    </span>
  );
}

function downloadCSV(items: EnrichedWatchlistItem[]) {
  const headers = ["Ticker", "Name", "Price", "Day %", "Volume", "Market Cap", "P/E", "52W Low", "52W High", "Notes"];
  const rows = items.map((item) => [
    item.ticker,
    (item.name || "").replace(/,/g, ""),
    item.price != null ? item.price.toFixed(2) : "",
    item.dayChangePercent != null ? item.dayChangePercent.toFixed(2) : "",
    item.volume != null ? item.volume.toString() : "",
    item.marketCap != null ? item.marketCap.toString() : "",
    item.pe != null ? item.pe.toFixed(2) : "",
    item.yearLow != null ? item.yearLow.toFixed(2) : "",
    item.yearHigh != null ? item.yearHigh.toFixed(2) : "",
    (item.notes || "").replace(/,/g, " "),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `watchlist-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TICKER_COL_WIDTH = 160;

type SortKey = "ticker" | "price" | "dayChangePercent" | "volume" | "marketCap" | "pe";
type SortDir = "asc" | "desc";

function getSortValue(item: EnrichedWatchlistItem, key: SortKey): number | string {
  switch (key) {
    case "ticker": return item.ticker.toLowerCase();
    case "price": return item.price ?? -Infinity;
    case "dayChangePercent": return item.dayChangePercent ?? -Infinity;
    case "volume": return item.volume ?? -Infinity;
    case "marketCap": return item.marketCap ?? -Infinity;
    case "pe": return item.pe ?? -Infinity;
  }
}

function sortItems(items: EnrichedWatchlistItem[], key: SortKey, dir: SortDir): EnrichedWatchlistItem[] {
  return [...items].sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function SortHeader({ label, sortKey: colKey, currentKey, currentDir, onToggle, testId }: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
  testId?: string;
}) {
  return (
    <th
      className="px-3 py-3 text-right font-medium whitespace-nowrap cursor-pointer hover:text-green-400 transition-colors"
      onClick={() => onToggle(colKey)}
      data-testid={testId}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {currentKey === colKey && (currentDir === "asc" ? <ArrowUp className="h-3 w-3 text-green-400" /> : <ArrowDown className="h-3 w-3 text-green-400" />)}
      </span>
    </th>
  );
}

export default function WatchlistPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("dayChangePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { toast } = useToast();
  const hasSeeded = useRef(false);
  const { gate, showLoginModal, closeLoginModal, isAuthenticated } = useLoginGate();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  };

  const { data: personalItems, isLoading: personalLoading } = useQuery<EnrichedWatchlistItem[]>({
    queryKey: ["/api/watchlist/enriched"],
    refetchInterval: 60000,
    enabled: isAuthenticated,
  });

  const { data: defaultItems, isLoading: defaultLoading } = useQuery<EnrichedWatchlistItem[]>({
    queryKey: ["/api/watchlist/default"],
    enabled: !isAuthenticated,
  });

  const items = isAuthenticated ? personalItems : defaultItems;
  const isLoading = isAuthenticated ? personalLoading : defaultLoading;

  useEffect(() => {
    if (isAuthenticated && !hasSeeded.current && personalItems !== undefined && personalItems.length === 0) {
      hasSeeded.current = true;
      apiRequest("POST", "/api/watchlist/seed")
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
          queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
        })
        .catch(() => {});
    }
  }, [personalItems, isAuthenticated]);

  const addMutation = useMutation({
    mutationFn: async (data: { ticker: string; name: string }) => {
      if (!gate()) return;
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
      if (!gate()) return;
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight display-font neon-green-subtle" data-testid="text-watchlist-title">
              WATCHLIST
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {items && items.length > 0 && (
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900"
                onClick={() => downloadCSV(items)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
            {isAuthenticated && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-green-900/50 bg-zinc-900" data-testid="button-add-watchlist">
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
            )}
          </div>
        </div>

        <div className="text-sm text-zinc-500 mb-4">
          {items ? `${items.length} stocks` : "Loading..."} {isAuthenticated ? "on your watchlist" : "— sign in to customize"}
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
              <>
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-zinc-800/50" data-testid="watchlist-mobile">
                  {sortItems(items, sortKey, sortDir).map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-3 flex items-center justify-between"
                      data-testid={`watchlist-row-${item.ticker}`}
                    >
                      <div className="min-w-0">
                        <Link href={`/analysis?ticker=${item.ticker}`} className="hover:underline">
                          <span className="font-mono font-semibold text-green-400">{item.ticker}</span>
                        </Link>
                        {item.name && item.name !== item.ticker && (
                          <span className="text-[11px] text-zinc-500 truncate block leading-tight">{item.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-mono text-sm text-white block">
                            {item.price ? `$${item.price.toFixed(2)}` : "-"}
                          </span>
                          <span className="text-xs"><PercentDisplay value={item.dayChangePercent || 0} /></span>
                        </div>
                        {isAuthenticated && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-zinc-600 hover:text-red-400 h-7 w-7"
                            data-testid={`button-remove-${item.ticker}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <table className="hidden sm:table w-full text-sm" style={{ tableLayout: "fixed" }} data-testid="watchlist-table">
                  <colgroup>
                    <col style={{ width: `${TICKER_COL_WIDTH}px` }} />
                    <col />
                    <col />
                    <col />
                    <col />
                    <col />
                    <col style={{ width: "110px" }} />
                    {isAuthenticated && <col style={{ width: "140px" }} />}
                    {isAuthenticated && <col style={{ width: "44px" }} />}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-green-900/30 text-zinc-500 text-xs uppercase">
                      <th
                        className="px-3 py-3 text-left font-medium select-none whitespace-nowrap cursor-pointer hover:text-green-400 transition-colors"
                        onClick={() => toggleSort("ticker")}
                        data-testid="sort-ticker"
                      >
                        <span className="inline-flex items-center gap-1">
                          Ticker
                          {sortKey === "ticker" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-green-400" /> : <ArrowDown className="h-3 w-3 text-green-400" />)}
                        </span>
                      </th>
                      <SortHeader label="Price" sortKey="price" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-price" />
                      <SortHeader label="Day %" sortKey="dayChangePercent" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-day" />
                      <SortHeader label="Volume" sortKey="volume" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-volume" />
                      <SortHeader label="Mkt Cap" sortKey="marketCap" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-mktcap" />
                      <SortHeader label="P/E" sortKey="pe" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-pe" />
                      <th className="px-3 py-3 text-center font-medium whitespace-nowrap text-xs">52W Range</th>
                      {isAuthenticated && <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-xs">Notes</th>}
                      {isAuthenticated && <th className="px-3 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortItems(items, sortKey, sortDir).map((item) => {
                      const volRatio = item.volume && item.avgVolume && item.avgVolume > 0
                        ? item.volume / item.avgVolume
                        : null;
                      const highVol = volRatio !== null && volRatio >= 1.5;

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-800/50 hover:bg-green-900/10 transition-colors"
                          data-testid={`watchlist-row-${item.ticker}`}
                        >
                          <td className="px-3 py-2.5 overflow-hidden">
                            <Link href={`/analysis?ticker=${item.ticker}`} className="hover:underline">
                              <span className="font-mono font-semibold text-green-400 truncate block">{item.ticker}</span>
                            </Link>
                            {item.name && item.name !== item.ticker && (
                              <span className="text-[11px] text-zinc-500 truncate block leading-tight">{item.name}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.price ? `$${item.price.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                            <PercentDisplay value={item.dayChangePercent || 0} />
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis ${highVol ? "text-yellow-400 font-semibold" : "text-zinc-400"}`}>
                            {formatVolume(item.volume)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                            {formatMarketCap(item.marketCap)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.pe ? item.pe.toFixed(1) : "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            <FiftyTwoWeekBar price={item.price} low={item.yearLow} high={item.yearHigh} />
                          </td>
                          {isAuthenticated && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              <InlineNoteEditor itemId={item.id} initialNote={item.notes ?? null} />
                            </td>
                          )}
                          {isAuthenticated && (
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
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
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
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
    </div>
  );
}
