import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ExternalLink,
  Clock,
  TrendingUp,
  Globe,
} from "lucide-react";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category?: string;
  sentiment?: "positive" | "negative" | "neutral";
  tickers?: string[];
}

interface NewsData {
  general: NewsArticle[];
  market: NewsArticle[];
}

export default function NewsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: news, isLoading } = useQuery<NewsData>({
    queryKey: ["/api/news"],
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/news/search", searchQuery],
    enabled: searchQuery.length > 2,
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "border-green-500/50 text-green-500";
      case "negative":
        return "border-red-500/50 text-red-500";
      default:
        return "border-zinc-700 text-zinc-400";
    }
  };

  const NewsCard = ({ article }: { article: NewsArticle }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-white leading-snug line-clamp-2">
            {article.title}
          </h3>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-zinc-500 hover:text-white transition-colors"
            data-testid={`link-news-${article.title.slice(0, 20)}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        {article.description && (
          <p className="text-sm text-zinc-500 line-clamp-2">
            {article.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
            {article.source}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            {formatTime(article.publishedAt)}
          </div>
          {article.sentiment && (
            <Badge variant="outline" className={`text-xs ${getSentimentColor(article.sentiment)}`}>
              {article.sentiment}
            </Badge>
          )}
        </div>
        {article.tickers && article.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.tickers.slice(0, 5).map((ticker) => (
              <Badge key={ticker} variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-300">
                ${ticker}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const NewsCardSkeleton = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="space-y-3">
        <Skeleton className="h-5 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-3/4 bg-zinc-800" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 bg-zinc-800" />
          <Skeleton className="h-5 w-12 bg-zinc-800" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              FINANCIAL NEWS
            </h1>
            <p className="text-zinc-500">
              Stay updated with the latest market news and insights
            </p>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="search"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white"
              data-testid="input-search-news"
            />
          </div>
        </div>

        {searchQuery.length > 2 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Search Results for "{searchQuery}"
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-zinc-400 hover:text-white"
                data-testid="button-clear-search"
              >
                Clear
              </Button>
            </div>
            {searchLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <NewsCardSkeleton key={i} />
                ))}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {searchResults.map((article, i) => (
                  <NewsCard key={i} article={article} />
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <Search className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">No results found</h3>
                <p className="text-sm text-zinc-500">
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        ) : (
          <Tabs defaultValue="market" className="w-full">
            <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-auto p-0 mb-6">
              <TabsTrigger 
                value="market"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm flex items-center gap-2"
                data-testid="tab-market-news"
              >
                <TrendingUp className="h-4 w-4" />
                Markets
              </TabsTrigger>
              <TabsTrigger 
                value="general"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm flex items-center gap-2"
                data-testid="tab-general-news"
              >
                <Globe className="h-4 w-4" />
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="market">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <NewsCardSkeleton key={i} />
                  ))}
                </div>
              ) : news?.market && news.market.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {news.market.map((article, i) => (
                    <NewsCard key={i} article={article} />
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">No market news</h3>
                  <p className="text-sm text-zinc-500">
                    Check back later for market updates
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="general">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <NewsCardSkeleton key={i} />
                  ))}
                </div>
              ) : news?.general && news.general.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {news.general.map((article, i) => (
                    <NewsCard key={i} article={article} />
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                  <Globe className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">No general news</h3>
                  <p className="text-sm text-zinc-500">
                    Check back later for business news
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
