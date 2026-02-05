import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceChangeProps {
  value: number;
  showIcon?: boolean;
  showPercent?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PriceChange({ 
  value, 
  showIcon = true, 
  showPercent = true,
  className,
  size = "md" 
}: PriceChangeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 font-medium",
        textSizes[size],
        isPositive && "text-green-500 dark:text-green-400",
        isNegative && "text-red-500 dark:text-red-400",
        isZero && "text-muted-foreground",
        className
      )}
    >
      {showIcon && (
        <>
          {isPositive && <TrendingUp className={iconSizes[size]} />}
          {isNegative && <TrendingDown className={iconSizes[size]} />}
          {isZero && <Minus className={iconSizes[size]} />}
        </>
      )}
      <span>
        {isPositive && "+"}
        {value.toFixed(2)}
        {showPercent && "%"}
      </span>
    </div>
  );
}
