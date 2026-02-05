import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChange } from "@/components/price-change";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface EarningsEvent {
  symbol: string;
  name: string;
  date: string;
  time: "before" | "after" | "during";
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  surprise: number | null;
}

interface EarningsData {
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
}

export default function EarningsPage() {
  const { data: earnings, isLoading } = useQuery<EarningsData>({
    queryKey: ["/api/earnings"],
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatMoney = (value: number | null) => {
    if (value === null) return "N/A";
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getTimeIcon = (time: string) => {
    switch (time) {
      case "before":
        return <Clock className="h-3 w-3" />;
      case "after":
        return <Clock className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getTimeLabel = (time: string) => {
    switch (time) {
      case "before":
        return "BMO";
      case "after":
        return "AMC";
      default:
        return "During";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-7 w-7 text-primary" />
          Earnings Calendar
        </h1>
        <p className="text-muted-foreground mt-1">
          Track upcoming and recent earnings announcements
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="recent" data-testid="tab-recent">
            Recent Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-5 w-24 ml-auto" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : earnings?.upcoming && earnings.upcoming.length > 0 ? (
            <div className="grid gap-4">
              {earnings.upcoming.map((event, i) => (
                <Card key={`${event.symbol}-${i}`} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                          <span className="font-mono font-bold text-primary text-sm">
                            {event.symbol.slice(0, 4)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {event.symbol}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getTimeIcon(event.time)}
                              <span className="ml-1">{getTimeLabel(event.time)}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-none">
                            {event.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-1">
                        <div className="flex items-center gap-2 text-foreground">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatDate(event.date)}</span>
                        </div>
                        {event.epsEstimate !== null && (
                          <p className="text-sm text-muted-foreground">
                            EPS Est: <span className="font-mono">${event.epsEstimate.toFixed(2)}</span>
                          </p>
                        )}
                        {event.revenueEstimate !== null && (
                          <p className="text-sm text-muted-foreground">
                            Rev Est: <span className="font-mono">{formatMoney(event.revenueEstimate)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  No upcoming earnings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Check back later for upcoming earnings announcements.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-5 w-24 ml-auto" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : earnings?.recent && earnings.recent.length > 0 ? (
            <div className="grid gap-4">
              {earnings.recent.map((event, i) => {
                const beat = event.surprise !== null && event.surprise > 0;
                const miss = event.surprise !== null && event.surprise < 0;

                return (
                  <Card key={`${event.symbol}-${i}`} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-md ${
                              beat
                                ? "bg-green-500/10"
                                : miss
                                ? "bg-red-500/10"
                                : "bg-muted"
                            }`}
                          >
                            {beat ? (
                              <TrendingUp className="h-5 w-5 text-green-500" />
                            ) : miss ? (
                              <TrendingDown className="h-5 w-5 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">
                                {event.symbol}
                              </span>
                              {event.surprise !== null && (
                                <Badge
                                  variant="secondary"
                                  className={
                                    beat
                                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                      : miss
                                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                      : ""
                                  }
                                >
                                  {beat ? "Beat" : miss ? "Miss" : "In-line"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-none">
                              {event.name}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Date</p>
                            <p className="font-medium">{formatDate(event.date)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">EPS</p>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-medium">
                                ${event.epsActual?.toFixed(2) || "N/A"}
                              </span>
                              {event.epsEstimate !== null && event.epsActual !== null && (
                                <span className="text-xs text-muted-foreground">
                                  vs ${event.epsEstimate.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          {event.surprise !== null && (
                            <div>
                              <p className="text-muted-foreground text-xs mb-1">Surprise</p>
                              <PriceChange value={event.surprise} size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  No recent earnings data
                </h3>
                <p className="text-sm text-muted-foreground">
                  Recent earnings results will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
