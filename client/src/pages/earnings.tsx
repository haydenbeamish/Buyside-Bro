import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Loader2,
  Eye,
  FileSearch,
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

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono text-sm ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function AnalysisButton({ 
  symbol, 
  mode,
  label,
  icon: Icon,
}: { 
  symbol: string; 
  mode: "preview" | "review";
  label: string;
  icon: typeof Eye;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const startAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/fundamental-analysis/jobs", {
        ticker: symbol,
        mode: mode,
      });
      const data = await res.json();
      
      if (data.jobId) {
        setLocation(`/analysis?ticker=${symbol}&jobId=${data.jobId}`);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to start ${label.toLowerCase()} for ${symbol}`,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startAnalysis}
      disabled={isLoading}
      className="text-green-400 hover:text-green-300 hover:bg-green-900/20 gap-1.5"
      data-testid={`button-${mode}-${symbol}`}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function AnalysisDropdown({ symbol, defaultMode }: { symbol: string; defaultMode: "preview" | "review" }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const startAnalysis = async (mode: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/fundamental-analysis/jobs", {
        ticker: symbol,
        mode: mode,
      });
      const data = await res.json();
      
      if (data.jobId) {
        setLocation(`/analysis?ticker=${symbol}&jobId=${data.jobId}`);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to start analysis for ${symbol}`,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="border-green-500/50 bg-green-900/20 hover:bg-green-900/40 text-green-400 gap-1.5"
          data-testid={`button-analyze-${symbol}`}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Analyze</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
        <DropdownMenuItem 
          onClick={() => startAnalysis("preview")}
          className="text-zinc-300 hover:text-white focus:text-white cursor-pointer gap-2"
          data-testid={`menu-preview-${symbol}`}
        >
          <Eye className="h-4 w-4 text-blue-400" />
          <div>
            <div className="font-medium">Earnings Preview</div>
            <div className="text-xs text-zinc-500">Analysis before earnings</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => startAnalysis("review")}
          className="text-zinc-300 hover:text-white focus:text-white cursor-pointer gap-2"
          data-testid={`menu-review-${symbol}`}
        >
          <FileSearch className="h-4 w-4 text-orange-400" />
          <div>
            <div className="font-medium">Earnings Review</div>
            <div className="text-xs text-zinc-500">Analysis after earnings</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => startAnalysis("deep_dive")}
          className="text-zinc-300 hover:text-white focus:text-white cursor-pointer gap-2"
          data-testid={`menu-deep-dive-${symbol}`}
        >
          <Sparkles className="h-4 w-4 text-green-400" />
          <div>
            <div className="font-medium">Deep Dive</div>
            <div className="text-xs text-zinc-500">Comprehensive analysis</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight mb-2 display-font neon-green-subtle">
            EARNINGS CALENDAR
          </h1>
          <p className="text-zinc-500">
            Track upcoming and recent earnings announcements
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-auto p-0 mb-6">
            <TabsTrigger 
              value="upcoming"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-upcoming"
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger 
              value="recent"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-md px-4 py-2 text-sm"
              data-testid="tab-recent"
            >
              Recent Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20 bg-zinc-800" />
                        <Skeleton className="h-4 w-32 bg-zinc-800" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-5 w-24 ml-auto bg-zinc-800" />
                        <Skeleton className="h-4 w-16 ml-auto bg-zinc-800" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : earnings?.upcoming && earnings.upcoming.length > 0 ? (
              <div className="space-y-4">
                {earnings.upcoming.map((event, i) => (
                  <div 
                    key={`${event.symbol}-${i}`} 
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zinc-800">
                          <span className="font-mono font-bold text-white text-sm">
                            {event.symbol.slice(0, 4)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-white">
                              {event.symbol}
                            </span>
                            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                              <Clock className="h-3 w-3 mr-1" />
                              {getTimeLabel(event.time)}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-500 truncate max-w-[200px] md:max-w-none">
                            {event.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col md:items-end gap-1">
                          <div className="flex items-center gap-2 text-white">
                            <Calendar className="h-4 w-4 text-zinc-500" />
                            <span className="font-medium">{formatDate(event.date)}</span>
                          </div>
                          {event.epsEstimate !== null && (
                            <p className="text-sm text-zinc-500">
                              EPS Est: <span className="font-mono text-zinc-300">${event.epsEstimate.toFixed(2)}</span>
                            </p>
                          )}
                          {event.revenueEstimate !== null && (
                            <p className="text-sm text-zinc-500">
                              Rev Est: <span className="font-mono text-zinc-300">{formatMoney(event.revenueEstimate)}</span>
                            </p>
                          )}
                        </div>
                        <AnalysisDropdown symbol={event.symbol} defaultMode="preview" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">
                  No upcoming earnings
                </h3>
                <p className="text-sm text-zinc-500">
                  Check back later for upcoming earnings announcements.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20 bg-zinc-800" />
                        <Skeleton className="h-4 w-32 bg-zinc-800" />
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-5 w-24 ml-auto bg-zinc-800" />
                        <Skeleton className="h-4 w-16 ml-auto bg-zinc-800" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : earnings?.recent && earnings.recent.length > 0 ? (
              <div className="space-y-4">
                {earnings.recent.map((event, i) => {
                  const beat = event.surprise !== null && event.surprise > 0;
                  const miss = event.surprise !== null && event.surprise < 0;

                  return (
                    <div 
                      key={`${event.symbol}-${i}`} 
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-md ${
                              beat
                                ? "bg-green-500/10"
                                : miss
                                ? "bg-red-500/10"
                                : "bg-zinc-800"
                            }`}
                          >
                            {beat ? (
                              <TrendingUp className="h-5 w-5 text-green-500" />
                            ) : miss ? (
                              <TrendingDown className="h-5 w-5 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-white">
                                {event.symbol}
                              </span>
                              {event.surprise !== null && (
                                <Badge
                                  variant="outline"
                                  className={
                                    beat
                                      ? "border-green-500/50 text-green-500"
                                      : miss
                                      ? "border-red-500/50 text-red-500"
                                      : "border-zinc-700 text-zinc-400"
                                  }
                                >
                                  {beat ? "Beat" : miss ? "Miss" : "In-line"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 truncate max-w-[200px] md:max-w-none">
                              {event.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">Date</p>
                              <p className="font-medium text-white">{formatDate(event.date)}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">EPS</p>
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-medium text-white">
                                  ${event.epsActual?.toFixed(2) || "N/A"}
                                </span>
                                {event.epsEstimate !== null && event.epsActual !== null && (
                                  <span className="text-xs text-zinc-500">
                                    vs ${event.epsEstimate.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {event.surprise !== null && (
                              <div>
                                <p className="text-zinc-500 text-xs mb-1">Surprise</p>
                                <PercentDisplay value={event.surprise} />
                              </div>
                            )}
                          </div>
                          <AnalysisDropdown symbol={event.symbol} defaultMode="review" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
                <AlertCircle className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">
                  No recent earnings data
                </h3>
                <p className="text-sm text-zinc-500">
                  Recent earnings results will appear here.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
