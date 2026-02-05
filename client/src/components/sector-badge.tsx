import { Badge } from "@/components/ui/badge";
import { PriceChange } from "./price-change";
import { cn } from "@/lib/utils";

interface SectorBadgeProps {
  name: string;
  change: number;
  className?: string;
}

export function SectorBadge({ name, change, className }: SectorBadgeProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "px-3 py-1.5 text-xs font-medium",
        isPositive && "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
        isNegative && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        !isPositive && !isNegative && "bg-muted text-muted-foreground",
        className
      )}
    >
      <span className="mr-2">{name}</span>
      <span className="font-mono">
        {isPositive && "+"}
        {change.toFixed(2)}%
      </span>
    </Badge>
  );
}
