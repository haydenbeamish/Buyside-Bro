import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { MarketWrapEmailCTA } from "@/components/market-wrap-email-cta";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

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


function TickerTape({ items, flashCells }: { items: MarketItem[]; flashCells: FlashCells }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<MarketItem[]>(items);
  
  // Update ref when items change without restarting animation
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  
  // Animation effect runs once on mount, doesn't restart when data refreshes
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    let animationId: number;
    let scrollPos = scrollContainer.scrollLeft || 0;
    
    const scroll = () => {
      scrollPos += 1.5;
      if (scrollPos >= scrollContainer.scrollWidth / 2) {
        scrollPos = 0;
      }
      scrollContainer.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(scroll);
    };
    
    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const duplicatedItems = [...items, ...items];

  return (
    <div className="bg-black border-b border-zinc-800 overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex whitespace-nowrap py-2 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {duplicatedItems.map((item, idx) => (
          <div 
            key={`${item.name}-${idx}`}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 border-r border-zinc-800"
          >
            <span className="text-zinc-400 text-xs sm:text-sm ticker-font">{item.name}</span>
            <span className="text-zinc-200 text-xs sm:text-sm ticker-font">
              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs sm:text-sm ticker-font ${item.change1D >= 0 ? 'text-green-500' : 'text-red-500'} ${flashCells[`${item.name}:change1D`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:change1D`] === 'down' ? 'cell-flash-down' : ''}`}>
              {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PercentCell({ value, compact = false, flash }: { value: number | undefined; compact?: boolean; flash?: "up" | "down" }) {
  if (value === undefined || value === null) {
    return (
      <td className={`${compact ? 'px-1 py-1.5' : 'px-3 py-2'} text-zinc-600 ticker-font text-right`}>-</td>
    );
  }
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
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
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  const flashClass = flash === 'up' ? 'cell-flash-up' : flash === 'down' ? 'cell-flash-down' : '';
  return (
    <span className={`ticker-font ${color} ${flashClass}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function getHeatColor(value: number | undefined): string {
  if (value === undefined || value === null) return "rgba(39,39,42,0.8)"; // zinc-800
  const clamped = Math.max(-20, Math.min(20, value));
  const intensity = Math.abs(clamped) / 20;
  if (value > 0) return `rgba(34,197,94,${0.15 + intensity * 0.55})`; // green
  if (value < 0) return `rgba(239,68,68,${0.15 + intensity * 0.55})`; // red
  return "rgba(39,39,42,0.5)";
}

function RotationHeatmap({ items }: { items: MarketItem[] }) {
  if (items.length === 0) return null;

  const columns: { key: keyof MarketItem; label: string }[] = [
    { key: "change1D", label: "1D" },
    { key: "change1M", label: "1M" },
    { key: "change1Q", label: "1Q" },
    { key: "change1Y", label: "1Y" },
  ];

  // Filter out columns where ALL items have undefined values
  const activeColumns = columns.filter((col) =>
    items.some((item) => item[col.key] !== undefined && item[col.key] !== null)
  );

  if (activeColumns.length === 0) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 sm:p-4">
      <h3 className="text-zinc-400 text-xs uppercase tracking-wide mb-3 font-medium">Performance Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-zinc-500 font-medium py-1 pr-3 sticky left-0 bg-zinc-900/50 min-w-[100px]">Name</th>
              {activeColumns.map((col) => (
                <th key={col.key} className="text-center text-zinc-500 font-medium py-1 px-2 min-w-[52px]">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td className="text-zinc-300 py-1 pr-3 sticky left-0 bg-zinc-900/50 truncate max-w-[140px]">{item.name}</td>
                {activeColumns.map((col) => {
                  const val = item[col.key] as number | undefined;
                  return (
                    <td key={col.key} className="py-1 px-1">
                      <div
                        className="rounded text-center py-1 px-1 text-[11px] font-mono"
                        style={{ backgroundColor: getHeatColor(val) }}
                      >
                        <span className={val === undefined || val === null ? "text-zinc-600" : "text-zinc-100"}>
                          {val === undefined || val === null ? "-" : `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DOT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e879f9", "#facc15", "#fb923c", "#34d399",
];

interface RRGPoint {
  name: string;
  x: number;
  y: number;
}

function RotationGraph({ items }: { items: MarketItem[] }) {
  if (items.length === 0) return null;

  // Determine which data fields are available
  const has1Q = items.some((i) => i.change1Q !== undefined && i.change1Q !== null);
  const has1M = items.some((i) => i.change1M !== undefined && i.change1M !== null);

  if (!has1M && !has1Q) return null;

  const points: RRGPoint[] = items
    .map((item) => {
      let x: number | undefined;
      let y: number | undefined;

      if (has1Q && item.change1Q !== undefined && item.change1Q !== null) {
        x = item.change1Q;
        y = (item.change1M ?? 0) - item.change1Q / 3;
      } else if (has1M && item.change1M !== undefined && item.change1M !== null) {
        x = item.change1M;
        y = (item.change1D ?? 0) - item.change1M / 22;
      } else {
        return null;
      }

      return { name: item.name, x, y };
    })
    .filter((p): p is RRGPoint => p !== null);

  if (points.length === 0) return null;

  // Compute axis ranges with padding
  const allX = points.map((p) => p.x);
  const allY = points.map((p) => p.y);
  const xMin = Math.min(...allX, 0);
  const xMax = Math.max(...allX, 0);
  const yMin = Math.min(...allY, 0);
  const yMax = Math.max(...allY, 0);
  const xPad = Math.max((xMax - xMin) * 0.15, 1);
  const yPad = Math.max((yMax - yMin) * 0.15, 0.5);

  const xAxisLabel = has1Q ? "Quarterly Momentum %" : "Monthly Momentum %";
  const yAxisLabel = "Momentum Change";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 sm:p-4">
      <h3 className="text-zinc-400 text-xs uppercase tracking-wide mb-3 font-medium">Relative Rotation</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
          <XAxis
            type="number"
            dataKey="x"
            domain={[xMin - xPad, xMax + xPad]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
            label={{ value: xAxisLabel, position: "bottom", offset: 10, fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[yMin - yPad, yMax + yPad]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft", offset: 0, fill: "#71717a", fontSize: 11 }}
          />
          <ZAxis range={[60, 60]} />

          {/* Crosshairs at origin */}
          <ReferenceLine x={0} stroke="#52525b" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />

          <Tooltip
            cursor={false}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const data = payload[0].payload as RRGPoint;
              return (
                <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs shadow-lg">
                  <div className="text-zinc-200 font-medium mb-1">{data.name}</div>
                  <div className="text-zinc-400">
                    {xAxisLabel}: <span className={data.x >= 0 ? "text-green-400" : "text-red-400"}>{data.x >= 0 ? "+" : ""}{data.x.toFixed(2)}%</span>
                  </div>
                  <div className="text-zinc-400">
                    {yAxisLabel}: <span className={data.y >= 0 ? "text-green-400" : "text-red-400"}>{data.y >= 0 ? "+" : ""}{data.y.toFixed(2)}</span>
                  </div>
                </div>
              );
            }}
          />

          <Scatter data={points} shape="circle">
            {points.map((_, idx) => (
              <Cell key={idx} fill={DOT_COLORS[idx % DOT_COLORS.length]} />
            ))}
          </Scatter>

          {/* Quadrant labels as reference lines with labels */}
          <ReferenceLine
            x={(xMax + xPad) * 0.6}
            y={(yMax + yPad) * 0.85}
            ifOverflow="extendDomain"
            stroke="transparent"
            label={{ value: "Leading", fill: "rgba(34,197,94,0.5)", fontSize: 11 }}
          />
          <ReferenceLine
            x={(xMax + xPad) * 0.6}
            y={(yMin - yPad) * 0.85}
            ifOverflow="extendDomain"
            stroke="transparent"
            label={{ value: "Weakening", fill: "rgba(234,179,8,0.5)", fontSize: 11 }}
          />
          <ReferenceLine
            x={(xMin - xPad) * 0.6}
            y={(yMin - yPad) * 0.85}
            ifOverflow="extendDomain"
            stroke="transparent"
            label={{ value: "Lagging", fill: "rgba(239,68,68,0.5)", fontSize: 11 }}
          />
          <ReferenceLine
            x={(xMin - xPad) * 0.6}
            y={(yMax + yPad) * 0.85}
            ifOverflow="extendDomain"
            stroke="transparent"
            label={{ value: "Improving", fill: "rgba(59,130,246,0.5)", fontSize: 11 }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        {points.map((p, idx) => (
          <div key={p.name} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DOT_COLORS[idx % DOT_COLORS.length] }} />
            <span className="truncate max-w-[100px]">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
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
      <div className="sm:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_60px_48px_48px] sm:grid-cols-[minmax(0,1fr)_70px_52px_52px] gap-1 px-2 py-2 text-[11px] text-zinc-500 uppercase border-b border-zinc-800 items-center">
          <span>Name</span>
          <span className="text-right">Price</span>
          <span className="text-right">1D%</span>
          <span className="text-right">1M%</span>
        </div>
        {items.map((item) => (
          <div
            key={item.name}
            className="grid grid-cols-[minmax(0,1fr)_60px_48px_48px] sm:grid-cols-[minmax(0,1fr)_70px_52px_52px] gap-1 px-2 py-2.5 border-b border-zinc-800/50 text-xs"
          >
            <span className="text-zinc-200 truncate">{item.name}</span>
            <span className={`text-right font-mono text-zinc-300 ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
              {item.price >= 10000
                ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
            </span>
            <span className="text-right"><MobilePercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} /></span>
            <span className="text-right"><MobilePercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} /></span>
          </div>
        ))}
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
      {/* Mobile view - compact 4-column layout */}
      <div className="sm:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_60px_48px_48px] sm:grid-cols-[minmax(0,1fr)_70px_52px_52px] gap-1 px-2 py-2 text-[11px] text-zinc-500 uppercase border-b border-zinc-800 sticky top-0 bg-black z-10 items-center">
          <span className="font-medium">NAME</span>
          <span className="text-right font-medium">PRICE</span>
          <button
            onClick={() => handleSort('change1D')}
            className="text-right font-medium flex items-center justify-end gap-0.5 min-h-[44px]"
          >
            1D% <SortIndicator field="change1D" />
          </button>
          <button
            onClick={() => handleSort('change1M')}
            className="text-right font-medium flex items-center justify-end gap-0.5 min-h-[44px]"
          >
            1M% <SortIndicator field="change1M" />
          </button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {sortedItems.map((item, idx) => (
            <div
              key={item.name}
              className="grid grid-cols-[minmax(0,1fr)_60px_48px_48px] sm:grid-cols-[minmax(0,1fr)_70px_52px_52px] gap-1 px-2 py-3 text-xs"
              data-testid={`market-row-mobile-${idx}`}
            >
              <span className="text-zinc-200 truncate pr-1">{item.name}</span>
              <span className={`text-right font-mono text-zinc-300 ${flashCells[`${item.name}:price`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:price`] === 'down' ? 'cell-flash-down' : ''}`}>
                {item.price >= 10000
                  ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </span>
              <span className="text-right"><MobilePercentCell value={item.change1D} flash={flashCells[`${item.name}:change1D`]} /></span>
              <span className="text-right"><MobilePercentCell value={item.change1M} flash={flashCells[`${item.name}:change1M`]} /></span>
            </div>
          ))}
        </div>
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
  useDocumentTitle("Live Markets");
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

  const tickerItems = markets?.globalMarkets || [];

  return (
    <div className="min-h-screen bg-black">
      <TickerTape items={tickerItems} flashCells={flashCells} />
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-1">
          <h1 className="display-font text-2xl sm:text-3xl font-bold tracking-wider text-white">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.globalMarkets || []} />
              <RotationGraph items={markets?.globalMarkets || []} />
            </div>
            <MarketsTable items={markets?.globalMarkets || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="futures">
            {(() => { const futuresItems = simulatedFutures.length > 0 ? simulatedFutures : (markets?.futures || []); return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <RotationHeatmap items={futuresItems} />
                <RotationGraph items={futuresItems} />
              </div>
            ); })()}
            <FuturesGroupedView
              futures={simulatedFutures.length > 0 ? simulatedFutures : (markets?.futures || [])}
              isLoading={isLoading && simulatedFutures.length === 0}
              flashCells={flashCells}
            />
          </TabsContent>
          <TabsContent value="commodities">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.commodities || []} />
              <RotationGraph items={markets?.commodities || []} />
            </div>
            <MarketsTable items={markets?.commodities || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-thematics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.usaThematics || []} />
              <RotationGraph items={markets?.usaThematics || []} />
            </div>
            <MarketsTable items={markets?.usaThematics || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-sectors">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.usaSectors || []} />
              <RotationGraph items={markets?.usaSectors || []} />
            </div>
            <MarketsTable items={markets?.usaSectors || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="usa-equal">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.usaEqualWeight || []} />
              <RotationGraph items={markets?.usaEqualWeight || []} />
            </div>
            <MarketsTable items={markets?.usaEqualWeight || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="asx-sectors">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.asxSectors || []} />
              <RotationGraph items={markets?.asxSectors || []} />
            </div>
            <MarketsTable items={markets?.asxSectors || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
          <TabsContent value="forex">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <RotationHeatmap items={markets?.forex || []} />
              <RotationGraph items={markets?.forex || []} />
            </div>
            <MarketsTable items={markets?.forex || []} isLoading={isLoading} flashCells={flashCells} />
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <MarketWrapEmailCTA />
        </div>
      </div>
    </div>
  );
}
