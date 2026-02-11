import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { X, ArrowRight } from "lucide-react";

interface StreamingItem {
  ticker: string;
  mode: string;
  updatedAt: string;
}

interface CompletedItem {
  ticker: string;
  mode: string;
  key: string;
}

const MODE_LABELS: Record<string, string> = {
  deep_dive: "Deep Dive",
  earnings_preview: "Earnings Preview",
  earnings_review: "Earnings Review",
};

function getResultUrl(mode: string, ticker: string): string {
  if (mode === "deep_dive") {
    return `/analysis?ticker=${ticker}`;
  }
  const earningsMode = mode === "earnings_preview" ? "preview" : "review";
  return `/earnings?ticker=${ticker}&mode=${earningsMode}`;
}

export default function AnalysisNotificationBanner() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const previousStreamingKeys = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const { data: streamingItems } = useQuery<StreamingItem[]>({
    queryKey: ["/api/analysis/streaming"],
    queryFn: async () => {
      const res = await fetch("/api/analysis/streaming", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      // Poll every 3s while there are tracked streaming items or while we haven't loaded yet
      const hasTracked = previousStreamingKeys.current.size > 0;
      const hasActive = (query.state.data?.length ?? 0) > 0;
      return hasTracked || hasActive ? 3000 : 10000;
    },
  });

  useEffect(() => {
    if (!streamingItems) return;

    const currentKeys = new Set(streamingItems.map((i) => `${i.ticker}:${i.mode}`));

    if (initialLoadDone.current) {
      // Items that were streaming before but are no longer → they completed
      const newlyCompleted: CompletedItem[] = [];
      Array.from(previousStreamingKeys.current).forEach((key) => {
        if (!currentKeys.has(key)) {
          const [ticker, mode] = key.split(":");
          newlyCompleted.push({ ticker, mode, key });
        }
      });
      if (newlyCompleted.length > 0) {
        setCompletedItems((prev) => [...prev, ...newlyCompleted]);
      }
    } else {
      initialLoadDone.current = true;
    }

    previousStreamingKeys.current = currentKeys;
  }, [streamingItems]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (completedItems.length === 0) return;
    const timer = setTimeout(() => {
      setCompletedItems((prev) => prev.slice(1));
    }, 30000);
    return () => clearTimeout(timer);
  }, [completedItems]);

  const dismiss = useCallback((key: string) => {
    setCompletedItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const handleViewResults = useCallback(
    (item: CompletedItem) => {
      setLocation(getResultUrl(item.mode, item.ticker));
      dismiss(item.key);
    },
    [setLocation, dismiss],
  );

  if (!isAuthenticated || completedItems.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {completedItems.map((item) => (
        <div
          key={item.key}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-green-500/40 shadow-lg shadow-green-500/10 animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <span className="text-sm text-zinc-200">
            Analysis complete:{" "}
            <span className="text-green-400 font-semibold">
              {item.ticker} {MODE_LABELS[item.mode] || item.mode}
            </span>
          </span>
          <button
            onClick={() => handleViewResults(item)}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          >
            View Results
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => dismiss(item.key)}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
