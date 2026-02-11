import { FlaskConical, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface ExamplePortfolioBannerProps {
  variant?: "holdings" | "hedging";
  onAddHoldings?: () => void;
  onDismiss?: () => void;
}

export function ExamplePortfolioBanner({ variant = "holdings", onAddHoldings, onDismiss }: ExamplePortfolioBannerProps) {
  if (variant === "hedging") {
    return (
      <div className="border-2 border-dashed border-amber-500/40 bg-amber-900/10 rounded-lg p-4 mb-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-400 font-semibold text-sm">Example Hedging Analysis</p>
          <p className="text-zinc-400 text-xs mt-1">
            This shows hedging strategies for a sample portfolio. Upgrade to Pro and add your holdings to get recommendations for YOUR portfolio.
          </p>
        </div>
        <Link href="/subscription">
          <Button size="sm" className="neon-button shrink-0">Upgrade to Pro</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-amber-500/40 bg-amber-900/10 rounded-lg p-4 mb-4 flex items-start gap-3">
      <FlaskConical className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-400 font-semibold text-sm">Example Portfolio</p>
        <p className="text-zinc-400 text-xs mt-1">
          You're viewing a sample portfolio with live market data. Add your own holdings to track your real positions.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" className="neon-button" onClick={onAddHoldings}>
          Add My Holdings
        </Button>
        <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-300" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
