import { Card, CardContent } from "@/components/ui/card";
import { PriceChange } from "./price-change";
import { cn } from "@/lib/utils";

interface MarketCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  className?: string;
}

export function MarketCard({
  symbol,
  name,
  price,
  change,
  changePercent,
  className,
}: MarketCardProps) {
  return (
    <Card className={cn("hover-elevate cursor-pointer", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-mono font-semibold text-foreground truncate">
              {symbol}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {name}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono font-semibold text-foreground">
              {price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <PriceChange value={changePercent} size="sm" showIcon={false} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
