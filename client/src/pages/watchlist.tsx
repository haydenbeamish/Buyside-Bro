import { useState, useEffect, useRef, useCallback } from "react";
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
import { queryClient, apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Plus, Trash2, Eye, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Link } from "wouter";
import type { WatchlistItem } from "@shared/schema";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { StockSearch } from "@/components/stock-search";

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
        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-300 outline-none focus:border-amber-500"
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
      className="px-1.5 sm:px-3 py-2 sm:py-3 text-right font-medium whitespace-nowrap cursor-pointer hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:rounded"
      tabIndex={0}
      role="button"
      onClick={() => onToggle(colKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(colKey); } }}
      data-testid={testId}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {currentKey === colKey && (currentDir === "asc" ? <ArrowUp className="h-3 w-3 text-amber-400" /> : <ArrowDown className="h-3 w-3 text-amber-400" />)}
      </span>
    </th>
  );
}

export default function WatchlistPage() {
  useDocumentTitle("Watchlist");
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
      const msg = error instanceof ApiError && error.status === 409
        ? "This stock is already in your watchlist."
        : "Failed to add stock. Please try again.";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDelete = useCallback((id: number, ticker: string) => {
    if (!gate()) return;

    // Snapshot current data for undo
    const prevData = queryClient.getQueryData<EnrichedWatchlistItem[]>(["/api/watchlist/enriched"]);

    // Optimistically remove from cache
    queryClient.setQueryData<EnrichedWatchlistItem[]>(
      ["/api/watchlist/enriched"],
      (old) => old?.filter((item) => item.id !== id) ?? []
    );

    // Schedule actual delete after 5s
    const timer = setTimeout(async () => {
      try {
        await apiRequest("DELETE", `/api/watchlist/${id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/watchlist/enriched"] });
        queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      } catch {
        // Restore on error
        if (prevData) queryClient.setQueryData(["/api/watchlist/enriched"], prevData);
        toast({ title: "Error", description: "Failed to remove stock.", variant: "destructive" });
      }
    }, 5000);
    deleteTimerRef.current = timer;

    toast({
      title: `${ticker} removed`,
      description: "Stock removed from watchlist.",
      action: (
        <ToastAction altText="Undo remove" onClick={() => {
          clearTimeout(timer);
          if (prevData) queryClient.setQueryData(["/api/watchlist/enriched"], prevData);
        }}>
          Undo
        </ToastAction>
      ),
    });
  }, [gate, toast]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Eye className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight display-font neon-green-subtle" data-testid="text-watchlist-title">
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
                  <Button variant="outline" className="border-zinc-800 bg-zinc-900" data-testid="button-add-watchlist">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Add to Watchlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Search for a stock</Label>
                      <StockSearch
                        onSelect={(symbol, name) => addMutation.mutate({ ticker: symbol, name })}
                        clearOnSelect
                        placeholder="Search stocks globally... (e.g., Apple, VOD.L)"
                        inputTestId="input-watchlist-search"
                        optionIdPrefix="watchlist-option"
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="overflow-x-auto relative scroll-fade-right">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                ))}
              </div>
            ) : items && items.length > 0 ? (
              <table className="w-full text-sm" data-testid="watchlist-table">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                    <th
                      className="sticky left-0 z-10 bg-zinc-900 px-1.5 sm:px-3 py-2 sm:py-3 text-left font-medium select-none whitespace-nowrap cursor-pointer hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:rounded min-w-[80px] sm:min-w-[140px]"
                      tabIndex={0}
                      role="button"
                      onClick={() => toggleSort("ticker")}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort("ticker"); } }}
                      data-testid="sort-ticker"
                    >
                      <span className="inline-flex items-center gap-1">
                        Ticker
                        {sortKey === "ticker" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-amber-400" /> : <ArrowDown className="h-3 w-3 text-amber-400" />)}
                      </span>
                    </th>
                    <SortHeader label="Price" sortKey="price" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-price" />
                    <SortHeader label="Day %" sortKey="dayChangePercent" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-day" />
                    <SortHeader label="Vol" sortKey="volume" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-volume" />
                    <SortHeader label="Mkt Cap" sortKey="marketCap" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-mktcap" />
                    <SortHeader label="P/E" sortKey="pe" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} testId="sort-pe" />
                    <th className="px-2 sm:px-3 py-3 text-center font-medium whitespace-nowrap text-xs hidden sm:table-cell">52W Range</th>
                    {isAuthenticated && <th className="px-2 sm:px-3 py-3 text-left font-medium whitespace-nowrap text-xs hidden sm:table-cell">Notes</th>}
                    {isAuthenticated && <th className="px-1 sm:px-3 py-2 sm:py-3 w-[44px]"></th>}
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
                        className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors"
                        data-testid={`watchlist-row-${item.ticker}`}
                      >
                        <td className="sticky left-0 z-10 bg-zinc-900 px-1.5 sm:px-3 py-2 sm:py-2.5 overflow-hidden min-w-[80px] sm:min-w-[140px]">
                          <Link href={`/analysis?ticker=${item.ticker}`} className="hover:underline">
                            <span className="font-mono font-semibold text-amber-400 truncate block text-xs sm:text-sm">{item.ticker}</span>
                          </Link>
                          {item.name && item.name !== item.ticker && (
                            <span className="text-[10px] sm:text-xs text-zinc-500 truncate block leading-tight max-w-[70px] sm:max-w-none">{item.name}</span>
                          )}
                        </td>
                        <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-right font-mono text-white whitespace-nowrap text-xs sm:text-sm">
                          {item.price ? `$${item.price.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-right whitespace-nowrap text-xs sm:text-sm">
                          <PercentDisplay value={item.dayChangePercent || 0} />
                        </td>
                        <td className={`px-1.5 sm:px-3 py-2 sm:py-2.5 text-right font-mono text-xs whitespace-nowrap ${highVol ? "text-yellow-400 font-semibold" : "text-zinc-400"}`}>
                          {formatVolume(item.volume)}
                        </td>
                        <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                          {formatMarketCap(item.marketCap)}
                        </td>
                        <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-right font-mono text-zinc-400 text-xs whitespace-nowrap">
                          {item.pe ? item.pe.toFixed(1) : "-"}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5 hidden sm:table-cell">
                          <FiftyTwoWeekBar price={item.price} low={item.yearLow} high={item.yearHigh} />
                        </td>
                        {isAuthenticated && (
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 overflow-hidden hidden sm:table-cell">
                            <InlineNoteEditor itemId={item.id} initialNote={item.notes ?? null} />
                          </td>
                        )}
                        {isAuthenticated && (
                          <td className="px-1 sm:px-3 py-2 sm:py-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id, item.ticker)}
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
