import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Sunrise, Sun, Moon, Newspaper, ChevronDown, ChevronUp } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";

function sanitizeHtml(html: string): string {
  const allowedTags = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;
  return html.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      const isClosing = match.startsWith('</');
      return isClosing ? `</${tagName.toLowerCase()}>` : `<${tagName.toLowerCase()}>`;
    }
    return '';
  }).replace(/on\w+\s*=/gi, '').replace(/javascript:/gi, '');
}

interface MarketSummary {
  summary: string;
  generatedAt: string;
  cached?: boolean;
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

function NewsFeedItemCard({ item, defaultExpanded }: { item: NewsFeedItem; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

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

  const plainContent = item.content.replace(/<[^>]*>/g, '');

  return (
    <div 
      className="px-3 sm:px-4 py-3 border-b border-zinc-800/50 last:border-b-0"
      data-testid={`newsfeed-item-${item.id}`}
    >
      <button
        className="w-full text-left flex items-start gap-2 sm:gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`newsfeed-toggle-${item.id}`}
      >
        <span className="text-lg mt-0.5">{getEventIcon(item.eventType)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded text-xs border ${getMarketBadgeColor(item.market)}`}>
              {item.market}
            </span>
            <span className="text-zinc-500 text-xs ticker-font">
              {formatDate(item.publishedAt)}
            </span>
          </div>
          <h4 className="text-white text-sm font-medium">{item.title}</h4>
          {!expanded && (
            <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{plainContent.substring(0, 120)}...</p>
          )}
        </div>
        <div className="mt-1 text-zinc-500 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 ml-7 sm:ml-8">
          <div 
            className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap [&_b]:text-green-500 [&_b]:font-semibold"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}
            data-testid={`newsfeed-content-${item.id}`}
          />
        </div>
      )}
    </div>
  );
}

function NewsFeed() {
  const { data, isLoading } = useQuery<{ items: NewsFeedItem[] }>({
    queryKey: ["/api/newsfeed"],
    refetchInterval: 120000,
  });

  const items = data?.items || [];

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
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
      <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4">
        <h3 className="text-zinc-300 font-semibold text-sm sm:text-base mb-4">NEWS FEED</h3>
        <p className="text-zinc-500 text-sm">No market updates yet. Check back after market open.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-green-900/30 rounded-lg" data-testid="newsfeed-container">
      <div className="px-3 sm:px-4 py-3 border-b border-green-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">News Feed</h3>
            <p className="text-zinc-500 text-xs">{items.length} updates</p>
          </div>
        </div>
      </div>
      <div className="max-h-[700px] overflow-y-auto">
        {items.map((item, index) => (
          <NewsFeedItemCard
            key={item.id}
            item={item}
            defaultExpanded={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export default function WhatsUpPage() {
  useDocumentTitle("What's Up");
  const { data: summary, isLoading } = useQuery<MarketSummary>({
    queryKey: ["/api/markets/summary"],
  });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="display-font text-3xl tracking-wider neon-green mb-8 uppercase" data-testid="text-whats-up-title">
        What's Up?
      </h1>

      <div className="space-y-6">
        <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Market Summary</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full bg-zinc-800" />
              <Skeleton className="h-4 w-5/6 bg-zinc-800" />
              <Skeleton className="h-4 w-4/6 bg-zinc-800" />
              <Skeleton className="h-4 w-full bg-zinc-800" />
              <Skeleton className="h-4 w-3/4 bg-zinc-800" />
            </div>
          ) : summary ? (
            <div className="text-zinc-300 text-sm leading-relaxed" data-testid="text-market-summary">
              <div 
                className="whitespace-pre-wrap [&_b]:text-green-500 [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(summary.summary) }}
              />
              <p className="text-zinc-600 text-xs mt-4 pt-4 border-t border-zinc-800">
                Last updated: {new Date(summary.generatedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-zinc-500">No market summary available.</p>
          )}
        </div>

        <NewsFeed />
      </div>
    </div>
  );
}
