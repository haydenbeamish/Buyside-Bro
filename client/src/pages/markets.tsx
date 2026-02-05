import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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

interface MarketSummary {
  summary: string;
  generatedAt: string;
  cached?: boolean;
}

function TickerTape({ items }: { items: MarketItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    let animationId: number;
    let scrollPos = 0;
    
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
  }, [items]);

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
            className="flex items-center gap-2 px-4 border-r border-zinc-800"
          >
            <span className="text-zinc-400 text-sm font-medium">{item.name}</span>
            <span className="text-white text-sm font-mono">
              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-sm font-mono ${item.change1D >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PercentCell({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) return <td className="px-3 py-2 text-zinc-500">-</td>;
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <td className={`px-3 py-2 text-right font-mono text-sm ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </td>
  );
}

function GroupedSection({ title, items }: { title: string; items: MarketItem[] }) {
  return (
    <div className="mb-6">
      <div className="border-l-2 border-amber-500 pl-3 mb-3">
        <h3 className="text-amber-500 font-semibold text-sm uppercase tracking-wide">{title}</h3>
      </div>
      <table className="w-full text-sm">
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
              <td className="px-3 py-2 text-right font-mono text-zinc-300">
                {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <PercentCell value={item.change1D} />
              <PercentCell value={item.change1M} />
              <PercentCell value={item.change1Q} />
              <PercentCell value={item.change1Y} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuturesGroupedView({ futures, commodities, forex, isLoading }: { 
  futures: MarketItem[]; 
  commodities: MarketItem[]; 
  forex: MarketItem[];
  isLoading: boolean;
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

  return (
    <div className="overflow-x-auto" data-testid="futures-grouped-view">
      <GroupedSection title="Markets" items={futures} />
      <GroupedSection title="Commodities" items={commodities} />
      <GroupedSection title="Currencies" items={forex} />
    </div>
  );
}

function MarketsTable({ items, isLoading }: { items: MarketItem[]; isLoading: boolean }) {
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
          <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="markets-table">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
            <th className="px-3 py-3 text-left font-medium">Name</th>
            <th className="px-3 py-3 text-right font-medium">Price</th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('change1D')}
            >
              1D% {sortField === 'change1D' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('change1M')}
            >
              1M% {sortField === 'change1M' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('change1Q')}
            >
              1Q% {sortField === 'change1Q' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('change1Y')}
            >
              1Y% {sortField === 'change1Y' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('vs10D')}
            >
              VS 10D {sortField === 'vs10D' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('vs20D')}
            >
              VS 20D {sortField === 'vs20D' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
            <th 
              className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => handleSort('vs200D')}
            >
              VS 200D {sortField === 'vs200D' && (sortDir === 'desc' ? '▼' : '▲')}
            </th>
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
              <td className="px-3 py-2 text-right font-mono text-zinc-300">
                {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <PercentCell value={item.change1D} />
              <PercentCell value={item.change1M} />
              <PercentCell value={item.change1Q} />
              <PercentCell value={item.change1Y} />
              <PercentCell value={item.vs10D} />
              <PercentCell value={item.vs20D} />
              <PercentCell value={item.vs200D} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketsPage() {
  const [summaryOpen, setSummaryOpen] = useState(true);
  
  const { data: markets, isLoading } = useQuery<MarketsData>({
    queryKey: ["/api/markets/full"],
    refetchInterval: 60000,
  });

  const { data: summary } = useQuery<MarketSummary>({
    queryKey: ["/api/markets/summary"],
    refetchInterval: 300000,
  });

  const tickerItems = markets?.globalMarkets || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <TickerTape items={tickerItems} />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            MARKETS
          </h1>
          <span className="text-zinc-500 text-sm">
            {markets?.lastUpdated || '2 min ago'}
          </span>
        </div>

        <Tabs defaultValue="global" className="w-full">
          <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-auto p-0 mb-6">
            <TabsTrigger 
              value="global" 
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-global-markets"
            >
              Global Markets
            </TabsTrigger>
            <TabsTrigger 
              value="futures"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-futures"
            >
              Futures
            </TabsTrigger>
            <TabsTrigger 
              value="commodities"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-commodities"
            >
              Commodities
            </TabsTrigger>
            <TabsTrigger 
              value="usa-thematics"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-usa-thematics"
            >
              USA Thematics
            </TabsTrigger>
            <TabsTrigger 
              value="usa-sectors"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-usa-sectors"
            >
              USA Sectors
            </TabsTrigger>
            <TabsTrigger 
              value="usa-equal"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-usa-equal"
            >
              USA Equal Weight Sectors
            </TabsTrigger>
            <TabsTrigger 
              value="asx-sectors"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-asx-sectors"
            >
              ASX Sectors
            </TabsTrigger>
            <TabsTrigger 
              value="forex"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-forex"
            >
              Forex
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            <MarketsTable items={markets?.globalMarkets || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="futures">
            <FuturesGroupedView 
              futures={markets?.futures || []} 
              commodities={markets?.commodities || []}
              forex={markets?.forex || []}
              isLoading={isLoading} 
            />
          </TabsContent>
          <TabsContent value="commodities">
            <MarketsTable items={markets?.commodities || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="usa-thematics">
            <MarketsTable items={markets?.usaThematics || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="usa-sectors">
            <MarketsTable items={markets?.usaSectors || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="usa-equal">
            <MarketsTable items={markets?.usaEqualWeight || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="asx-sectors">
            <MarketsTable items={markets?.asxSectors || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="forex">
            <MarketsTable items={markets?.forex || []} isLoading={isLoading} />
          </TabsContent>
        </Tabs>

        <div className="mt-8 border-t border-zinc-800 pt-6">
          <button 
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-full justify-between"
            data-testid="button-toggle-summary"
          >
            <span className="text-sm font-medium uppercase tracking-wide">Market Summary</span>
            {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {summaryOpen && summary && (
            <div className="mt-4 text-zinc-400 text-sm leading-relaxed">
              <div 
                className="text-zinc-300 whitespace-pre-wrap [&_b]:text-amber-500 [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: summary.summary }}
              />
              <p className="text-zinc-600 text-xs mt-3">
                Last updated: {new Date(summary.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
