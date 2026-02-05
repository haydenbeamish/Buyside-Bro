import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, Sunrise, Sun, Moon, Newspaper } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
    <div className="bg-black border-b border-green-900/30 overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex whitespace-nowrap py-2 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {duplicatedItems.map((item, idx) => (
          <div 
            key={`${item.name}-${idx}`}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 border-r border-green-900/30"
          >
            <span className="text-zinc-400 text-xs sm:text-sm ticker-font">{item.name}</span>
            <span className="text-zinc-200 text-xs sm:text-sm ticker-font">
              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs sm:text-sm ticker-font ${item.change1D >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PercentCell({ value, compact = false }: { value: number | undefined; compact?: boolean }) {
  if (value === undefined || value === null) {
    return (
      <td className={`${compact ? 'px-1 py-1.5' : 'px-3 py-2'} text-zinc-600 ticker-font text-right`}>-</td>
    );
  }
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <td className={`${compact ? 'px-1 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-right ticker-font ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </td>
  );
}

function MobilePercentCell({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) {
    return <span className="text-zinc-600 ticker-font">-</span>;
  }
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <span className={`ticker-font ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function GroupedSection({ title, items }: { title: string; items: MarketItem[] }) {
  return (
    <div className="mb-6">
      <div className="border-l-2 border-green-500 pl-3 mb-3">
        <h3 className="text-green-500 font-semibold text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {/* Mobile view */}
      <div className="sm:hidden">
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5 text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
          <span>Name</span>
          <span className="text-right">Price</span>
          <span className="text-right">1D%</span>
          <span className="text-right">1M%</span>
        </div>
        {items.map((item) => (
          <div 
            key={item.name} 
            className="grid grid-cols-4 gap-1 px-2 py-2 border-b border-zinc-800/50 text-xs"
          >
            <span className="text-zinc-200 truncate">{item.name}</span>
            <span className="text-right font-mono text-zinc-300">
              {item.price >= 10000 
                ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
            </span>
            <span className="text-right"><MobilePercentCell value={item.change1D} /></span>
            <span className="text-right"><MobilePercentCell value={item.change1M} /></span>
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

function FuturesGroupedView({ futures, isLoading }: { 
  futures: MarketItem[]; 
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

  const marketKeywords = ['VIX', 'Nasdaq', 'Hang Seng', 'Russell', 'S&P', 'Euro Stoxx', 'CSI'];
  const currencyKeywords = ['Yen', 'Dollar', 'Pound', 'Euro ', 'JPY', 'AUD', 'GBP', 'EUR'];
  
  const marketFutures = futures.filter(f => 
    marketKeywords.some(k => f.name.includes(k)) || f.name.includes('Index')
  );
  
  const currencyFutures = futures.filter(f => 
    currencyKeywords.some(k => f.name.includes(k)) && !marketKeywords.some(k => f.name.includes(k))
  );
  
  const commodityFutures = futures.filter(f => 
    !marketFutures.includes(f) && !currencyFutures.includes(f)
  );

  return (
    <div data-testid="futures-grouped-view">
      <GroupedSection title="Markets" items={marketFutures} />
      <GroupedSection title="Commodities" items={commodityFutures} />
      <GroupedSection title="Currencies" items={currencyFutures} />
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
          <Skeleton key={i} className="h-8 sm:h-10 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <span className="text-green-500">▼</span> : <span className="text-green-500">▲</span>;
  };

  return (
    <>
      {/* Mobile view - compact 4-column layout */}
      <div className="sm:hidden">
        <div className="grid grid-cols-4 gap-1 px-2 py-2 text-[10px] text-zinc-500 uppercase border-b border-zinc-800 sticky top-0 bg-black z-10">
          <span className="font-medium">NAME</span>
          <span className="text-right font-medium">PRICE</span>
          <button 
            onClick={() => handleSort('change1D')} 
            className="text-right font-medium flex items-center justify-end gap-0.5"
          >
            1D% <SortIndicator field="change1D" />
          </button>
          <button 
            onClick={() => handleSort('change1M')} 
            className="text-right font-medium flex items-center justify-end gap-0.5"
          >
            1M% <SortIndicator field="change1M" />
          </button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {sortedItems.map((item, idx) => (
            <div 
              key={item.name} 
              className="grid grid-cols-4 gap-1 px-2 py-2.5 text-xs"
              data-testid={`market-row-mobile-${idx}`}
            >
              <span className="text-zinc-200 truncate pr-1">{item.name}</span>
              <span className="text-right font-mono text-zinc-300">
                {item.price >= 10000 
                  ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </span>
              <span className="text-right"><MobilePercentCell value={item.change1D} /></span>
              <span className="text-right"><MobilePercentCell value={item.change1M} /></span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop view - full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" data-testid="markets-table">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-3 py-3 text-left font-medium">Name</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('change1D')}
              >
                1D% <SortIndicator field="change1D" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('change1M')}
              >
                1M% <SortIndicator field="change1M" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('change1Q')}
              >
                1Q% <SortIndicator field="change1Q" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('change1Y')}
              >
                1Y% <SortIndicator field="change1Y" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('vs10D')}
              >
                VS 10D <SortIndicator field="vs10D" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('vs20D')}
              >
                VS 20D <SortIndicator field="vs20D" />
              </th>
              <th 
                className="px-3 py-3 text-right font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('vs200D')}
              >
                VS 200D <SortIndicator field="vs200D" />
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
    </>
  );
}

function MarketSummary() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: summary } = useQuery<{ summary: string }>({
    queryKey: ["/api/markets/summary"],
  });

  if (!summary?.summary) return null;

  return (
    <div className="border border-zinc-800 rounded-lg mt-6 bg-zinc-900/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left"
        data-testid="button-market-summary-toggle"
      >
        <span className="text-zinc-300 font-semibold text-sm sm:text-base">MARKET SUMMARY</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-4 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              h1: ({children}) => <h1 className="text-lg sm:text-xl font-bold text-green-400 mb-3">{children}</h1>,
              h2: ({children}) => <h2 className="text-base sm:text-lg font-semibold text-green-400 mt-4 mb-2">{children}</h2>,
              p: ({children}) => <p className="text-xs sm:text-sm text-zinc-300 mb-2 leading-relaxed">{children}</p>,
              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
              b: ({children}) => <b className="text-green-400 font-semibold">{children}</b>,
            }}
          >
            {summary.summary.replace(/<\/?b>/g, '**')}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface NewsFeedItem {
  id: number;
  title: string;
  content: string;
  market: string;
  eventType: string;
  publishedAt: string;
  source: string;
}

function NewsFeed() {
  const { data, isLoading } = useQuery<{ items: NewsFeedItem[] }>({
    queryKey: ["/api/newsfeed"],
    refetchInterval: 120000,
  });

  const items = data?.items || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMarketBadgeColor = (market: string) => {
    switch (market) {
      case 'ASX': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'USA': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Europe': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getEventIcon = (eventType: string) => {
    const iconClass = "w-4 h-4";
    switch (eventType) {
      case 'open': return <Sunrise className={`${iconClass} text-orange-400`} />;
      case 'midday': return <Sun className={`${iconClass} text-yellow-400`} />;
      case 'close': return <Moon className={`${iconClass} text-blue-400`} />;
      default: return <Newspaper className={`${iconClass} text-zinc-400`} />;
    }
  };

  if (isLoading) {
    return (
      <div className="border border-zinc-800 rounded-lg mt-4 bg-zinc-900/50 p-4">
        <h3 className="text-zinc-300 font-semibold text-sm sm:text-base mb-4">NEWS FEED</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-l-2 border-green-500/30 pl-3">
              <Skeleton className="h-4 w-3/4 bg-zinc-800 mb-2" />
              <Skeleton className="h-3 w-1/4 bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-zinc-800 rounded-lg mt-4 bg-zinc-900/50 p-4">
        <h3 className="text-zinc-300 font-semibold text-sm sm:text-base mb-4">NEWS FEED</h3>
        <p className="text-zinc-500 text-sm">No market updates yet. Check back after market open.</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg mt-4 bg-zinc-900/50">
      <div className="px-3 sm:px-4 py-3 border-b border-zinc-800">
        <h3 className="text-zinc-300 font-semibold text-sm sm:text-base">NEWS FEED</h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="px-3 sm:px-4 py-3 border-b border-zinc-800/50 last:border-b-0 hover-elevate"
            data-testid={`newsfeed-item-${item.id}`}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <span className="text-lg">{getEventIcon(item.eventType)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs border ${getMarketBadgeColor(item.market)}`}>
                    {item.market}
                  </span>
                  <span className="text-zinc-500 text-xs ticker-font">
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
                <h4 className="text-white text-sm font-medium mb-1 line-clamp-1">{item.title}</h4>
                <p className="text-zinc-400 text-xs line-clamp-2">{item.content.replace(/<[^>]*>/g, '').substring(0, 200)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MarketsPage() {
  const { data: markets, isLoading } = useQuery<MarketsData>({
    queryKey: ["/api/markets/full"],
    refetchInterval: 60000,
  });

  const tickerItems = markets?.globalMarkets || [];

  return (
    <div className="min-h-screen bg-black">
      <TickerTape items={tickerItems} />
      
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
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-global-markets"
              >
                Global Markets
              </TabsTrigger>
              <TabsTrigger 
                value="futures"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-futures"
              >
                Futures
              </TabsTrigger>
              <TabsTrigger 
                value="commodities"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-commodities"
              >
                Commodities
              </TabsTrigger>
              <TabsTrigger 
                value="usa-thematics"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-thematics"
              >
                USA Thematics
              </TabsTrigger>
              <TabsTrigger 
                value="usa-sectors"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-sectors"
              >
                USA Sectors
              </TabsTrigger>
              <TabsTrigger 
                value="usa-equal"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-usa-equal"
              >
                USA Equal Weight
              </TabsTrigger>
              <TabsTrigger 
                value="asx-sectors"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-asx-sectors"
              >
                ASX Sectors
              </TabsTrigger>
              <TabsTrigger 
                value="forex"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-3 py-1.5 text-xs sm:text-sm ticker-font whitespace-nowrap"
                data-testid="tab-forex"
              >
                Forex
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="global">
            <MarketsTable items={markets?.globalMarkets || []} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="futures">
            <FuturesGroupedView 
              futures={markets?.futures || []} 
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

        <MarketSummary />
        <NewsFeed />
      </div>
    </div>
  );
}
