import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

interface MarketSummary {
  summary: string;
  generatedAt: string;
  cached?: boolean;
}

export default function WhatsUpPage() {
  const { data: summary, isLoading } = useQuery<MarketSummary>({
    queryKey: ["/api/markets/summary"],
  });

  return (
    <div className="p-6">
      <h1 className="display-font text-3xl tracking-wider neon-green mb-8 uppercase" data-testid="text-whats-up-title">
        What's Up?
      </h1>

      <div className="bg-zinc-900 border border-green-900/30 rounded-lg p-6">
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
              dangerouslySetInnerHTML={{ __html: summary.summary }}
            />
            <p className="text-zinc-600 text-xs mt-4 pt-4 border-t border-zinc-800">
              Last updated: {new Date(summary.generatedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-zinc-500">No market summary available.</p>
        )}
      </div>
    </div>
  );
}
