import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsCardSkeleton } from "@/components/loading-skeleton";
import {
  Newspaper,
  Search,
  ExternalLink,
  Clock,
  TrendingUp,
  Building2,
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
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "negative":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const NewsCard = ({ article }: { article: NewsArticle }) => (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground leading-snug line-clamp-2">
              {article.title}
            </h3>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`link-news-${article.title.slice(0, 20)}`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {article.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {article.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {article.source}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(article.publishedAt)}
            </div>
            {article.sentiment && (
              <Badge variant="secondary" className={`text-xs ${getSentimentColor(article.sentiment)}`}>
                {article.sentiment}
              </Badge>
            )}
          </div>
          {article.tickers && article.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tickers.slice(0, 5).map((ticker) => (
                <Badge key={ticker} variant="secondary" className="text-xs font-mono">
                  ${ticker}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-primary" />
            Financial News
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with the latest market news and insights
          </p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-news"
          />
        </div>
      </div>

      {searchQuery.length > 2 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Search Results for "{searchQuery}"
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
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
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground">
                  Try a different search term
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Tabs defaultValue="market" className="w-full">
          <TabsList>
            <TabsTrigger value="market" data-testid="tab-market-news">
              <TrendingUp className="h-4 w-4 mr-2" />
              Markets
            </TabsTrigger>
            <TabsTrigger value="general" data-testid="tab-general-news">
              <Globe className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-4">
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
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No market news</h3>
                  <p className="text-sm text-muted-foreground">
                    Check back later for market updates
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="general" className="mt-4">
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
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Globe className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No general news</h3>
                  <p className="text-sm text-muted-foreground">
                    Check back later for business news
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
