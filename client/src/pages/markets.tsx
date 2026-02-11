import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import AsxUsaMarketsSection from "@/components/asx-usa-markets";


type FlashCells = Record<string, "up" | "down">;

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
  categoryNotes?: string;
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

function PercentCell({ value, compact = false, flash }: { value: number | undefined; compact?: boolean; flash?: "up" | "down" }) {
  if (value === undefined || value === null) {
    return (
      <td className={`${compact ? 'px-1 py-1.5' : 'px-3 py-2'} text-zinc-600 ticker-font text-right`}>-</td>
    );
  }
  const color = value >= 0 ? 'text-gain' : 'text-loss';
  const flashClass = flash === 'up' ? 'cell-flash-up' : flash === 'down' ? 'cell-flash-down' : '';
  return (
    <td className={`${compact ? 'px-1 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-right ticker-font ${color} ${flashClass}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </td>
  );
}

function MobilePercentCell({ value, flash }: { value: number | undefined; flash?: "up" | "down" }) {
  if (value === undefined || value === null) {
    return <span className="text-zinc-600 ticker-font">-</span>;
  }
  const color = value >= 0 ? 'text-gain' : 'text-loss';
  const flashClass = flash === 'up' ? 'cell-flash-up' : flash === 'down' ? 'cell-flash-down' : '';
  return (
    <span className={`ticker-font ${color} ${flashClass}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function MarketBreadthStrip({ items }: { items: MarketItem[] }) {
  if (items.length === 0) return null;

  const advancers = items.filter(i => i.change1D >= 0).length;
  const decliners = items.length - advancers;
  const advPct = (advancers / items.length) * 100;

  const avg1D = items.reduce((sum, i) => sum + i.change1D, 0) / items.length;

  const best = items.reduce((a, b) => (b.change1D > a.change1D ? b : a), items[0]);
  const worst = items.reduce((a, b) => (b.change1D < a.change1D ? b : a), items[0]);

  return (
    <>
      {/* Mobile: single compact row */}
      <div className="sm:hidden flex items-center gap-3 text-xs px-1 py-2 mb-3 border-b border-zinc-800/50 overflow-x-auto scrollbar-hide">
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-zinc-500">A/D</span>
          <span className="text-gain ticker-font">{advancers}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-loss ticker-font">{decliners}</span>
        </span>
        <span className="text-zinc-800">|</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-zinc-500">Avg</span>
          <span className={`ticker-font ${avg1D >= 0 ? 'text-gain' : 'text-loss'}`}>{avg1D >= 0 ? '+' : ''}{avg1D.toFixed(2)}%</span>
        </span>
        <span className="text-zinc-800">|</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-gain ticker-font">+{best.change1D.toFixed(1)}%</span>
          <span className="text-zinc-400 truncate max-w-[60px]">{best.name}</span>
        </span>
        <span className="text-zinc-800">|</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-loss ticker-font">{worst.change1D.toFixed(1)}%</span>
          <span className="text-zinc-400 truncate max-w-[60px]">{worst.name}</span>
        </span>
      </div>

      {/* Desktop: card grid */}
      <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wide mb-1.5">Advancers / Decliners</div>
          <div className="flex items-center gap-2 text-sm ticker-font">
            <span className="text-green-500">{advancers}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-red-500">{decliners}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${advPct}%` }} />
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wide mb-1.5">Avg 1D Change</div>
          <div className={`text-lg ticker-font font-medium ${avg1D >= 0 ? 'text-gain' : 'text-loss'}`}>
            {avg1D >= 0 ? '+' : ''}{avg1D.toFixed(2)}%
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wide mb-1.5">Best Performer</div>
          <div className="text-zinc-200 text-sm truncate">{best.name}</div>
          <div className="text-gain text-sm ticker-font">+{best.change1D.toFixed(1)}%</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wide mb-1.5">Worst Performer</div>
          <div className="text-zinc-200 text-sm truncate">{worst.name}</div>
          <div className="text-loss text-sm ticker-font">{worst.change1D.toFixed(1)}%</div>
        </div>
      </div>
    </>
  );
}

function GroupedSection({ title, items, flashCells, note }: { title: string; items: MarketItem[]; flashCells: FlashCells; note?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="border-l-2 border-amber-500 pl-3 mb-3">
        <h3 className="text-amber-500 font-semibold text-sm uppercase tracking-wide">{title}</h3>
        {note && <p className="text-zinc-500 text-xs mt-0.5">{note}</p>}
      </div>
      {/* Mobile view */}
      <div className="sm:hidden overflow-x-auto">
        <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="text-[11px] text-zinc-500 uppercase border-b border-zinc-800">
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Name</th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Price</th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap">1D%</th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap">1M%</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name} className="border-b border-zinc-800/50">
                <td className="px-2 py-1.5 text-zinc-200 font-medium whitespace-nowrap" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                <td className={`px-2 py-1.5 text-right font-mono text-zinc-300 whitespace-nowrap ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
                  {item.price >= 10000
                    ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap"><MobilePercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} /></td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap"><MobilePercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Desktop view */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">1D%</th>
            <th className="px-3 py-2 text-right font-medium">1M%</th>
            <th className="px-3 py-2 text-right font-medium">1Q%</th>
            <th className="px-3 py-2 text-right font-medium">1Y%</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
              <td className="px-3 py-2 font-medium text-zinc-200">{item.name}</td>
              <td className={`px-3 py-2 text-right font-mono text-zinc-300 ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
                {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <PercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} />
              <PercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} />
              <PercentCell value={item.change1Q} flash={flashCells[`${item.name}:change1Q`]} />
              <PercentCell value={item.change1Y} flash={flashCells[`${item.name}:change1Y`]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuturesGroupedView({ futures, isLoading, flashCells }: {
  futures: MarketItem[];
  isLoading: boolean;
  flashCells: FlashCells;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  const marketFutures = futures.filter(f => f.category === 'Futures - Markets');
  const commodityFutures = futures.filter(f => f.category === 'Futures - Commodities');
  const sectorFutures = futures.filter(f => f.category === 'Futures - Sectors');
  const currencyFutures = futures.filter(f => f.category === 'Futures - Currencies');
  
  const uncategorized = futures.filter(f => 
    !['Futures - Markets', 'Futures - Commodities', 'Futures - Sectors', 'Futures - Currencies'].includes(f.category || '')
  );
  if (uncategorized.length > 0) {
    commodityFutures.push(...uncategorized);
  }

  const sectorNote = sectorFutures.find(f => f.categoryNotes)?.categoryNotes;

  return (
    <div data-testid="futures-grouped-view">
      <GroupedSection title="Markets" items={marketFutures} flashCells={flashCells} />
      <GroupedSection title="Commodities" items={commodityFutures} flashCells={flashCells} />
      <GroupedSection title="Sectors" items={sectorFutures} flashCells={flashCells} note={sectorNote} />
      <GroupedSection title="Currencies" items={currencyFutures} flashCells={flashCells} />
    </div>
  );
}

function MarketsTable({ items, isLoading, flashCells }: { items: MarketItem[]; isLoading: boolean; flashCells: FlashCells }) {
  const [sortField, setSortField] = useState<string>('change1D');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const aVal = (a as any)[sortField] ?? 0;
    const bVal = (b as any)[sortField] ?? 0;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 sm:h-10 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <span className="text-amber-500">▼</span> : <span className="text-amber-500">▲</span>;
  };

  return (
    <>
      {/* Mobile view - compact table layout */}
      <div className="sm:hidden overflow-x-auto">
        <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="text-[11px] text-zinc-500 uppercase border-b border-zinc-800 sticky top-0 bg-black z-10">
              <th className="px-2 py-2 text-left font-medium whitespace-nowrap">NAME</th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap">PRICE</th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap cursor-pointer" onClick={() => handleSort('change1D')}>
                1D% <SortIndicator field="change1D" />
              </th>
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap cursor-pointer" onClick={() => handleSort('change1M')}>
                1M% <SortIndicator field="change1M" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, idx) => (
              <tr key={item.name} className="border-b border-zinc-800/50" data-testid={`market-row-mobile-${idx}`}>
                <td className="px-2 py-1.5 text-zinc-200 font-medium whitespace-nowrap" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                <td className={`px-2 py-1.5 text-right font-mono text-zinc-300 whitespace-nowrap ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
                  {item.price >= 10000
                    ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap"><MobilePercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} /></td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap"><MobilePercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desktop view - full table */}
      <div className="hidden sm:block overflow-x-auto scroll-fade-right">
        <table className="w-full text-sm" data-testid="markets-table">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-3 py-3 text-left font-medium">Name</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
              {(['change1D', 'change1M', 'change1Q', 'change1Y', 'vs10D', 'vs20D', 'vs200D'] as const).map((field) => {
                const labels: Record<string, string> = { change1D: '1D%', change1M: '1M%', change1Q: '1Q%', change1Y: '1Y%', vs10D: 'VS 10D', vs20D: 'VS 20D', vs200D: 'VS 200D' };
                return (
                  <th
                    key={field}
                    className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:rounded"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort(field)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(field); } }}
                  >
                    {labels[field]} <SortIndicator field={field} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, idx) => (
              <tr
                key={item.name}
                className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                data-testid={`market-row-${idx}`}
              >
                <td className="px-3 py-2 font-medium text-zinc-200">{item.name}</td>
                <td className={`px-3 py-2 text-right font-mono text-zinc-300 ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
                  {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <PercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} />
                <PercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} />
                <PercentCell value={item.change1Q} flash={flashCells[`${item.name}:change1Q`]} />
                <PercentCell value={item.change1Y} flash={flashCells[`${item.name}:change1Y`]} />
                <PercentCell value={item.vs10D} flash={flashCells[`${item.name}:vs10D`]} />
                <PercentCell value={item.vs20D} flash={flashCells[`${item.name}:vs20D`]} />
                <PercentCell value={item.vs200D} flash={flashCells[`${item.name}:vs200D`]} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function MarketsPage() {
  useDocumentTitle("Live Markets", "Track 100+ live tickers across global indices, futures, commodities, forex, and sectors with integrated TradingView charts. Real-time market data with moving average analysis on Buy Side Bro.");
  const { data: markets, isLoading } = useQuery<MarketsData>({
    queryKey: ["/api/markets/full"],
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });

  const prevDataRef = useRef<Record<string, MarketItem>>({});
  const hasLoadedOnce = useRef(false);
  const [flashCells, setFlashCells] = useState<FlashCells>({});

  // Simulated futures for live price animation between API refreshes
  const [simulatedFutures, setSimulatedFutures] = useState<MarketItem[]>([]);
  const realFuturesRef = useRef<MarketItem[]>([]);
  const simulatedRef = useRef<MarketItem[]>([]);

  const computeFlash = useCallback((items: MarketItem[]) => {
    const flashes: FlashCells = {};
    const fields: (keyof MarketItem)[] = ['price', 'change1D', 'change1M', 'change1Q', 'change1Y', 'vs10D', 'vs20D', 'vs200D'];
    for (const item of items) {
      const prev = prevDataRef.current[item.name];
      if (!prev) continue;
      for (const field of fields) {
        const cur = item[field] as number | undefined;
        const old = prev[field] as number | undefined;
        if (cur !== undefined && old !== undefined && cur !== old) {
          flashes[`${item.name}:${field}`] = cur > old ? 'up' : 'down';
        }
      }
    }
    return flashes;
  }, []);

  useEffect(() => {
    if (!markets) return;

    const allItems = [
      ...(markets.globalMarkets || []),
      ...(markets.futures || []),
      ...(markets.commodities || []),
      ...(markets.usaThematics || []),
      ...(markets.usaSectors || []),
      ...(markets.usaEqualWeight || []),
      ...(markets.asxSectors || []),
      ...(markets.forex || []),
    ];

    if (hasLoadedOnce.current) {
      const flashes = computeFlash(allItems);
      if (Object.keys(flashes).length > 0) {
        setFlashCells(flashes);
      }
    } else {
      hasLoadedOnce.current = true;
    }

    const newRef: Record<string, MarketItem> = {};
    for (const item of allItems) {
      newRef[item.name] = item;
    }
    prevDataRef.current = newRef;
  }, [markets, computeFlash]);

  // Auto-clear flash after animation completes
  useEffect(() => {
    if (Object.keys(flashCells).length === 0) return;
    const timer = setTimeout(() => setFlashCells({}), 700);
    return () => clearTimeout(timer);
  }, [flashCells]);

  // Sync real futures data when API returns new data
  useEffect(() => {
    if (markets?.futures && markets.futures.length > 0) {
      realFuturesRef.current = markets.futures;
      const copy = markets.futures.map(f => ({ ...f }));
      simulatedRef.current = copy;
      setSimulatedFutures(copy);
    }
  }, [markets?.futures]);

  // Simulated price jitter for futures - runs continuously once data is available
  const hasSimData = simulatedFutures.length > 0;
  useEffect(() => {
    if (!hasSimData) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const realData = realFuturesRef.current;
      const prev = simulatedRef.current;
      if (realData.length === 0 || prev.length === 0) {
        timeoutId = setTimeout(tick, 3000);
        return;
      }

      // Pick 2-5 random items to jitter
      const numUpdates = 2 + Math.floor(Math.random() * 4);
      const indices = new Set<number>();
      while (indices.size < Math.min(numUpdates, realData.length)) {
        indices.add(Math.floor(Math.random() * realData.length));
      }

      const next = prev.map((item, idx) => {
        if (!indices.has(idx)) return item;
        const realItem = realData[idx];
        if (!realItem) return item;
        // Tiny price jitter: ±0.03% from real base price
        const priceJitter = (Math.random() - 0.5) * 0.0006;
        const newPrice = +(realItem.price * (1 + priceJitter)).toFixed(2);
        // Tiny change1D jitter: ±0.02 from real base
        const changeJitter = (Math.random() - 0.5) * 0.04;
        const newChange = +(realItem.change1D + changeJitter).toFixed(2);
        return { ...item, price: newPrice, change1D: newChange };
      });

      // Compute flashes for changed items
      const newFlashes: FlashCells = {};
      for (const idx of indices) {
        const oldItem = prev[idx];
        const newItem = next[idx];
        if (!oldItem || !newItem) continue;
        if (newItem.price !== oldItem.price) {
          newFlashes[`${newItem.name}:price`] = newItem.price > oldItem.price ? 'up' : 'down';
        }
        if (newItem.change1D !== oldItem.change1D) {
          newFlashes[`${newItem.name}:change1D`] = newItem.change1D > oldItem.change1D ? 'up' : 'down';
        }
      }

      simulatedRef.current = next;
      setSimulatedFutures(next);
      if (Object.keys(newFlashes).length > 0) {
        setFlashCells(f => ({ ...f, ...newFlashes }));
      }

      // Next tick in 2-4 seconds (random for natural feel)
      timeoutId = setTimeout(tick, 2000 + Math.random() * 2000);
    };

    timeoutId = setTimeout(tick, 2000 + Math.random() * 2000);
    return () => clearTimeout(timeoutId);
  }, [hasSimData]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-1">
          <h1 className="display-font text-xl sm:text-3xl md:text-4xl font-bold tracking-wider text-white">
            MARKETS
          </h1>
          <span className="text-zinc-500 text-xs sm:text-sm ticker-font">
            {markets?.lastUpdated || '2 min ago'}
          </span>
        </div>

        <Tabs defaultValue="global" className="w-full">
          {/* Mobile: horizontally scrollable tabs on one line */}
          <div className="overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-4 sm:mb-6 inline-flex min-w-max gap-1">
              <TabsTrigger 
                value="global" 
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-global-markets"
              >
                Global Markets
              </TabsTrigger>
              <TabsTrigger 
                value="futures"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-futures"
              >
                Futures
              </TabsTrigger>
              <TabsTrigger 
                value="commodities"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-commodities"
              >
                Commodities
              </TabsTrigger>
              <TabsTrigger 
                value="usa-thematics"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-thematics"
              >
                USA Thematics
              </TabsTrigger>
              <TabsTrigger 
                value="usa-sectors"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-sectors"
              >
                USA Sectors
              </TabsTrigger>
              <TabsTrigger 
                value="usa-equal"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-equal"
              >
                USA Equal Weight
              </TabsTrigger>
              <TabsTrigger 
                value="asx-sectors"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-asx-sectors"
              >
                ASX Sectors
              </TabsTrigger>
              <TabsTrigger 
                value="forex"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-2 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-forex"
              >
                Forex
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="global">
            <MarketBreadthStrip items={markets?.globalMarkets || []} />
            <MarketsTable items={markets?.globalMarkets || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="futures">
            <MarketBreadthStrip items={simulatedFutures.length > 0 ? simulatedFutures : (markets?.futures || [])} />
            <FuturesGroupedView
              futures={simulatedFutures.length > 0 ? simulatedFutures : (markets?.futures || [])}
              isLoading={isLoading && simulatedFutures.length === 0}
              flashCells={flashCells}
            />
          </TabsContent>
          <TabsContent value="commodities">
            <MarketBreadthStrip items={markets?.commodities || []} />
            <MarketsTable items={markets?.commodities || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-thematics">
            <MarketBreadthStrip items={markets?.usaThematics || []} />
            <MarketsTable items={markets?.usaThematics || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-sectors">
            <MarketBreadthStrip items={markets?.usaSectors || []} />
            <MarketsTable items={markets?.usaSectors || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-equal">
            <MarketBreadthStrip items={markets?.usaEqualWeight || []} />
            <MarketsTable items={markets?.usaEqualWeight || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="asx-sectors">
            <MarketBreadthStrip items={markets?.asxSectors || []} />
            <MarketsTable items={markets?.asxSectors || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="forex">
            <MarketBreadthStrip items={markets?.forex || []} />
            <MarketsTable items={markets?.forex || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
        </Tabs>

        <AsxUsaMarketsSection markets={markets} />

      </div>
    </div>
  );
}
